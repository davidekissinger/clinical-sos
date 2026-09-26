# identity-admin-action Edge Function

Independent Supabase replacement for Base44 `manageUserIdentity`.

Supported admin actions:

- init
- verify
- approve_request
- deny_request
- change_credentials
- suspend
- retire
- reactivate

Security and behavior:

- valid Supabase JWT required
- server-managed `admin` role required
- self-initialization, verification, approval/denial, credential change, suspension, retirement and reactivation remain prohibited
- supports Supabase profile UUIDs and mapped legacy Base44 user IDs
- preserves display-name/credential validation
- preserves documented approval/denial reasons
- duplicate verified display names generate a non-blocking warning
- identity state changes and request decisions write immutable audit events
- privileged Supabase credentials remain server-side

Together with `identity-self-service`, this replaces both user-facing and administrator-facing Base44 identity workflows.
