# Clinical workflow integration

Four recovered frontend callers referenced nonexistent per-action endpoints.
They now call the existing clinical-workflow-action function:

| Caller | Dispatch action |
| --- | --- |
| transitionPOC | transition_poc |
| closeDeficiency | close_deficiency |
| createEngagementFromOpportunity | create_engagement |
| updateRevisitReadiness | update_revisit_readiness |

The POC caller's action is moved to transition_action before dispatch; evidence
and revision notes are preserved. Other payloads retain their fields. Input is
not mutated, missing decisions are not defaulted, and server errors still reject.

The existing live function was recovered into source control. Only its CORS
definition changed to the pinned Supabase 2.116.0 SDK headers plus POST/OPTIONS.
JWT verification, authenticated actor derivation, and existing transactional
database RPCs remain unchanged.

Validation: 20 adapter regression tests, lint and production build; live
version 2 returns preflight 200 and unauthenticated POST 401, with matching
source readback. No clinical records were changed. Successful authenticated
workflows and role/lifecycle enforcement still need fixture-based acceptance
testing. This is a bounded integration into the Netlify recovery branch,
not completion of the full migration or a change to Base44 main.
