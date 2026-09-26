# get-client-portal-detail Edge Function

Independent Supabase replacement for Base44 `getClientPortalDetail`.

Supported detail resources:

- `engagement`
- `case`
- `deficiency`

Security behavior is intentionally conservative:

- valid Supabase user JWT required
- server-managed client role and exactly one active membership required
- engagement-first tenant scope with facility fallback only when no engagement relationship exists
- inaccessible, unpublished, foreign-tenant, and nonexistent records all return the same generic 404
- actual denial reasons are logged internally on a best-effort basis
- child resources are capability-gated
- internal POC/work-product lifecycle states remain hidden
- every returned record is reduced to an explicit client-safe DTO allowlist
- server-only Supabase credentials never leave the Edge Function

The React client is not switched to this endpoint in this PR.
