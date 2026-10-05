import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

let currentFixture = null;

function makeQuery(table, fixture) {
  let operation = "select";
  let mutation = null;
  const filters = {};

  const resolve = () => {
    if (operation === "update") {
      fixture.mutations.push({ table, operation, mutation, filters: { ...filters } });
      return { data: null, error: null };
    }

    if (operation === "insert") {
      fixture.mutations.push({ table, operation, mutation });
      return { data: null, error: null };
    }

    const dataByTable = {
      profiles: fixture.profile,
      client_memberships: fixture.memberships,
      client_accounts: fixture.account,
      client_membership_engagements: fixture.engagementScope,
      tasks: fixture.records.tasks,
      evidence_items: fixture.records.evidence_items,
      pocs: fixture.records.pocs,
    };

    return { data: dataByTable[table] ?? null, error: null };
  };

  const query = {
    select() {
      operation = "select";
      return query;
    },
    update(values) {
      operation = "update";
      mutation = values;
      return query;
    },
    insert(values) {
      operation = "insert";
      mutation = values;
      return query;
    },
    eq(column, value) {
      filters[column] = value;
      return query;
    },
    order() {
      return Promise.resolve(resolve());
    },
    maybeSingle() {
      return Promise.resolve(resolve());
    },
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolve()).then(onFulfilled, onRejected);
    },
  };

  return query;
}

function makeAdminClient(fixture) {
  return {
    from(table) {
      return makeQuery(table, fixture);
    },
  };
}

globalThis.Deno = {
  env: {
    get(name) {
      if (name === "SUPABASE_URL") return "https://clinical-sos.test";
      if (name === "SUPABASE_PUBLISHABLE_KEYS") {
        return JSON.stringify({ default: "public-test" });
      }
      if (name === "SUPABASE_SECRET_KEYS") {
        return JSON.stringify({ default: "secret-test" });
      }
      return null;
    },
  },
  serve(handler) {
    globalThis.__clientPortalHandler = handler;
  },
};

globalThis.__makeSupabaseClient = (key) => {
  if (key === "public-test") {
    return {
      auth: {
        getUser: async () => ({
          data: { user: currentFixture.user },
          error: null,
        }),
      },
    };
  }

  if (key === "secret-test") {
    return makeAdminClient(currentFixture);
  }

  throw new Error(`Unexpected Supabase key: ${key}`);
};

const bundled = await build({
  entryPoints: ["supabase/functions/client-portal-action/index.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  plugins: [
    {
      name: "supabase-edge-test-boundary",
      setup(builder) {
        builder.onResolve({ filter: /^jsr:/ }, (args) => ({
          path: args.path,
          namespace: "edge-runtime-stub",
        }));
        builder.onLoad({ filter: /.*/, namespace: "edge-runtime-stub" }, () => ({
          contents: "export {};",
        }));

        builder.onResolve(
          { filter: /^npm:@supabase\/supabase-js@2\.116\.0\/cors$/ },
          () => ({ path: "supabase-cors", namespace: "supabase-test" }),
        );
        builder.onLoad(
          { filter: /^supabase-cors$/, namespace: "supabase-test" },
          () => ({
            contents:
              'export const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info"};',
          }),
        );

        builder.onResolve(
          { filter: /^npm:@supabase\/supabase-js@2\.116\.0$/ },
          () => ({ path: "supabase-client", namespace: "supabase-test" }),
        );
        builder.onLoad(
          { filter: /^supabase-client$/, namespace: "supabase-test" },
          () => ({
            contents:
              "export const createClient = (_url, key) => globalThis.__makeSupabaseClient(key);",
          }),
        );
      },
    },
  ],
});

await import(
  `data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`
);

assert.equal(typeof globalThis.__clientPortalHandler, "function");

