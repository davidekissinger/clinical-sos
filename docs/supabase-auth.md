# Supabase Auth production configuration

Clinical SOS authenticates directly with Supabase. The application does not use a second application session or an external authentication bridge.

## Runtime flow

1. `/login`, `/register`, `/forgot-password`, and `/reset-password` call Supabase Auth directly from the browser.
2. `AuthContext` validates the Supabase user and loads the matching `public.profiles` row.
3. Application authorization comes from server-managed `profiles.role`; Supabase `user_metadata` is never trusted for authorization.
4. New users receive the `pending` role and are sent to `/access-pending` until a trusted server-side process provisions access.
5. Client tenant/facility/engagement scope is resolved by authenticated server functions; raw tenant and clinical tables are not exposed directly to ordinary client users.

The migrations in `supabase/migrations` install the profile trigger, RLS policies, tenancy schema, clinical schema, and protected RPCs. Migration replay and authorization assertions run in CI.

## Netlify environment

Set these public build variables for the production site and approved deploy previews:

```text
VITE_SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Publishable keys are intended for browser use. Never place a Supabase secret or service-role key in a `VITE_*` variable.

The same-origin consultation endpoint requires function-only variables:

```text
SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
SUPABASE_SECRET_KEY=<dedicated Netlify server secret>
```

`SUPABASE_SECRET_KEY` must remain server-side and secret. The browser never receives it.

## Redirect URLs

Configure Supabase Authentication URL Configuration with:

- **Site URL:** the final production origin.
- **Redirect allow list:** the exact production origin, explicitly approved Netlify preview origins, and the local development origin used by the team.

Registration returns to `/login`; password recovery returns to `/reset-password`. Both preserve a validated same-origin `returnTo` path.

## Current migration status

Direct Supabase authentication, RLS/tenant isolation, portal server functions, clinical workflows, identity administration, work-product generation, lead intelligence, test-mode billing integration, and Netlify consultation intake are represented in the independent source tree.

The public consultation form posts to `/api/consultations`. The Netlify Function validates and sanitizes input, then invokes the service-only `ingest_consultation` transaction for rate limiting, contact deduplication, and CRM fan-out.

## Production acceptance gates

Before removing Netlify visitor protection or assigning a custom public domain:

1. deploy the reviewed `main` commit to the production Netlify project;
2. confirm production Supabase redirect URLs and Netlify server secrets;
3. verify public marketing routes and SPA deep links;
4. complete one non-PHI consultation test through `/api/consultations`;
5. verify sign-in, password recovery, pending-user behavior, and sign-out;
6. verify staff role boundaries and client tenant isolation with provisioned test accounts;
7. verify Stripe remains test-mode unless a separate live-billing authorization is approved;
8. review the Supabase Security Advisor, including leaked-password protection.

Visitor-access changes are a separate production exposure decision and should occur only after these gates pass.
