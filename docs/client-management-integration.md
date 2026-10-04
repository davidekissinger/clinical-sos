# Client management integration

The recovered frontend referenced three nonexistent endpoints. It now calls
the existing client-management-action function.

| Caller | Dispatch action | Adaptation |
| --- | --- | --- |
| manageClientMembership | manage_membership | Move action to membership_action |
| syncClientMembershipAccess | sync_membership | Preserve membership_id |
| transitionClientAccess | transition_access | Preserve access and override fields |

Membership creation, capability updates, activation, suspension and revocation
retain their caller decisions and scopes. Missing decisions are not defaulted;
false capabilities and empty scopes remain explicit. Errors continue to reject.

The live function was recovered into source control. Only CORS changes to the
pinned Supabase 2.116.0 SDK headers plus POST/OPTIONS. Existing admin role checks,
tenant validation and business logic are unchanged; JWT verification stays on.

Validation includes adapter regression tests, lint, production build, live
preflight and unauthenticated rejection, and deployed source readback.
No memberships, roles or account access were changed during verification.
Authenticated administration and tenant isolation require acceptance testing.
The invitation user picker still depends on the separate, missing list-users
endpoint; this routing subset does not complete that invitation flow.
