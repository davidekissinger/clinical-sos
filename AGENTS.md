# AGENTS.md

## Stack

Clinical SOS uses GitHub + Supabase + Netlify.

- React/Vite frontend
- Supabase Auth, PostgreSQL/RLS, RPCs, and Edge Functions
- Netlify static hosting and serverless consultation intake
- Node 22

## Rules for automated changes

- Treat `main` as the integration source of truth.
- Never introduce the retired legacy SDK, build plugin, runtime variables, or project configuration.
- Never commit Supabase secret/service-role keys, Stripe secret keys, Netlify tokens, passwords, or other credentials.
- Browser code may use only Supabase publishable credentials.
- Preserve tenant, facility, engagement, role, capability, and non-disclosing denial boundaries.
- Raw client-tenancy/clinical tables must not be exposed directly to ordinary client users as a shortcut around server authorization.
- Prefer existing Supabase RPC/Edge Function contracts and the Netlify consultation endpoint over duplicating business logic.
- Schema/authorization changes require migration replay and RLS/isolation tests.
- Production deployment configuration belongs in `netlify.toml`; secrets belong in provider-managed environment variables.

## Validation

Before opening or merging a PR:

```bash
npm ci
npm run typecheck
npm run lint
node --test tests/*.test.mjs
npm run build
```

Do not merge a failing production build or failing authorization/tenant-isolation tests.
