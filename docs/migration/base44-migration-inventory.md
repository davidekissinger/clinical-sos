# Base44 Migration Inventory

Baseline captured from `main` on 2026-09-26 for GitHub issue #3.

This document is an inventory, not a deletion plan. Base44-dependent code should remain in place until the corresponding Supabase/Netlify replacement is implemented and verified.

## Baseline validation

The repository currently exposes these validation scripts:

- `npm run lint` -> `eslint . --quiet`
- `npm run typecheck` -> `tsc -p ./jsconfig.json`
- `npm run build` -> `vite build`

`package-lock.json` is committed, so CI can use `npm ci`.

The first CI run on PR #9 confirmed `npm ci` succeeds, but the existing codebase has a broad pre-migration typecheck backlog across command-center and portal JSX. Representative failures include inferred required props on shared presentational components, DOM event-target field inference, `unknown`/ `never` data shapes, and arithmetic on values inferred as non-numeric. These failures predate the migration branch and are not caused by the inventory or CI changes.

For Phase 1, typecheck and lint are therefore advisory so CI can continue far enough to exercise the production build. The production build remains blocking. Later phases should reduce this technical debt without hiding new build failures.

At the time of this inventory there was no committed `netlify.toml` on `main`. Netlify production configuration belongs to the later deployment phase rather than this baseline phase.

## 1. Frontend runtime dependencies

### Base44 SDK client

- `src/api/base44Client.js` imports `createClient` from `@base44/sdk`, constructs the browser Base44 client, and consumes app ID, access token, functions version, and Base44 app base URL.

### App parameter/bootstrap handling

- `src/lib/app-params.js` reads and persists Base44 URL/local-storage parameters.
- It consumes `VITE_BASE44_APP_ID`, `VITE_BASE44_FUNCTIONS_VERSION`, and `VITE_BASE44_APP_BASE_URL`.
- It also manages Base44 access-token state.

### Authentication

- `src/lib/AuthContext.jsx` imports the Base44 client, calls the Base44 public-settings endpoint, calls `base44.auth.me()`, and uses Base44 logout/login redirects.
- Direct Base44 auth usage also appears in `src/pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx`, `ResetPassword.jsx`, `OAuthConsent.jsx`, `src/pages/portal/Account.jsx`, and `src/lib/PageNotFound.jsx`.

### Entity/data access

Code search finds direct `base44.entities` usage in command-center, portal, hook, form, and dialog code. Representative paths include:

- `src/hooks/useEntities.js`
- `src/pages/cc/Leads.jsx`
- `src/pages/cc/Pipeline.jsx`
- `src/pages/cc/Tasks.jsx`
- `src/pages/cc/Settings.jsx`
- `src/pages/cc/ClientAccounts.jsx`
- `src/pages/cc/UserIdentityManagement.jsx`
- `src/pages/cc/Vendors.jsx`
- `src/pages/cc/VendorDetail.jsx`
- `src/pages/cc/VendorDashboard.jsx`
- `src/pages/portal/Subscription.jsx`

These calls must be replaced with Supabase table/RPC access only after the database schema and RLS model are in place.

### Server-function invocation from the frontend

Direct `base44.functions` usage appears across client-portal and command-center workflows including portal data, evidence, POCs, tasks, recovery, subscription, contact submission, identity management, memberships, and pipeline actions. Those callers depend on Phase 4 server-function replacements.

## 2. Server functions

Code search finds 26 Base44 server entry points using `createClientFromRequest`:

