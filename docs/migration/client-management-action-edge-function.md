# client-management-action Edge Function

Independent Supabase replacement for four Base44 client-administration functions:

- `manageClientMembership`
- `transitionClientAccess`
- `syncClientMembershipAccess`
- `updateClientBilling`

## Security model

- valid Supabase JWT required
- membership/access/sync operations require `admin`
- billing updates allow `admin` or `finance`
- actor role and name come from server-managed `public.profiles`
- supports Supabase profile UUIDs and mapped legacy Base44 user IDs
- no server credential is returned to the browser

## Membership invariants

The live database enforces:

- one active membership per Supabase user
- one open membership per user/account
- tenant-account consistency on membership rows
- facility/engagement scope validation through database triggers

The Edge Function also validates those rules before writes and reconciles normalized scope through the membership junction tables.

## Access synchronization

Unlike Base44's user-level facility/engagement arrays, Supabase keeps scope normalized in junction tables. Account suspension/termination therefore does not destroy scope rows; entitlement endpoints deny tenant data based on effective account status. Active membership sets the application profile role to `client`; when a client membership is suspended/revoked and no other active membership exists, a prior `client` role is returned to `pending`.

## Billing

Finance/admin callers can update only billing/subscription fields. The function may recommend an access-state change, but only the explicit admin `transition_access` action can change `access_status`.
