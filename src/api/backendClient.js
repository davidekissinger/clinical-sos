import { supabase } from "@/api/supabaseClient";

const ENTITY_TABLE = Object.freeze({
  AuditTool: "audit_tools",
  AutomationLog: "automation_logs",
  ClientAccount: "client_accounts",
  ClientMembership: "client_memberships",
  ConsultationRequest: "consultation_requests",
  Contact: "contacts",
  Deficiency: "deficiencies",
  EducationPlan: "education_plans",
  Engagement: "engagements",
  EvidenceItem: "evidence_items",
  Facility: "facilities",
  Interaction: "interactions",
  LaunchReadinessCheck: "launch_readiness_checks",
  Lead: "leads",
  LeadEngineConfig: "lead_engine_configs",
  Opportunity: "opportunities",
  Organization: "organizations",
  OutreachSequence: "outreach_sequences",
  OutreachTemplate: "outreach_templates",
  POC: "pocs",
  Proposal: "proposals",
  QAPIReview: "qapi_reviews",
  RegulatoryCase: "regulatory_cases",
  RegulatoryKnowledge: "regulatory_knowledge",
  RegulatorySignal: "regulatory_signals",
  RevisitReadinessCriterion: "revisit_readiness_criteria",
  Source: "sources",
  SubscriptionTier: "subscription_tiers",
  Suppression: "suppressions",
  Task: "tasks",
  UserIdentityAuditEvent: "user_identity_audit_events",
  UserIdentityProfile: "user_identity_profiles",
  UserNameChangeRequest: "user_name_change_requests",
  Vendor: "vendors",
  VendorEvaluation: "vendor_evaluations",
  VendorEvaluationItem: "vendor_evaluation_items",
  VendorPerformanceImprovementPlan: "vendor_performance_improvement_plans",
  VendorRelationship: "vendor_relationships",
  WorkProduct: "work_products",
});

const FUNCTION_SLUG = Object.freeze({
  clientRespondEvidence: "client-respond-evidence",
  clientReviewPOC: "client-review-poc",
  clientUpdateTask: "client-update-task",
  closeDeficiency: "close-deficiency",
  createCheckoutSession: "create-checkout-session",
  createEngagementFromOpportunity: "create-engagement-from-opportunity",
  generateWorkProduct: "generate-work-product",
  getClientPortalContext: "get-client-portal-context",
  getClientPortalData: "get-client-portal-data",
  getClientPortalDetail: "get-client-portal-detail",
  getMyIdentityProfile: "get-my-identity-profile",
  manageClientMembership: "manage-client-membership",
  manageUserIdentity: "manage-user-identity",
  submitNameChangeRequest: "submit-name-change-request",
  syncClientMembershipAccess: "sync-client-membership-access",
  transitionClientAccess: "transition-client-access",
  transitionPOC: "transition-poc",
  updateRevisitReadiness: "update-revisit-readiness",
  withdrawNameChangeRequest: "withdraw-name-change-request",
});

function selectFields(fields) {
  if (!fields) return "*";
  return Array.isArray(fields) ? fields.join(",") : fields;
}

function applySort(query, sort) {
  if (!sort || typeof sort !== "string") return query;
  const descending = sort.startsWith("-");
  const field = sort.replace(/^[+-]/, "");
  if (!field) throw new Error("A sort field is required.");
  return query.order(field, { ascending: !descending });
}

function applyFilters(query, filters = {}) {
  let next = query;

  for (const [field, value] of Object.entries(filters)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const operators = Object.keys(value);
      if (operators.length !== 1 || operators[0] !== "$ne") {
        throw new Error(`Unsupported filter operator for ${field}.`);
      }

      const excluded = value.$ne;
      if (field === "is_test_data" && excluded === true) {
        // Legacy records may not have the flag. Treat NULL as non-test data.
        next = next.or("is_test_data.neq.true,is_test_data.is.null");
      } else if (excluded === null) {
        next = next.not(field, "is", null);
      } else {
        next = next.neq(field, excluded);
      }
    } else if (value === null) {
      next = next.is(field, null);
    } else {
      next = next.eq(field, value);
    }
  }

  return next;
}

