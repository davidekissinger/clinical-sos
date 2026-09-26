# get-client-portal-context Edge Function

This function is the first independent replacement for a Base44 client-facing server function.

It reproduces the security-sensitive behavior of `base44/functions/getClientPortalContext` against the normalized Supabase tenancy schema.

## Security properties

- requires a valid Supabase user JWT
- resolves current identity through Supabase Auth
- reads application role from server-managed `public.profiles.role`
- keeps raw tenancy tables inaccessible to browser roles
- uses a server-only Supabase secret/service-role key inside the Edge Function
- fails closed if more than one active client membership exists
- preserves account suspension/termination behavior
- applies restricted-mode capability reductions
- returns allowlisted facility and engagement DTO fields only
- filters engagement results to `client_visibility = true`
- never returns raw membership scope tables or privileged credentials
- logs membership conflicts and expired manual overrides on a best-effort basis

## Deployment

The hosted Edge Function receives Supabase default environment variables. No secret value is committed to the repository.

The deployment requires JWT verification.

## Migration boundary

This function does not yet switch the React client portal from Base44. The caller should be migrated only after the direct Supabase Auth path and the remaining portal server functions have compatible independent replacements.