- `base44/functions/clientUpdateTask/entry.ts`
- `base44/functions/getMyIdentityProfile/entry.ts`
- `base44/functions/updateClientBilling/entry.ts`
- `base44/functions/clientRespondEvidence/entry.ts`
- `base44/functions/clientReviewPOC/entry.ts`
- `base44/functions/getClientPortalContext/entry.ts`
- `base44/functions/transitionClientAccess/entry.ts`
- `base44/functions/transitionPOC/entry.ts`
- `base44/functions/submitNameChangeRequest/entry.ts`
- `base44/functions/resolveClientEntitlement/entry.ts`
- `base44/functions/withdrawNameChangeRequest/entry.ts`
- `base44/functions/syncClientMembershipAccess/entry.ts`
- `base44/functions/createCheckoutSession/entry.ts`
- `base44/functions/closeDeficiency/entry.ts`
- `base44/functions/verifySignal/entry.ts`
- `base44/functions/scoreLead/entry.ts`
- `base44/functions/getClientPortalData/entry.ts`
- `base44/functions/stripeWebhook/entry.ts`
- `base44/functions/scoreLeadDual/entry.ts`
- `base44/functions/createEngagementFromOpportunity/entry.ts`
- `base44/functions/submitConsultation/entry.ts`
- `base44/functions/getClientPortalDetail/entry.ts`
- `base44/functions/manageUserIdentity/entry.ts`
- `base44/functions/manageClientMembership/entry.ts`
- `base44/functions/updateRevisitReadiness/entry.ts`
- `base44/functions/generateWorkProduct/entry.ts`

High-risk server paths that need explicit migration testing include Stripe checkout/webhooks, public consultation submission, portal access, membership/entitlement changes, identity workflows, clinical state transitions, lead scoring/signal verification, and work-product generation.

## 3. Shared authorization and service-role helpers

Base44 service-role behavior is embedded in shared code, especially:

- `base44/shared/clientEntitlements.ts`
- `base44/shared/identityUtils.ts`
- `base44/shared/testDataPropagation.ts`
- `base44/shared/roleAuth.ts`
- `base44/shared/clientDtos.ts`

`asServiceRole` is also used by many server functions. This is a migration blocker because Supabase service-role access must not become a browser-side substitute for Base44 service-role access.

The Phase 3 target is to move ordinary authorization into Supabase Auth plus PostgreSQL RLS, reserving service-role access for narrowly scoped trusted server execution.

## 4. Build and configuration dependencies

### NPM packages

`package.json` and `package-lock.json` currently depend on `@base44/sdk` and `@base44/vite-plugin`. Do not remove these in Phase 1 because current runtime code still requires them.

### Vite

`vite.config.js` imports `@base44/vite-plugin` and enables Base44-specific legacy SDK import support, HMR notification, navigation notification, analytics tracking, and the visual-edit agent.

### Base44 project config

`base44/config.jsonc` defines install, build, serve, and output settings for the Base44 project runtime.

### Documentation

`README.md` is currently Base44-first and instructs contributors to use the Base44 CLI/dashboard. `AGENTS.md` tells coding agents to prefer Base44 workflows and SDK patterns. These should be rewritten in Phase 5 after the independent stack works.

## 5. Data and authentication migration blockers

The migration cannot be completed by replacing imports alone. Supabase equivalents are required for:

1. Identity/session: Base44 token state, `base44.auth.me()`, login/logout redirects, and app public settings.
2. Authorization: roles, client entitlements, facility/engagement scope, non-disclosing denials, privileged execution, and audit logging.
3. Data API: Base44 entity CRUD/filter/list semantics, entity relationships, and test-data propagation.
4. Server execution: authenticated request context, privileged DB access, public submission, Stripe signature/idempotency handling, and server-side AI/work-product generation.
5. Deployment: Base44 Vite/runtime behavior, environment variables, function routing, and CLI/dashboard publishing.

## 6. Existing Supabase work

PR #1, **Add Supabase Auth federation**, introduces Supabase authentication while deliberately preserving Base44 SSO, roles, entities, and permissions.

That PR is useful prior work, but it is not the independent target architecture because Base44 remains in the runtime path. Phase 2 should reuse safe Supabase work where appropriate without treating Base44 federation as the final state.

## 7. Ordered retirement plan

Use the roadmap sequence from issue #2:

1. CI/build baseline and inventory - issue #3
2. frontend client and auth replacement - issue #4
3. authorization/tenant scope/RLS - issue #5
4. server-function migration - issue #6
5. Netlify/config/docs cleanup - issue #7
6. final Base44 eradication and production-readiness audit - issue #8

## Phase 1 completion boundary

Phase 1 intentionally does not remove Base44 behavior. Its purpose is to make later changes observable and reviewable.
