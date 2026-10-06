# Clinical SOS

Clinical SOS is an independent GitHub + Supabase + Netlify application.

## Production architecture

- **Source control:** GitHub `davidekissinger/clinical-sos`; `main` is the integration source of truth.
- **Frontend:** React/Vite, built by Netlify with `npm run build` and published from `dist`.
- **Authentication and data:** Supabase Auth, PostgreSQL/RLS, RPCs, and authenticated Edge Functions.
- **Public consultation intake:** Netlify Function `netlify/functions/submit-consultation.ts` at `/api/consultations`, backed by the protected Supabase `ingest_consultation` RPC.
- **Production Netlify project:** `clinical-sos` — site id `83494837-a639-468e-a63c-dba7631b1e9a`.

The legacy application runtime and build tooling have been retired from active source and deployment configuration.

## Local validation

Use Node 22.

```bash
npm ci
npm run typecheck
npm run lint
node --test tests/*.test.mjs
npm run build
```

GitHub CI runs these checks for pull requests targeting `main`.

## Environment

Browser configuration:

```text
VITE_SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Server-only consultation intake:

```text
SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
SUPABASE_SECRET_KEY=<Netlify function secret>
```

Never commit a Supabase secret/service-role key or place it in a `VITE_*` variable.

The browser client has a checked-in project URL and publishable-key fallback so the frontend can build reproducibly. Server secrets remain Netlify-managed only.

## Deployment

`netlify.toml` defines the production build, publish directory, SPA routing, security headers, asset caching, Node version, and functions directory.

See:

- `docs/production-deployment.md` — current production release procedure and validation gates.
- `docs/supabase-auth.md` — authentication, redirect, and environment configuration.
- `docs/supabase-authorization.md` — RLS and tenant-isolation boundary.
- `docs/deployment-recovery.md` — historical source-recovery provenance only.

Do not treat historical migration/recovery notes as active deployment instructions.
