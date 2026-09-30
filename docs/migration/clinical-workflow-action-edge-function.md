# clinical-workflow-action Edge Function

This JWT-protected Supabase Edge Function replaces four Base44 clinical/staff backend functions by delegating to existing transactional database RPCs:

- `transition_poc` → `clinical_transition_poc`
- `close_deficiency` → `clinical_close_deficiency`
- `create_engagement` → `clinical_create_engagement_from_opportunity`
- `update_revisit_readiness` → `clinical_update_revisit_readiness`

The Edge Function validates the Supabase user session and supplies the verified user UUID as `p_actor_id`. The database RPCs remain authoritative for:

- role authorization
- lifecycle/state-transition validation
- closure guardrails and overrides
- duplicate-engagement prevention
- proposal/opportunity linkage
- test-data propagation
- evidence-driven readiness calculation
- audit logging
- transactional consistency

The RPCs are not exposed directly to browser roles; the Edge Function uses a server-side credential after validating the user JWT.

Work-product generation is intentionally not included because the legacy Base44 function contains generation logic beyond the existing save RPC.
