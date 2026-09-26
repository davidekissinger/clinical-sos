# Supabase authorization and RLS audit

Baseline captured from the live ClinicalSOS Supabase project on 2026-09-26 for GitHub issue #5.

This audit is a security baseline, not an instruction to broaden browser access. The existing private application still depends on Base44-authenticated server functions, so client-facing Supabase exposure should remain deny-by-default until equivalent server contracts exist.

## Project state

- Supabase project: `htlyplekracwejhkhttu`
- Project status: active/healthy
- Public application tables have RLS enabled.
- New application profiles default to role `pending`.
- An `auth.users` trigger creates/synchronizes the corresponding `public.profiles` row.
- `public.profiles.role` is server-managed application authorization data.
- Browser authorization must not rely on user-editable auth metadata.

## Profiles

`public.profiles` currently permits authenticated users to select only their own row.

The browser role has SELECT on `profiles` but does not have an UPDATE grant. This means a signed-in user can hydrate their own server-managed role without being able to self-assign that role through normal browser access.

## Staff-facing tables

Staff-facing application tables grant table-level CRUD to `authenticated`, with RLS policies carrying the effective authorization boundary.

Representative policy patterns use `has_app_role(...)` or an equivalent `profiles` role lookup to restrict operations by role. There were no trivially permissive `true` policies and no use of deprecated `auth.role()` in the audited policies.

Examples:

- `client_accounts`: staff SELECT; admin/finance UPDATE; admin INSERT/DELETE.
- `facilities`: staff SELECT; admin/business-development/clinical INSERT+UPDATE; admin DELETE.
- `engagements`: staff SELECT; admin/clinical INSERT; admin/clinical/finance UPDATE; admin DELETE.
- `regulatory_cases`, `deficiencies`, `pocs`, `evidence_items`, and `work_products`: clinical/admin mutation with read-only access where explicitly allowed.
- `automation_logs` and identity-administration tables: admin-only policies.

Because broad table grants are paired with RLS, any future schema/policy change must be reviewed as an authorization change, not merely a database change.

## Client-tenancy boundary

The current raw tenancy tables are intentionally staff-only:

- `client_accounts`
- `client_memberships`
- `client_membership_facilities`
- `client_membership_engagements`

No audited policy gives an ordinary client user raw-table access to those records.

That is compatible with the existing Base44 design, where client portal access is mediated through server functions and safe DTOs. It also means the client portal cannot be switched to direct Supabase table reads without adding a carefully scoped server/RPC contract.

## Privileged functions

The audit found privileged `SECURITY DEFINER` helpers, but none were executable by `anon`, `authenticated`, or `PUBLIC`:

- private profile synchronization/validation helpers
- Stripe webhook claim/completion helpers
- consultation intake helper
- `rls_auto_enable()`

The only audited public helper executable by `authenticated` is `has_app_role(app_role[])`, which is used by RLS policies.

Clinical workflow RPCs such as POC transitions, deficiency closure, engagement creation, revisit readiness, and generated work-product persistence are currently not executable by browser roles.

## RLS-without-policy finding

`public.stripe_webhook_events` has RLS enabled with no policies.

This is consistent with a server-only deny-by-default table because browser roles have no usable policy path and the related privileged RPCs are not executable by browser roles. Do not add browser policies merely to silence the informational advisor finding.

## Current blocker to final auth cutover

Direct Supabase Auth can authenticate users, but private client functionality still depends on Base44 server functions that resolve entitlement and return scoped DTOs.

A safe independent replacement needs one of the following:

1. Supabase Edge Functions that validate the Supabase JWT and enforce tenant/facility/engagement scope server-side; or
2. narrowly scoped RPCs that expose only the intended client DTOs and enforce authorization internally without broadening raw-table access.

Until that contract exists, keep client raw-table policies staff-only.

## Phase 3 next implementation target

Build and test the independent entitlement/server DTO boundary before activating Supabase-only authentication:

- resolve the current user's active `client_memberships`
- validate client-account access state
- resolve authorized facility and engagement IDs
- calculate effective capabilities
- expose only client-safe DTOs
- preserve non-disclosing denial behavior
- add tests proving cross-tenant isolation
- keep service-role/privileged credentials out of browser code

