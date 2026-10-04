# Administrator user directory

The missing list-users endpoint blocked the identity directory and client
invitation picker. The new read-only function verifies the caller with getUser,
then reads their current server-managed profiles.role through own-profile RLS.
Only an admin can initialize the privileged directory query. Missing profiles,
non-admin roles and failures deny access. User metadata is never authorization.

Responses contain only id, email, full_name, role and the legacy created_date
alias. Requests accept allowlisted sorts and bounded integer pagination (up to
500 per page), with an id tie-breaker. Responses are marked no-store and errors
do not disclose database details. No auth user records or secrets are returned.

Invitation search now filters email and pending role on the server before
pagination, instead of searching only the latest 50 accounts in the browser.
SQL wildcard characters are escaped. The live role enum has pending but no
legacy user role. Search failures are visible and stale selections are cleared.

Validation: 52 tests exercise the actual adapter and function handler with
mocked network boundaries, including all non-admin roles, forged user metadata,
authentication failure, request bounds, result projection, sorting, eligibility,
wildcard escaping and database failures. Lint and production build pass.
Live deployment uses JWT verification and pinned Supabase 2.116.0 CORS headers.
No users, memberships or clinical records are created or changed by this work.
Authenticated end-to-end acceptance remains outstanding; handler tests do not
establish live role/RLS correctness.

References: [Supabase function authentication](https://supabase.com/docs/guides/functions/auth)
and [SDK CORS](https://supabase.com/docs/guides/functions/cors).
