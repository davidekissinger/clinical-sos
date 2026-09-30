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