function throwIfError(error) {
  if (!error) return;
  const message = error.message || "The Clinical SOS data request failed.";
  const normalized = new Error(message);
  normalized.code = error.code;
  normalized.details = error.details;
  normalized.status = error.status;
  throw normalized;
}

async function selectRows(table, filters, sort, limit, skip = 0, fields) {
  let query = supabase.from(table).select(selectFields(fields));
  query = applyFilters(query, filters);
  query = applySort(query, sort);

  if (Number.isFinite(limit)) {
    const offset = Number.isFinite(skip) ? Math.max(0, skip) : 0;
    query = query.range(offset, offset + Math.max(0, limit) - 1);
  }

  const { data, error } = await query;
  throwIfError(error);
  return data || [];
}

function entityClient(table) {
  return {
    list(sort, limit, skip = 0, fields) {
      return selectRows(table, {}, sort, limit, skip, fields);
    },
    filter(filters, sort, limit, skip = 0, fields) {
      return selectRows(table, filters, sort, limit, skip, fields);
    },
    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .single();
      throwIfError(error);
      return data;
    },
    async create(values) {
      const { data, error } = await supabase
        .from(table)
        .insert(values)
        .select("*")
        .single();
      throwIfError(error);
      return data;
    },
    async update(id, values) {
      const { data, error } = await supabase
        .from(table)
        .update(values)
        .eq("id", id)
        .select("*")
        .single();
      throwIfError(error);
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(table).delete().eq("id", id);
      throwIfError(error);
      return { success: true };
    },
  };
}

const entityCache = new Map();

const entities = new Proxy(
  {},
  {
    get(_target, entityName) {
      if (entityName === "then" || typeof entityName !== "string") return undefined;

      if (entityName === "User") {
        return {
          list: async (sort, limit, skip = 0) => {
            const rows = await invokeFunction("list-users", { sort, limit, skip });
            return Array.isArray(rows) ? rows : rows?.users || [];
          },
        };
      }

      const table = ENTITY_TABLE[entityName];
      if (!table) throw new Error(`Unsupported Clinical SOS entity: ${entityName}`);
      if (!entityCache.has(entityName)) entityCache.set(entityName, entityClient(table));
      return entityCache.get(entityName);
    },
  },
);

async function functionError(error, slug) {
  let message = error?.message || `The ${slug} function failed.`;
  let details = null;

  try {
    const context = error?.context;
    if (context && typeof context.clone === "function") {
      details = await context.clone().json();
      if (details?.error) message = details.error;
    }
  } catch {
    // The Functions client may not expose a JSON response body.
  }

  const normalized = new Error(message);
  normalized.status = error?.context?.status;
  normalized.data = details;
  return normalized;
}

async function invokeFunction(nameOrSlug, payload = {}) {
  const slug = FUNCTION_SLUG[nameOrSlug] || nameOrSlug;
  const { data, error } = await supabase.functions.invoke(slug, { body: payload });
  if (error) throw await functionError(error, slug);
  return data;
}

const unsupportedAgentOperation = () =>
  Promise.reject(new Error("AI conversations are not available until their Supabase migration is deployed."));

export const backend = {
  entities,
  functions: {
    invoke(name, payload) {
      const slug = FUNCTION_SLUG[name];
      if (!slug) throw new Error(`Unsupported Clinical SOS function: ${name}`);
      return invokeFunction(slug, payload);
    },
  },
  auth: {
    async deleteAccount() {
      const result = await invokeFunction("delete-account", {});
      await supabase.auth.signOut({ scope: "local" });
      return result;
    },
  },
  agents: {
    listConversations: unsupportedAgentOperation,
    createConversation: unsupportedAgentOperation,
    subscribeToConversation() {
      return () => {};
    },
    addMessage: unsupportedAgentOperation,
  },
  // Analytics migration is intentionally no-op until a consent-aware endpoint
  // is deployed. It must never send form content or reject a user action.
  analytics: {
    track() {
      return Promise.resolve({ success: true });
    },
  },
};
