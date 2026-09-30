# Client portal action integration

The recovered frontend called three nonexistent per-action endpoints. The
adapter now targets the existing `client-portal-action` function from PR #15.

| Caller | Dispatch action | Payload adaptation |
| --- | --- | --- |
| clientUpdateTask | update_task | Preserve task_id, status, completion_note |
| clientRespondEvidence | respond_evidence | Preserve evidence_id, response_status, note |
| clientReviewPOC | review_poc | Move caller action to review_action; preserve poc_id and comment |

The POC caller's `action` means acknowledge, request_revision, or client_approve.
It must not be overwritten before being mapped to `review_action`. The adapter
does not default a missing decision to approval and does not mutate input.
Generic server errors remain thrown so existing optimistic UI rollback works.

The deployed function source was recovered and its CORS headers upgraded to
the pinned Supabase 2.116.0 SDK definition. Business logic is unchanged: client
role, single active membership, account status, capabilities, engagement scope,
visibility, and POC lifecycle checks remain server-side. JWT verification
remains enabled. POC regulatory lifecycle status is not changed by client review.

Validation: 14 adapter regression tests, lint, and production build pass.
The tests cover identity compatibility, all three portal actions and POC
decisions, action override prevention, missing decisions, unchanged responses,
and generic access-denial propagation. Live function version 2 returned 200
for SDK preflight and 401 without authentication; source readback matched.
No client records were changed. Successful authenticated mutations and tenant
isolation still require acceptance testing with provisioned client fixtures.

This subset targets the Netlify production recovery branch. Base44 main and
the remaining clinical, management, billing, user-list and account-deletion
integration work are unchanged.
