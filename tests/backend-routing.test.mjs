import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

// Exercise the real adapter; replace only its network boundary.
const bundled = await build({
  entryPoints: ['src/api/backendClient.js'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  plugins: [{
    name: 'supabase-test-boundary',
    setup(builder) {
      builder.onResolve({ filter: /^@\/api\/supabaseClient$/ }, () => ({
        path: 'supabase', namespace: 'test',
      }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export const supabase = { functions: { invoke: (...args) => globalThis.identityTestInvoke(...args) } };',
      }));
    },
  }],
});
const { backend } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);

test('subscription catalog uses the curated GET endpoint without a request body', async () => {
  globalThis.identityTestInvoke = async (slug, options) => {
    assert.equal(slug, 'stripe-checkout');
    assert.deepEqual(options, { method: 'GET' });
    return { data: { tiers: [{ id: 'tier-1' }] }, error: null };
  };
  assert.deepEqual(await backend.functions.invoke('getSubscriptionTiers'), { tiers: [{ id: 'tier-1' }] });
});

test('checkout preserves tier selection and the server checkout response', async () => {
  const response = { checkout_url: 'https://checkout.stripe.com/test-fixture' };
  globalThis.identityTestInvoke = async (slug, options) => {
    assert.equal(slug, 'stripe-checkout');
    assert.deepEqual(options.body, { tier_id: 'tier-1' });
    return { data: response, error: null };
  };
  assert.equal(await backend.functions.invoke('createCheckoutSession', { tier_id: 'tier-1' }), response);
});

test('user directory maps legacy list pagination and unwraps users', async () => {
  globalThis.identityTestInvoke = async (slug, options) => {
    assert.equal(slug, 'list-users');
    assert.deepEqual(options.body, { sort: '-created_date', limit: 500, skip: 0 });
    return { data: { users: [{ id: 'user-1' }] }, error: null };
  };
  assert.deepEqual(await backend.entities.User.list('-created_date', 500), [{ id: 'user-1' }]);
});

test('invitation search sends email and eligibility to the server', async () => {
  globalThis.identityTestInvoke = async (slug, options) => {
    assert.equal(slug, 'list-users');
    assert.deepEqual(options.body, { sort: '-created_date', limit: 50, skip: 0,
      search_email: 'person@example.invalid', pending_only: true });
    return { data: { users: [] }, error: null };
  };
  assert.deepEqual(await backend.entities.User.searchPending('person@example.invalid'), []);
});

for (const decision of ['create', 'update_capabilities', 'activate', 'suspend', 'revoke']) {
  test(`membership ${decision} preserves scope and capabilities separately from dispatch`, async () => {
    const payload = { action: decision, membership_action: 'must-not-win', membership_id: 'member-1',
      client_user_id: 'user-1', client_account_id: 'account-1', authorized_facility_ids: ['facility-1'],
      authorized_engagement_ids: [], capabilities: { can_login: false, can_approve_poc: false }, reason: 'Test' };
    const original = structuredClone(payload);
    globalThis.identityTestInvoke = async (slug, options) => {
      assert.equal(slug, 'client-management-action');
      assert.deepEqual(options.body, { ...payload, action: 'manage_membership', membership_action: decision });
      return { data: { success: true }, error: null };
    };
    assert.deepEqual(await backend.functions.invoke('manageClientMembership', payload), { success: true });
    assert.deepEqual(payload, original);
  });
}

for (const [name, action, payload] of [
  ['syncClientMembershipAccess', 'sync_membership', { membership_id: 'member-1' }],
  ['transitionClientAccess', 'transition_access', { client_account_id: 'account-1', new_access_status: 'Suspended',
    reason: 'Test', manual_override: false, manual_override_type: null, override_expiration: null }],
]) {
  test(`${name} preserves requested access settings and fixes dispatch`, async () => {
    const supplied = { ...payload, action: 'update_billing' };
    const response = { success: true };
    globalThis.identityTestInvoke = async (slug, options) => {
      assert.equal(slug, 'client-management-action');
      assert.deepEqual(options.body, { ...payload, action });
      return { data: response, error: null };
    };
    assert.equal(await backend.functions.invoke(name, supplied), response);
    assert.equal(supplied.action, 'update_billing');
  });
}

