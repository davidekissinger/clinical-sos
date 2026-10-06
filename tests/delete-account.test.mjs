import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

let fixture = null;

function tableQuery(table) {
  let operation = "select";
  let values = null;
  const filters = {};

  const resolve = () => {
    if (table === "profiles" && operation === "select") {
      return { data: fixture.profile, error: fixture.profileError || null };
    }
    if (table === "client_memberships" && operation === "select") {
      return { data: fixture.memberships, error: fixture.membershipError || null };
    }
    if (table === "automation_logs" && operation === "insert") {
      fixture.auditInserts.push(values);
      if (fixture.auditInsertError) return { data: null, error: fixture.auditInsertError };
      return { data: { id: "audit-1" }, error: null };
    }
    if (table === "automation_logs" && operation === "update") {
      fixture.auditUpdates.push({ values, filters: { ...filters } });
      return { data: null, error: null };
    }
    return { data: null, error: null };
  };

  const query = {
    select() {
      operation = "select";
      return query;
    },
    insert(nextValues) {
      operation = "insert";
      values = nextValues;
      return query;
    },
    update(nextValues) {
      operation = "update";
      values = nextValues;
      return query;
    },
    eq(column, value) {
      filters[column] = value;
      return query;
    },
    maybeSingle() {
      return Promise.resolve(resolve());
    },
    single() {
      return Promise.resolve(resolve());
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolve()).then(onFulfilled, onRejected);
    },
  };
  return query;
}

globalThis.Deno = {
  env: {
    get(name) {
      if (name === "SUPABASE_URL") return "https://clinical-sos.test";
      if (name === "SUPABASE_PUBLISHABLE_KEYS") return JSON.stringify({ default: "public-test" });
      if (name === "SUPABASE_SECRET_KEYS") return JSON.stringify({ default: "secret-test" });
      return null;
    },
  },
  serve(handler) {
    globalThis.__deleteAccountHandler = handler;
  },
};

globalThis.__makeDeleteAccountClient = (_url, key) => {
  if (key === "public-test") {
    return {
      auth: {
        getUser: async () => ({
          data: { user: fixture.user },
          error: fixture.userError || null,
        }),
      },
    };
  }

  if (key === "secret-test") {
    return {
      from: tableQuery,
      auth: {
        admin: {
          deleteUser: async (id) => {
            fixture.deletedUserIds.push(id);
            return { data: null, error: fixture.deleteError || null };
          },
        },
      },
    };
  }

  throw new Error(`Unexpected key: ${key}`);
};

const bundled = await build({
  entryPoints: ["supabase/functions/delete-account/index.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "delete-account-test-boundary",
    setup(builder) {
      builder.onResolve({ filter: /^jsr:/ }, (args) => ({
        path: args.path, namespace: "edge-runtime-stub",
      }));
      builder.onLoad({ filter: /.*/, namespace: "edge-runtime-stub" }, () => ({
        contents: "export {};",
      }));
      builder.onResolve(
        { filter: /^npm:@supabase\/supabase-js@2\.116\.0\/cors$/ },
        () => ({ path: "cors", namespace: "supabase-test" }),
      );
      builder.onLoad({ filter: /^cors$/, namespace: "supabase-test" }, () => ({
        contents: 'export const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"};',
      }));
      builder.onResolve(
        { filter: /^npm:@supabase\/supabase-js@2\.116\.0$/ },
        () => ({ path: "client", namespace: "supabase-test" }),
      );
      builder.onLoad({ filter: /^client$/, namespace: "supabase-test" }, () => ({
        contents: "export const createClient = (url, key) => globalThis.__makeDeleteAccountClient(url, key);",
      }));
    },
  }],
});

await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`,
);

function makeFixture(overrides = {}) {
  return {
    user: { id: "client-user", email: "client@example.invalid" },
    userError: null,
    profile: {
      id: "client-user",
      email: "client@example.invalid",
      full_name: "Client User",
      role: "client",
    },
    profileError: null,
    memberships: [{
      id: "membership-1",
      client_account_id: "account-1",
      membership_status: "Active",
    }],
    membershipError: null,
    auditInsertError: null,
    deleteError: null,
    auditInserts: [],
    auditUpdates: [],
    deletedUserIds: [],
    ...overrides,
  };
}

async function invoke(headers = { Authorization: "Bearer test-jwt" }) {
  const response = await globalThis.__deleteAccountHandler(
    new Request("https://clinical-sos.test/functions/v1/delete-account", {
      method: "POST",
      headers,
    }),
  );
  return { response, body: await response.json() };
}

test("unauthenticated deletion is rejected", async () => {
  fixture = makeFixture();
  const { response, body } = await invoke({});
  assert.equal(response.status, 401);
  assert.deepEqual(body, { error: "Unauthorized" });
  assert.deepEqual(fixture.deletedUserIds, []);
});

test("non-client role cannot self-delete through the client endpoint", async () => {
  fixture = makeFixture({
    profile: {
      id: "staff-user",
      email: "staff@example.invalid",
      full_name: "Staff User",
      role: "admin",
    },
    user: { id: "staff-user", email: "staff@example.invalid" },
  });
  const { response } = await invoke();
  assert.equal(response.status, 403);
  assert.deepEqual(fixture.deletedUserIds, []);
  assert.deepEqual(fixture.auditInserts, []);
});

test("client self-delete is audited before deleting the authenticated user", async () => {
  fixture = makeFixture();
  const { response, body } = await invoke();

  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true });
  assert.deepEqual(fixture.deletedUserIds, ["client-user"]);
  assert.equal(fixture.auditInserts.length, 1);
  assert.equal(fixture.auditInserts[0].status, "Running");
  assert.equal(fixture.auditInserts[0].acting_user_id, "client-user");
  assert.equal(fixture.auditInserts[0].client_account_id, "account-1");
  assert.deepEqual(
    fixture.auditInserts[0].affected_record_ids,
    ["client-user", "membership-1"],
  );
  assert.equal(fixture.auditUpdates.at(-1).values.status, "Success");
  assert.equal(fixture.auditUpdates.at(-1).values.new_access_state, "Deleted");
});

test("audit failure blocks destructive deletion", async () => {
  fixture = makeFixture({
    auditInsertError: { message: "audit unavailable" },
  });
  const { response } = await invoke();

  assert.equal(response.status, 500);
  assert.deepEqual(fixture.deletedUserIds, []);
});

test("delete failure is recorded and reported", async () => {
  fixture = makeFixture({
    deleteError: { message: "auth delete failed" },
  });
  const { response } = await invoke();

  assert.equal(response.status, 500);
  assert.deepEqual(fixture.deletedUserIds, ["client-user"]);
  assert.equal(fixture.auditUpdates.at(-1).values.status, "Failed");
  assert.equal(fixture.auditUpdates.at(-1).values.new_access_state, "Deletion Failed");
});
