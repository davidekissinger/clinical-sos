import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';

globalThis.Deno = { env: { get: name => ({
  SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'public-test', SUPABASE_SERVICE_ROLE_KEY: 'private-test',
})[name] }, serve: () => {} };
const bundled = await build({
  entryPoints: ['supabase/functions/list-users/index.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{
    name: 'network-boundary',
    setup(builder) {
      builder.onResolve({ filter: /^(npm:|jsr:)/ }, args => ({ path: args.path, namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, args => ({
        contents: args.path.endsWith('/cors') ? 'export const corsHeaders = {"Access-Control-Allow-Origin":"*"};' :
          args.path.startsWith('jsr:') ? '' :
            'export const createClient = (...args) => globalThis.directoryClient(...args);',
      }));
    },
  }],
});
const { handleRequest } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

function boundary({ role = 'admin', authenticated = true, roleError = null, listError = null } = {}) {
  const calls = [];
  globalThis.directoryClient = (_url, key, options) => {
    calls.push(['client', key]);
    if (key === 'public-test') {
      assert.equal(options.global.headers.Authorization, 'Bearer fixture');
      return {
        auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'actor', user_metadata: { role: 'admin' } } : null }, error: null }) },
        from: table => {
          assert.equal(table, 'profiles');
          return { select: fields => {
            assert.equal(fields, 'role');
            return { eq: (field, id) => {
              assert.equal(field, 'id'); assert.equal(id, 'actor');
              return { maybeSingle: async () => ({ data: role ? { role } : null, error: roleError }) };
            } };
          } };
        },
      };
    }
    assert.equal(key, 'private-test');
    const query = {};
    for (const method of ['select', 'eq', 'ilike', 'order']) {
      query[method] = (...args) => { calls.push([method, ...args]); return query; };
    }
    query.range = async (...args) => {
      calls.push(['range', ...args]);
      return { data: [{ id: 'user-1', email: 'person@example.invalid', full_name: 'Test Person', role: 'pending',
        created_at: '2026-09-01', secret_extra: 'must never return' }], error: listError };
    };
    return { from: table => { assert.equal(table, 'profiles'); return query; } };
  };
  return calls;
}
const request = (body = {}) => new Request('https://example.invalid', {
  method: 'POST', headers: { Authorization: 'Bearer fixture', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

test('preflight and missing authorization never initialize clients', async () => {
  globalThis.directoryClient = () => assert.fail('must not read database');
  assert.equal((await handleRequest(new Request('https://example.invalid', { method: 'OPTIONS' }))).status, 200);
  assert.equal((await handleRequest(new Request('https://example.invalid', { method: 'POST' }))).status, 401);
  assert.equal((await handleRequest(new Request('https://example.invalid'))).status, 405);
});

test('invalid authentication cannot read a profile or create a privileged client', async () => {
  const calls = boundary({ authenticated: false });
  assert.equal((await handleRequest(request())).status, 401);
  assert.deepEqual(calls, [['client', 'public-test']]);
});

for (const role of [null, 'pending', 'client', 'clinical', 'finance', 'business_development', 'read_only']) {
  test(`role ${role} is denied even when user metadata claims admin`, async () => {
    const calls = boundary({ role });
    assert.equal((await handleRequest(request({ role: 'admin' }))).status, 403);
    assert.deepEqual(calls, [['client', 'public-test']]);
  });
}

test('admin directory bounds pages, aliases dates and omits extra data', async () => {
  const calls = boundary();
  const response = await handleRequest(request({ sort: '-created_date', limit: 50, skip: 100 }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), { users: [{
    id: 'user-1', email: 'person@example.invalid', full_name: 'Test Person', role: 'pending', created_date: '2026-09-01',
  }] });
  assert.ok(calls.some(c => JSON.stringify(c) === JSON.stringify(['select', 'id,email,full_name,role,created_at'])));
  assert.deepEqual(calls.filter(c => c[0] === 'order'), [
    ['order', 'created_at', { ascending: false }], ['order', 'id', { ascending: true }],
  ]);
  assert.deepEqual(calls.at(-1), ['range', 100, 149]);
});

test('invitation query filters eligibility and escapes wildcard characters before pagination', async () => {
  const calls = boundary();
  assert.equal((await handleRequest(request({ search_email: ' a_b% ', pending_only: true }))).status, 200);
  assert.deepEqual(calls.find(c => c[0] === 'eq'), ['eq', 'role', 'pending']);
  assert.deepEqual(calls.find(c => c[0] === 'ilike'), ['ilike', 'email', '%a\\_b\\%%']);
  assert.ok(calls.findIndex(c => c[0] === 'ilike') < calls.findIndex(c => c[0] === 'range'));
});

for (const body of [null, [], { limit: 501 }, { limit: -1 }, { skip: 0.5 }, { sort: 'password' },
  { sort: 'constructor' }, { search_email: '%' }, { pending_only: 'true' }]) {
  test(`invalid directory request fails before privileged access: ${JSON.stringify(body)}`, async () => {
    const calls = boundary();
    assert.equal((await handleRequest(request(body))).status, 400);
    assert.deepEqual(calls, [['client', 'public-test']]);
  });
}

test('database failures do not expose internal errors or data', async () => {
  boundary({ listError: { message: 'private database details' } });
  const response = await handleRequest(request());
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unable to load users' });
  const calls = boundary({ roleError: new Error('private role query error') });
  assert.equal((await handleRequest(request())).status, 500);
  assert.deepEqual(calls, [['client', 'public-test']]);
});