test('missing membership decision cannot activate a membership', async () => {
  globalThis.identityTestInvoke = async (_slug, options) => {
    assert.equal(options.body.membership_action, undefined);
    return { data: null, error: { context: new Response(JSON.stringify({ error: 'Unknown membership action' }), { status: 400 }) } };
  };
  await assert.rejects(backend.functions.invoke('manageClientMembership', { membership_id: 'member-1' }), /Unknown membership action/);
});

test('management authorization denial reaches the caller without success', async () => {
  globalThis.identityTestInvoke = async () => ({
    data: null, error: { context: new Response(JSON.stringify({ error: 'Forbidden — admin only' }), { status: 403 }) },
  });
  await assert.rejects(backend.functions.invoke('transitionClientAccess', { client_account_id: 'account-1' }), error => {
    assert.equal(error.status, 403);
    assert.equal(error.message, 'Forbidden — admin only');
    return true;
  });
});

for (const [name, action, payload] of [
  ['closeDeficiency', 'close_deficiency', { deficiency_id: 'def-1', force: false, override_reason: null }],
  ['createEngagementFromOpportunity', 'create_engagement', { opportunity_id: 'opp-1', service_type: 'Consultation', start_date: '2026-10-01', clinical_lead_name: 'Test Lead', engagement_model: 'Fixed Fee', accepted_proposal_id: null }],
  ['updateRevisitReadiness', 'update_revisit_readiness', { deficiency_id: 'def-1', manual_criteria: { training_complete: true } }],
]) {
  test(`${name} matches the clinical workflow contract without changing fields`, async () => {
    const supplied = { ...payload, action: 'wrong_action' };
    const response = { success: true };
    globalThis.identityTestInvoke = async (slug, options) => {
      assert.equal(slug, 'clinical-workflow-action');
      assert.deepEqual(options.body, { ...payload, action });
      return { data: response, error: null };
    };
    assert.equal(await backend.functions.invoke(name, supplied), response);
    assert.equal(supplied.action, 'wrong_action');
  });
}

test('POC transition preserves decision and evidence separately from dispatch', async () => {
  const payload = { poc_id: 'poc-1', action: 'submit_poc', evidence: 'Verified evidence', revision_notes: 'Correction', transition_action: 'must-not-win' };
  globalThis.identityTestInvoke = async (slug, options) => {
    assert.equal(slug, 'clinical-workflow-action');
    assert.deepEqual(options.body, { ...payload, action: 'transition_poc', transition_action: 'submit_poc' });
    return { data: { success: true }, error: null };
  };
  assert.deepEqual(await backend.functions.invoke('transitionPOC', payload), { success: true });
  assert.equal(payload.action, 'submit_poc');
  assert.equal(payload.transition_action, 'must-not-win');
});

test('missing transition decision remains missing and server rejection is preserved', async () => {
  globalThis.identityTestInvoke = async (_slug, options) => {
    assert.equal(options.body.transition_action, undefined);
    return { data: null, error: { context: new Response(JSON.stringify({ error: 'Invalid transition' }), { status: 400 }) } };
  };
  await assert.rejects(backend.functions.invoke('transitionPOC', { poc_id: 'poc-1' }), /Invalid transition/);
});

test('clinical guard failure cannot be interpreted as successful closure', async () => {
  globalThis.identityTestInvoke = async () => ({
    data: null, error: { context: new Response(JSON.stringify({ error: 'Closure criteria not satisfied', closed: false }), { status: 409 }) },
  });
  await assert.rejects(backend.functions.invoke('closeDeficiency', { deficiency_id: 'def-1' }), error => {
    assert.equal(error.status, 409);
    assert.equal(error.data.closed, false);
    return true;
  });
});

for (const [name, action, payload] of [
  ['getMyIdentityProfile', 'get_profile', {}],
  ['submitNameChangeRequest', 'submit_change', { requested_display_name: 'Test Name', reason_for_request: 'Correction' }],
  ['withdrawNameChangeRequest', 'withdraw_change', { request_id: 'request-123' }],
]) {
  test(`${name} matches the deployed self-service contract`, async () => {
    const response = { profile: null, success: true };
    globalThis.identityTestInvoke = async (slug, options) => {
      assert.equal(slug, 'identity-self-service');
      assert.deepEqual(options.body, { ...payload, action });
      return { data: response, error: null };
    };
    const supplied = { ...payload, action: 'unintended_action' };
    assert.equal(await backend.functions.invoke(name, supplied), response);
    assert.equal(supplied.action, 'unintended_action', 'adapter must not mutate caller payload');
  });
}

