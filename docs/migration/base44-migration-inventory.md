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

Typecheck remains advisory in Phase 1 so CI can continue far enough to exercise the production build. Lint was initially advisory; after removing its 35 unused-import errors, lint is now blocking alongside dependency installation and the production build. Later phases should reduce the remaining typecheck debt without hiding new build failures.

### Verified CI evidence

[CI run 36255420887](https://github.com/davidekissinger/clinical-sos/actions/runs/36255420887) validated head `6197699f1fbdeeeff128fbda5a4b8b2d4976491f` on 2026-09-26. Its logs were reviewed on 2026-09-30:

| Check | Actual result | Phase 1 policy |
| --- | --- | --- |
| `npm ci` | Passed | Blocking |
| `npm run typecheck` | Failed; 250 TypeScript diagnostics in the job log | Advisory |
| `npm run lint` | Failed; 35 errors, 0 warnings | Advisory |
| `npm run build` | Passed | Blocking |

The historical lint failures were all unused imports. Typecheck failures include inferred required presentation props, unknown/never data shapes, DOM event fields, and numeric operations. At the recorded head, this PR contained only the workflow and inventory, establishing that these were pre-existing baseline findings.

The workflow reports `steps.<id>.outcome` in its job summary and emits a warning when the advisory typecheck fails. This records the actual result before `continue-on-error` changes the step conclusion to success. A green overall workflow means the blocking install, lint, and build checks passed; it does not claim a clean typecheck run. Full diagnostics remain in the job logs.

### Lint baseline cleanup

The follow-up removes 35 unused import bindings across 22 JSX files without changing JSX, event handlers, data access, or authentication. The removed direct Base44 import in `CaseDetail.jsx` was unused; that page still loads the same client through `useEntities`. No dependency, lint-rule, or lint-scope changes are included. The existing `npm run lint` command uses `--quiet`, so its success means no lint errors, not an absence of lower-severity warnings. Lint now blocks CI to prevent these errors from returning.

### Type declaration cleanup

Explicit JSDoc contracts for shared component props, forwarded DOM refs, form state, hook options, and the test-data context reduce the typecheck baseline from 250 to 66 diagnostics. Native React, Radix, input-otp, and variant types are reused where appropriate. Optional props reflect existing callers and runtime checks; required props remain checked. No compiler exclusions, `any` escape hatches, or diagnostic suppression comments were added.

The 15 changed source files were compiled before and after the annotations with the same esbuild settings; all produced identical JavaScript. Local lint and production build passed. The remaining diagnostics stay visible and advisory:

| Category | Diagnostics | Follow-up |
| --- | ---: | --- |
| Array response fallbacks | 13 | Reconcile legacy wrapped responses with SDK array return types. |
| Bootstrap storage/environment | 8 | Check the non-browser storage path and Vite environment declarations. |
| Date arithmetic | 8 | Make timestamp conversion explicit while preserving sorting semantics. |
| Empty-state callers | 12 | Reconcile callers passing `text`/`icon` with the component's `title` contract. |
| Named form controls | 12 | Type the submitted form and its named controls. |
| Portal outlet context | 9 | Define the entitlement context from the actual provider contract. |
| Agent SDK calls | 2 | Verify filter arguments and the asynchronous conversation result. |
| OAuth request headers | 1 | Type the headers object at the request boundary. |
| Account deletion SDK method | 1 | Verify the supported deletion contract before changing account behavior. |

Some remaining diagnostics identify potential runtime defects, not just missing annotations. Keep them visible until their behavior is verified rather than casting them away to make CI green.

There is no `test` script in the baseline package configuration. This phase establishes install, typecheck, lint, and build visibility; it does not claim automated end-to-end coverage or production readiness.

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
