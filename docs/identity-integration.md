# Identity frontend integration

The recovered Netlify frontend called four nonexistent function slugs.
The adapter now uses the contracts already implemented in migration PRs #16
and #21:

| Existing caller | Deployed function | Body action |
| --- | --- | --- |
| getMyIdentityProfile | identity-self-service | get_profile |
| submitNameChangeRequest | identity-self-service | submit_change |
| withdrawNameChangeRequest | identity-self-service | withdraw_change |
| manageUserIdentity | identity-admin-action | Existing admin action, unchanged |

Self-service actions are fixed by caller name and cannot be overridden by
payload fields. Response bodies and error propagation remain unchanged.
The backend retains its JWT, administrator-role, ownership, and self-action
checks. No role or schema changes are part of this integration.

The checked-in Edge Function sources were read from the deployed versions,
then updated only to import SDK CORS headers pinned to supabase-js 2.116.0,
while retaining their existing HTTP method allowlists. Both were deployed as
version 2 with JWT verification enabled; readback exactly matched the source.

Validation: seven regression tests exercise the actual frontend adapter with
only its Supabase network boundary mocked. They cover all four callers,
payload immutability, action override prevention, forbidden errors, unrelated
portal calls, and rejection of unknown names. Lint and production build pass.
Live OPTIONS returned 200 with all requested SDK headers; unauthenticated POST
returned 401 for both functions. No identity records were changed in these tests.
Authenticated profile reads and successful identity mutations still need
acceptance testing with provisioned application accounts.

This change targets the Netlify recovery branch. GitHub main and the Base44
runtime remain separate. Other consolidated function routes, missing list-users
and delete-account endpoints, Stripe activation, and remaining migration work
are outside this subset.


## Client self-service deletion

The client account page now calls the JWT-protected `delete-account` Supabase Edge Function. It is client-role only, records an audit event before the destructive auth operation, and deletes only the authenticated sign-in identity plus profile/membership rows that cascade from it. Operational, audit, billing, regulatory, and clinical records retain their independent retention behavior.
