# Clinical SOS production deployment

## Production target

- Netlify project: `clinical-sos`
- Site id: `83494837-a639-468e-a63c-dba7631b1e9a`
- Netlify origin: `https://clinical-sos.netlify.app`
- Application source of truth: GitHub `davidekissinger/clinical-sos` `main`
- Backend/auth project: Supabase `htlyplekracwejhkhttu`

As of 2026-10-05, Netlify reports the currently published deploy `6ac2390da3e616be91ee1295` as `ready`. That deploy was uploaded rather than associated with a Git commit. Netlify visitor access currently requires team SSO for all deploys.

## Build contract

`netlify.toml` is authoritative:

- Node 22
- build command: `npm run build`
- publish directory: `dist`
- functions directory: `netlify/functions`
- Vite SPA fallback: `/* -> /index.html` with status 200
- immutable caching for hashed assets
- no-cache revalidation for `index.html`
- baseline browser security headers

The consultation function declares its friendly route in code:

`POST /api/consultations`

## Required configuration

Public browser values:

```text
VITE_SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

Server-only Netlify Function values:

```text
SUPABASE_URL=https://htlyplekracwejhkhttu.supabase.co
SUPABASE_SECRET_KEY=<dedicated server secret>
```

Never commit the server secret or expose it through a browser-prefixed variable.

## Release procedure

1. Work on a branch and open a PR to `main`.
2. Require CI to pass: locked install, typecheck, lint, Node tests, migration/RLS replay, and Vite production build.
3. Merge only the reviewed PR.
4. Deploy the merged `main` source to the existing Netlify production project.
5. Confirm the deploy reports `ready` with the consultation function present.
6. Run the production acceptance checks below.
7. Only then remove visitor protection or attach/redirect a public custom domain.

The current Netlify project was last observed using upload/API deployments rather than a Git-associated deploy. Until a Git-based production pipeline is connected, a production deploy must be triggered explicitly from reviewed `main` source rather than assuming a GitHub merge automatically publishes.

## Production acceptance checks

- home, service, contact, login, and deep-linked SPA routes render;
- `POST /api/consultations` rejects malformed/oversized requests and accepts one controlled non-PHI test submission;
- Supabase sign-in/sign-out and password recovery use the production origin;
- pending users cannot enter protected application areas;
- staff/admin role boundaries remain enforced;
- client test users cannot read or mutate another tenant's records;
- required Supabase Edge Functions return authenticated responses and fail closed without JWTs;
- Stripe remains test-mode unless live billing has been separately approved;
- Supabase Security Advisor findings are reviewed.

## Visitor access

Netlify currently requires team SSO for all deploys. Removing that protection makes the public marketing/login surface internet-accessible and is intentionally treated as a separate production exposure step after the acceptance checks.
