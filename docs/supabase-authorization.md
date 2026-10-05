# Supabase authorization and tenant-isolation baseline

Phase 3 roadmap issue: #5

This document records the authorization boundary verified against the current ClinicalSOS `main` line and the live Supabase project on 2026-10-05. It is a security baseline, not a request to broaden browser access.

## Current architecture

ClinicalSOS no longer has active default-branch references to the Base44 browser SDK, Base44 auth, Base44 entity APIs, Base44 server-function invocation, `asServiceRole`, `createClientFromRequest`, or the former shared Base44 authorization helpers.

Authentication is Supabase-backed. Application role decisions come from server-managed `public.profiles.role`; user-editable auth metadata is not an authorization source.

Client portal access is intentionally mediated by authenticated Supabase Edge Functions. Raw client tenancy and clinical tables are not exposed directly to ordinary client users.

## Live RLS verification

The live Supabase project was inspected with the read-only queries in:

`supabase/audit/authorization_rls.sql`

Results observed on 2026-10-05:

- every table in the exposed `public` schema has RLS enabled;
- the core client-tenancy tables each have explicit staff/admin policies;
- no audited policy was trivially permissive with `true`;
- no audited policy used deprecated `auth.role()`;
- `profiles` permits an authenticated user to read their own row;
- browser update privilege on `profiles` is restricted to `full_name`; the server-managed `role` column is not browser-writable;
- privileged `SECURITY DEFINER` helpers inspected in `public` and `private` are not executable by `anon`, `authenticated`, or `PUBLIC`.

The one RLS-enabled table with zero policies is `public.stripe_webhook_events`. That is intentional deny-by-default behavior for a server-only idempotency table; its privileged claim/completion RPCs are also not directly executable by browser roles.

## Tenant boundary

The raw tenancy model remains staff/admin-facing:

- `client_accounts`
- `client_memberships`
- `client_membership_facilities`
- `client_membership_engagements`

Client-facing reads and mutations use server-side entitlement resolution. The Edge Functions derive the authenticated user from the supplied JWT, load the server-managed client profile and active membership, resolve account status and effective capabilities, and limit facilities/engagements to the membership scope.

The client portal action boundary returns the same non-disclosing `404 Record not found or unavailable` response for missing records, hidden records, missing capabilities, and out-of-scope records.

## Automated isolation coverage

`tests/client-portal-authorization.test.mjs` exercises the checked-in `client-portal-action` source while replacing only network/database calls with deterministic fixtures.

It proves:

- a non-client role fails closed;
- a client cannot mutate a task from another engagement/tenant scope;
- a client cannot respond to evidence from another engagement/tenant scope;
- a client cannot review a POC from another engagement/tenant scope;
- denied attempts retain audit logging;
- a same-tenant, visible task with the required capability can still be updated.

The positive control is important: the suite demonstrates authorization discrimination rather than merely proving that all writes fail.

## External hardening advisory

Supabase Security Advisor currently reports **Leaked Password Protection Disabled**. That setting is an Auth-provider hardening option and is not a code/RLS migration blocker, but it should be enabled before broad production user onboarding.

The advisor also reports `stripe_webhook_events` as RLS-enabled with no policy. As noted above, that is intentional server-only deny-by-default design and should not be "fixed" by adding browser policies.

## Review boundary

This Phase 3 subset does not:

- create or alter production users;
- change memberships, roles, facilities, engagements, or client records;
- change RLS policies or grants;
- expose a service-role/secret key to frontend code;
- broaden client access to raw tenant tables;
- merge its own pull request.

Any future policy change should rerun the checked-in audit and the isolation test suite before merge.
