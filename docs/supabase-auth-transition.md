# Supabase authentication transition

ClinicalSOS is moving from Base44 authentication to Supabase Auth, but the migration must preserve the existing private application while Base44-backed data and server functions are still being retired.

## Current dependency boundary

The command center and client portal currently call Base44 entities and Base44 server functions from the browser. Those requests rely on a valid Base44 application session. Supabase currently has **no deployed Edge Functions**, so removing the Base44 session before the server-function migration would break authenticated workflows.

For that reason, this phase adds the direct Supabase browser client and a direct-auth service layer **without activating a hard cutover yet**.

## Supabase project

- Project ref: `htlyplekracwejhkhttu`
- Browser client: `src/api/supabaseClient.js`
- Auth service: `src/lib/supabaseAuth.js`
- Application profiles: `public.profiles`
- New profiles default to role `pending`
- A database trigger on `auth.users` creates/synchronizes the matching application profile.

The browser uses only the publishable key. A service-role or secret key must never be exposed in frontend code.

## Authorization boundary

`public.profiles.role` is the application authorization source. Auth user metadata is not trusted for roles or permissions.

Current database policy allows an authenticated user to select only their own profile. The browser therefore can resolve the current user's display identity and server-managed role without granting the user permission to assign a role.

## Direct-auth functions prepared by this phase

`src/lib/supabaseAuth.js` provides:

- email/password sign-in
- Google OAuth sign-in
- email/password sign-up
- password-reset email
- password update
- local-session sign-out
- authenticated user + application-profile hydration
- auth-state subscription

These functions use the current Supabase PKCE browser client.

## Cutover prerequisites

Do **not** make direct Supabase Auth the sole production session until the following are true:

1. Base44 entity access used by private pages is migrated to Supabase tables/RPCs protected by RLS.
2. Base44 server functions used by private pages are migrated to Supabase Edge Functions or another independent trusted server runtime.
3. Client entitlement checks no longer depend on a Base44-authenticated function call.
4. Account deletion and other privileged operations have trusted server-side replacements.
5. Production redirect URLs are configured in Supabase for the final Netlify domain.
6. Integration tests confirm pending, staff, and client users cannot cross authorization boundaries.

Until then, the existing production auth/session behavior remains unchanged.

## Relevant Supabase security rules

- Use a publishable key in the browser, never a service-role/secret key.
- Keep authorization in server-managed profile/app metadata or RLS, not user-editable metadata.
- Keep RLS enabled for exposed application tables.
- Treat `TO authenticated` as authentication only; policies still require row/tenant predicates.
