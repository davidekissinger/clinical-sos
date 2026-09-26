# get-client-portal-data Edge Function

Independent Supabase replacement for the Base44 `getClientPortalData` function.

## Scope

The endpoint supports the same client-portal resource names:

- dashboard
- engagements
- cases
- deficiencies
- pocs
- work_products
- documents
- evidence
- tasks
- audits
- readiness

## Security behavior

- requires a valid Supabase user JWT
- requires the server-managed `client` application role
- fails closed unless exactly one active client membership exists
- respects account suspension/termination and restricted capabilities
- resolves facility and engagement scope from normalized membership junction tables
- uses engagement-first tenant scoping with facility fallback only when no engagement relationship exists
- filters all non-engagement list resources to `client_visibility = true`
- suppresses internal POC and work-product lifecycle states
- applies explicit DTO allowlists before returning records
- capability-gates dashboard counts so unauthorized resource counts are not disclosed
- uses server-only Supabase credentials inside the Edge Function; no privileged credential is committed or returned

The React portal is not switched to this function in this PR.
