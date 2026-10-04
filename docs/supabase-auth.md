# Supabase Auth cutover

Clinical SOS authenticates directly with Supabase. Base44 SSO, Base44 sessions,
and the Supabase OAuth-server bridge are not part of the target architecture.

## Runtime flow

1. `/login`, `/register`, `/forgot-password`, and `/reset-password` call
   Supabase Auth directly from the browser.
2. `AuthContext` validates the Supabase user and loads the matching
   `public.profiles` row.
3. Application authorization comes from `profiles.role`, which browser users
   cannot change. Supabase `user_metadata` is never used for authorization.
4. New users receive the `pending` role and are sent to `/access-pending`
   until a trusted server-side process provisions access.

Run the migrations in `supabase/migrations` before testing authentication.
The profile migration installs the new-user trigger, self-read RLS policy, and
server-owned role field.

## Netlify environment

Set these public build variables for the production site and deploy previews:

```text
VITE_SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Publishable keys are intended for browser use. Never place a Supabase secret
or service-role key in a `VITE_` variable.

The same-origin consultation endpoint also requires these function-only
variables:

```text
SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
SUPABASE_SECRET_KEY=your_dedicated_server_secret
```

`SUPABASE_SECRET_KEY` must be scoped to Netlify Functions/runtime and marked as
secret. The browser never receives it.

## Redirect URLs

After the Netlify site exists, set Supabase Authentication URL Configuration to:

- Site URL: the final Netlify or custom production origin
- Redirect allow list: the exact production origin, approved Netlify preview
  origins, and the local development origin used by the team

Registration returns to `/login`; password recovery returns to
`/reset-password`. Both preserve a validated same-origin `returnTo` path.

## Migration status

Direct authentication, Netlify build configuration, the browser-side data
client, and the Supabase schemas/RLS policies are in place. The migrated schema
uses text primary keys so existing record IDs can be imported without breaking
relationships. Client users receive no direct access to raw tenant or clinical
tables; portal data must continue through capability-aware server functions.

The public consultation form now posts to the Netlify Function at
`/api/consultations`. That function validates and sanitizes input, then invokes
the service-role-only `ingest_consultation` transaction for rate limiting,
contact deduplication, and CRM fan-out.

Before launch, export and import the Base44 records, deploy the remaining
protected workflow/portal/billing functions, configure the Netlify server
secret, provision the first Supabase administrator, and complete acceptance
tests. Keep the existing service available and do not cut over custom DNS until
those checks pass on the protected Netlify site.
