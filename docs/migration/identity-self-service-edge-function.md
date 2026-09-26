# identity-self-service Edge Function

Independent Supabase replacement for three Base44 authenticated identity functions:

- `getMyIdentityProfile`
- `submitNameChangeRequest`
- `withdrawNameChangeRequest`

Actions:

- GET or `get_profile`: return only user-safe identity/profile/request fields
- `submit_change`: validate and create a pending name/credential change request
- `withdraw_change`: allow only the requesting user to withdraw a pending request

Security and behavior:

- valid Supabase JWT required
- supports both normalized Supabase profile UUIDs and legacy user IDs
- server-side validation preserves reserved-name and credential rules
- prevents duplicate pending requests
- returns user-safe DTOs and strips reviewer/decision details
- writes immutable identity audit events
- uses server-only privileged credentials; no secret is exposed to the browser
