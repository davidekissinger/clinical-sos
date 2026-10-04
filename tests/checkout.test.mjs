import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

let handler;
let stripeKey;
globalThis.Deno = {
  env: { get: name => name === 'STRIPE_SECRET_KEY' ? stripeKey : ({
    SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'public', SUPABASE_SERVICE_ROLE_KEY: 'private',
  })[name] },
  serve: callback => { handler = callback; },
};
const bundle = await build({
  entryPoints: ['supabase/functions/stripe-checkout/index.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{
    name: 'mock-network',
    setup(builder) {
      builder.onResolve({ filter: /^(npm:|jsr:)/ }, args => ({ path: args.path, namespace: 'mock' }));
      builder.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({
        contents: args.path.endsWith('/cors') ? 'export const corsHeaders = {};' :
          args.path.startsWith('jsr:') ? '' :
            'export const createClient = (...args) => globalThis.checkoutClient(...args);',
      }));
    },
  }],
});
await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

function fixture({ role = 'client', status = 'Active', memberships = 1, price = 'price_test' } = {}) {
  const calls = [];
  globalThis.fetch = async () => assert.fail('must not call Stripe');
  globalThis.checkoutClient = (_url, key) => key === 'public' ? {
    auth: { getUser: async () => ({ data: { user: { id: 'actor' } }, error: null }) },
  } : {
    from(table) {
      let single = false;
      const query = {};
      const rows = () => table === 'profiles' ? { id: 'actor', role } :
        table === 'client_memberships' ? Array.from({ length: memberships }, () => ({ client_account_id: 'account-1' })) :
        table === 'client_accounts' ? { id: 'account-1', access_status: status } :
        table === 'subscription_tiers' ? (single ? { id: 'tier-1', stripe_price_id: price, tier_name: 'Test', tier_key: 'test' } : [{ id: 'tier-1' }]) : null;
      for (const method of ['select', 'eq', 'order']) query[method] = (...args) => {
        calls.push([table, method, ...args]); return query;
      };
      query.maybeSingle = async () => { single = true; return { data: rows(), error: null }; };
      query.then = (resolve, reject) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject);
      query.insert = async () => { calls.push(['audit']); return { error: null }; };
      return query;
    },
  };
  return calls;
}
const request = (method = 'POST', body = { tier_id: 'tier-1' }) => new Request('https://example.invalid', {
  method, headers: { Authorization: 'Bearer fixture', Origin: 'https://clinical-sos.netlify.app', 'Content-Type': 'application/json' },
  ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});

test('catalog requires eligible client and selects curated fields', async () => {
  const calls = fixture();
  const response = await handler(request('GET'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { tiers: [{ id: 'tier-1' }] });
  const selection = calls.find(c => c[0] === 'subscription_tiers' && c[1] === 'select')[2];
  assert.equal(selection.includes('stripe_price_id'), false);
  assert.equal(selection.includes('*'), false);
});

for (const config of [{ role: 'admin' }, { role: 'pending' }, { status: 'Suspended' },
  { status: 'Terminated' }, { memberships: 0 }, { memberships: 2 }]) {
  test(`checkout rejects ineligible caller: ${JSON.stringify(config)}`, async () => {
    fixture(config);
    const response = await handler(request());
    assert.ok([403, 409].includes(response.status));
  });
}

for (const key of [undefined, 'sk_live_fixture', 'rk_live_fixture']) {
  test(`checkout cannot create a payment session with ${key || 'missing key'}`, async () => {
    fixture(); stripeKey = key;
    assert.equal((await handler(request())).status, 503);
  });
}

test('test checkout sends server price and account, not caller-controlled values', async () => {
  const calls = fixture(); stripeKey = 'sk_test_fixture';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.stripe.com/v1/checkout/sessions');
    assert.equal(options.body.get('line_items[0][price]'), 'price_test');
    assert.equal(options.body.get('client_reference_id'), 'account-1');
    assert.equal(options.body.get('success_url'), 'https://clinical-sos.netlify.app/client/subscription?status=success');
    return new Response(JSON.stringify({ id: 'session-fixture', url: 'https://checkout.stripe.com/test-fixture' }));
  };
  const response = await handler(request('POST', { tier_id: 'tier-1', price: 'attacker-price', client_account_id: 'other-account' }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).session_id, 'session-fixture');
  assert.ok(calls.some(c => c[0] === 'audit'));
});

test('unconfigured tier fails without contacting Stripe', async () => {
  fixture({ price: null }); stripeKey = 'sk_test_fixture';
  assert.equal((await handler(request())).status, 503);
});