function fixture(overrides = {}) {
  return {
    user: { id: "client-a", email: "client-a@example.invalid" },
    profile: {
      id: "client-a",
      email: "client-a@example.invalid",
      full_name: "Client A",
      role: "client",
    },
    memberships: [
      {
        id: "membership-a",
        client_account_id: "account-a",
        membership_status: "Active",
        can_login: true,
        can_complete_tasks: true,
        can_submit_evidence: true,
        can_review_poc: true,
        can_approve_poc: true,
        created_date: "2026-01-01T00:00:00Z",
      },
    ],
    account: {
      id: "account-a",
      access_status: "Active",
      manual_access_override: "None",
      manual_override_expiration: null,
    },
    engagementScope: [{ engagement_id: "engagement-a" }],
    records: {
      tasks: null,
      evidence_items: null,
      pocs: null,
    },
    mutations: [],
    ...overrides,
  };
}

async function invoke(body) {
  const response = await globalThis.__clientPortalHandler(
    new Request("https://clinical-sos.test/functions/v1/client-portal-action", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-jwt",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );

  return {
    response,
    body: await response.json(),
  };
}

test("non-client roles fail closed without exposing whether a target record exists", async () => {
  currentFixture = fixture({
    profile: {
      id: "staff-a",
      email: "staff-a@example.invalid",
      full_name: "Staff A",
      role: "admin",
    },
    user: { id: "staff-a", email: "staff-a@example.invalid" },
  });

  const { response, body } = await invoke({
    action: "update_task",
    task_id: "task-foreign",
    status: "Complete",
  });

  assert.equal(response.status, 404);
  assert.deepEqual(body, { error: "Record not found or unavailable" });
  assert.equal(
    currentFixture.mutations.some((entry) => entry.table === "tasks"),
    false,
  );
});

for (const scenario of [
  {
    name: "task",
    table: "tasks",
    body: {
      action: "update_task",
      task_id: "task-b",
      status: "Complete",
      completion_note: "Attempted cross-tenant change",
    },
    record: {
      id: "task-b",
      linked_engagement_id: "engagement-b",
      client_visibility: true,
      status: "In Progress",
    },
  },
  {
    name: "evidence",
    table: "evidence_items",
    body: {
      action: "respond_evidence",
      evidence_id: "evidence-b",
      response_status: "Prepared",
      note: "Attempted cross-tenant change",
    },
    record: {
      id: "evidence-b",
      engagement_id: "engagement-b",
      client_visibility: true,
      client_response_status: "Pending",
    },
  },
  {
    name: "POC",
    table: "pocs",
    body: {
      action: "review_poc",
      poc_id: "poc-b",
      review_action: "acknowledge",
      comment: "Attempted cross-tenant change",
    },
    record: {
      id: "poc-b",
      engagement_id: "engagement-b",
      client_visibility: true,
      status: "Client Review",
      client_review_status: "Pending",
    },
  },
]) {
  test(`cross-tenant ${scenario.name} mutation is denied with a non-disclosing response`, async () => {
    const base = fixture();
    base.records[scenario.table] = scenario.record;
    currentFixture = base;

    const { response, body } = await invoke(scenario.body);

    assert.equal(response.status, 404);
    assert.deepEqual(body, { error: "Record not found or unavailable" });
    assert.equal(
      currentFixture.mutations.some(
        (entry) => entry.table === scenario.table && entry.operation === "update",
      ),
      false,
    );
    assert.equal(
      currentFixture.mutations.some(
        (entry) =>
          entry.table === "automation_logs" && entry.operation === "insert",
      ),
      true,
      "denial should remain auditable",
    );
  });
}

test("same-tenant visible task with capability granted can be updated", async () => {
  const base = fixture();
  base.records.tasks = {
    id: "task-a",
    linked_engagement_id: "engagement-a",
    client_visibility: true,
    status: "In Progress",
  };
  currentFixture = base;

  const { response, body } = await invoke({
    action: "update_task",
    task_id: "task-a",
    status: "Complete",
    completion_note: "Completed by authorized client",
  });

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.task_id, "task-a");
  assert.equal(body.status, "Complete");

  const taskUpdate = currentFixture.mutations.find(
    (entry) => entry.table === "tasks" && entry.operation === "update",
  );
  assert.ok(taskUpdate);
  assert.equal(taskUpdate.filters.id, "task-a");
  assert.equal(taskUpdate.mutation.status, "Complete");
});