test('administration preserves its server-validated action and target', async () => {
  const payload = { action: 'approve_request', request_id: 'request-123', decision_notes: 'Verified correction' };
  globalThis.identityTestInvoke = async (slug, options) => {
    assert.equal(slug, 'identity-admin-action');
    assert.deepEqual(options.body, payload);
    return { data: { success: true }, error: null };
  };
  assert.deepEqual(await backend.functions.invoke('manageUserIdentity', payload), { success: true });
});

test('authorization failures remain failures with useful server messages', async () => {
  globalThis.identityTestInvoke = async () => ({
    data: null,
    error: { message: 'HTTP error', context: new Response(JSON.stringify({ error: 'Forbidden: administrator role required.' }), { status: 403 }) },
  });
  await assert.rejects(backend.functions.invoke('manageUserIdentity', { action: 'verify' }), error => {
    assert.equal(error.status, 403);
    assert.equal(error.message, 'Forbidden: administrator role required.');
    return true;
  });
});

test('unrelated portal calls keep their existing payload and route', async () => {
  globalThis.identityTestInvoke = async (slug, options) => {
    assert.equal(slug, 'get-client-portal-data');
    assert.deepEqual(options.body, { resource: 'tasks' });
    return { data: [], error: null };
  };
  assert.deepEqual(await backend.functions.invoke('getClientPortalData', { resource: 'tasks' }), []);
});

test('unknown function names cannot become arbitrary endpoint invocations', () => {
  globalThis.identityTestInvoke = () => assert.fail('must not make a request');
  assert.throws(() => backend.functions.invoke('unknownFunction', {}), /Unsupported Clinical SOS function/);
});

for (const [name, action, payload] of [
  ['clientUpdateTask', 'update_task', { task_id: 'task-1', status: 'Complete', completion_note: 'Ready' }],
  ['clientRespondEvidence', 'respond_evidence', { evidence_id: 'evidence-1', response_status: 'Prepared', note: 'Ready for review' }],
]) {
  test(`${name} preserves record fields and fixes the dispatch action`, async () => {
    const supplied = { ...payload, action: 'wrong_action' };
    globalThis.identityTestInvoke = async (slug, options) => {
      assert.equal(slug, 'client-portal-action');
      assert.deepEqual(options.body, { ...payload, action });
      return { data: { success: true }, error: null };
    };
    assert.deepEqual(await backend.functions.invoke(name, supplied), { success: true });
    assert.equal(supplied.action, 'wrong_action');
  });
}

for (const decision of ['acknowledge', 'request_revision', 'client_approve']) {
  test(`POC ${decision} stays separate from endpoint dispatch`, async () => {
    const payload = { poc_id: 'poc-1', action: decision, comment: 'Review note', review_action: 'must-not-win' };
    const response = { success: true, regulatory_status_unchanged: 'Client Review' };
    globalThis.identityTestInvoke = async (slug, options) => {
      assert.equal(slug, 'client-portal-action');
      assert.deepEqual(options.body, {
        poc_id: 'poc-1', comment: 'Review note', review_action: decision, action: 'review_poc',
      });
      return { data: response, error: null };
    };
    assert.equal(await backend.functions.invoke('clientReviewPOC', payload), response);
    assert.equal(payload.action, decision);
    assert.equal(payload.review_action, 'must-not-win');
  });
}

test('a missing POC decision cannot become an approval', async () => {
  globalThis.identityTestInvoke = async (_slug, options) => {
    assert.equal(options.body.action, 'review_poc');
    assert.equal(options.body.review_action, undefined);
    return { data: null, error: { context: new Response(JSON.stringify({ error: 'review_action is required' }), { status: 400 }) } };
  };
  await assert.rejects(backend.functions.invoke('clientReviewPOC', { poc_id: 'poc-1' }), /review_action is required/);
});

test('portal access denials preserve the generic response for UI rollback', async () => {
  globalThis.identityTestInvoke = async () => ({
    data: null,
    error: { context: new Response(JSON.stringify({ error: 'Record not found or unavailable' }), { status: 404 }) },
  });
  await assert.rejects(backend.functions.invoke('clientUpdateTask', { task_id: 'foreign-task', status: 'Complete' }), error => {
    assert.equal(error.status, 404);
    assert.equal(error.message, 'Record not found or unavailable');
    return true;
  });
});
