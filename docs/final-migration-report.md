# Clinical SOS final migration and production-readiness report

Date: 2026-10-05/06  
Roadmap: #2  
Final phase: #8

## Executive status

The application source migration from Base44 to the independent GitHub + Supabase + Netlify stack is complete in the Phase 6 branch and validated by CI.

The codebase no longer requires the Base44 SDK, Base44 Vite plugin, Base44 browser client, Base44 server-function runtime, Base44 environment variables, `createClientFromRequest`, or `asServiceRole`.

Production **code readiness** is complete. Production **public exposure** is intentionally not declared complete because the latest GitHub source has not yet been published to the Netlify production site and that site remains protected by team SSO.

## Independent stack

### GitHub

Repository: `davidekissinger/clinical-sos`

`main` is the integration source of truth. Phase 5 removed the obsolete Base44 packages/configuration and made Netlify/Supabase deployment guidance authoritative.

### Supabase

Project: `htlyplekracwejhkhttu`

Supabase provides:

- authentication;
- PostgreSQL application data;
- RLS authorization;
- client account, membership, facility and engagement scope;
- protected clinical/business RPCs;
- authenticated portal Edge Functions;
- identity administration;
- work-product generation;
- lead intelligence;
- test-mode Stripe checkout/webhook integration;
- client self-service sign-in deletion.

### Netlify

Project: `clinical-sos`  
Site id: `83494837-a639-468e-a63c-dba7631b1e9a`  
Netlify origin: `https://clinical-sos.netlify.app`

Netlify provides the Vite frontend and the public same-origin consultation endpoint at `/api/consultations`.

## Phase 6 audit findings resolved

### Dead legacy consent page

`src/pages/OAuthConsent.jsx` was not routed by the application and referenced the retired consent/MCP bridge plus a missing legacy parameter module. It was deleted.

### Missing account deletion endpoint

The client Account page called `delete-account`, but no matching Edge Function was deployed.

Phase 6 adds `supabase/functions/delete-account/index.ts` and tests that prove:

- unauthenticated requests fail;
- non-client roles cannot use the client self-service deletion endpoint;
- an audit record is created before the destructive auth operation;
- audit failure blocks deletion;
- auth deletion failure is recorded rather than acknowledged as success.

The function was deployed to the production Supabase project as:

- slug: `delete-account`
- version: 1
- status: ACTIVE
- JWT verification: enabled

Supabase source readback matched the checked-in function exactly.

The UI now accurately states that self-service deletion removes the portal sign-in identity and membership, while operational, billing, regulatory, audit and clinical records may remain under their own retention requirements.

### Runtime dependency security

Unused runtime dependencies were removed:

- `moment`
- `jspdf`
- `react-quill-new`

`tailwindcss-animate` was moved to development dependencies.

React Router was upgraded from the vulnerable 6.x line to `react-router-dom 7.18.4`. The application remains in Declarative Mode and the existing route/build regression suite passes.

The final production-only audit:

```text
npm audit --omit=dev --audit-level=high
found 0 vulnerabilities
```

Development/build dependencies still produce advisory findings during the full `npm ci` audit. They are not part of the shipped browser/server runtime dependency set and remain a maintenance backlog rather than a hidden production-runtime finding.

## Authorization and tenant isolation

The Phase 3/6 validation establishes:

- all public application tables have RLS enabled;
- critical tenant/clinical tables have explicit policies;
- ordinary client users do not receive raw tenancy-table access;
- `profiles.role` is not browser-writable;
- cross-tenant task/evidence/POC mutations fail closed;
- denials retain non-disclosing behavior and auditability;
- privileged `SECURITY DEFINER` helpers audited during migration are not executable by browser roles.

## Server/runtime independence

Production server paths now execute independently through Supabase Edge Functions, Supabase RPCs, or the Netlify consultation function.

Default-branch runtime searches after merge should return no active:

- `@base44/sdk`
- `@base44/vite-plugin`
- `VITE_BASE44_*`
- `base44Client`
- `base44.functions`
- `base44.entities`
- `createClientFromRequest`
- `asServiceRole`

## Intentionally retained historical references

Text references to Base44 remain in historical migration documentation and applied SQL migration comments/helper names where renaming would destroy provenance or alter already-applied migration history.

Those historical references are not imports, packages, URLs, credentials, runtime calls, or deployment requirements.

Examples include historical migration documents describing what each independent replacement superseded and compatibility-oriented identifiers embedded in applied migration history.

## CI validation

The final Phase 6 branch validates:

- locked `npm ci`;
- advisory JavaScript typecheck backlog;
- runtime dependency audit;
- lint;
- backend routing tests;
- tenant-isolation/RLS tests;
- account-deletion tests;
- migration/RPC replay;
- production Vite build.

The final React Router/security run completed successfully with all blocking gates passing and zero runtime dependency vulnerabilities.

## Known external production gates

### 1. Latest GitHub source is not yet the published Netlify deploy

The currently published Netlify production deploy is:

`6ac2390da3e616be91ee1295`

It is `ready`, but Netlify identifies it as upload/API based with no Git commit association. It predates the final Phase 5/6 GitHub work.

The available Netlify connector in this environment can inspect deploys and visitor access but cannot create a new deploy from the current GitHub commit.

**Required production action:** publish the reviewed final `main` source to the existing Netlify project (or connect the project to GitHub and deploy `main`) before removing visitor protection.

### 2. Netlify visitor protection remains enabled

The site currently requires Netlify team SSO for all deploys.

This should remain in place until the final `main` commit is published and production acceptance checks pass.

### 3. Supabase leaked-password protection

Supabase Security Advisor reports leaked-password protection disabled.

This is an Auth-provider configuration hardening item and should be enabled before broad production user onboarding.

### 4. Historical public consultation Edge Function

Supabase still has the older `submit-consultation` Edge Function deployed without JWT verification because it was intentionally public.

The current frontend instead posts to the Netlify `/api/consultations` endpoint, which invokes the protected `ingest_consultation` RPC.

The older Edge Function should be retired after confirming no external integration still calls its Supabase URL. The available Supabase connector does not expose an Edge Function delete operation.

### 5. Stripe remains test-only

Checkout/webhook logic is intentionally guarded for Stripe test mode. Production live billing is not activated by this migration and requires separate explicit authorization, live secrets, and acceptance testing.

## Public-production acceptance sequence

1. Merge the reviewed Phase 6 PR to `main`.
2. Publish that exact `main` commit to Netlify project `clinical-sos`.
3. Confirm Netlify deploy state is `ready` and source/commit provenance matches.
4. Verify public marketing pages and SPA deep links.
5. Submit one controlled non-PHI consultation through `/api/consultations`.
6. Verify Supabase sign-in, password recovery, pending-user behavior and sign-out.
7. Verify staff authorization and client tenant-isolation with provisioned test accounts.
8. Verify `delete-account` with a disposable client test identity if destructive acceptance testing is approved.
9. Enable Supabase leaked-password protection.
10. Retire the old public Supabase consultation function after external-caller confirmation.
11. Only then remove Netlify SSO protection and/or attach the final public custom domain.

## Conclusion

The Base44 migration is complete at the source/runtime architecture level. The independent application is reproducibly buildable and tested as GitHub + Supabase + Netlify.

The remaining work is production release/exposure control, not another Base44 migration phase.
