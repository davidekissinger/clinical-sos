# client-portal-action Edge Function

This function consolidates three Base44 client mutation endpoints into one independent, JWT-protected Supabase contract:

- `update_task` replaces `clientUpdateTask`
- `respond_evidence` replaces `clientRespondEvidence`
- `review_poc` replaces `clientReviewPOC`

Each action preserves:

- client role and exactly-one-active-membership requirements
- account access-state and restricted-capability behavior
- engagement-first tenant scoping
- client_visibility checks
- non-disclosing 404 responses for inaccessible records
- strict input allowlists
- strict database field update allowlists
- audit logging
- POC lifecycle protections that keep regulatory status unchanged

The function uses only server-side privileged credentials. The browser receives no secret key.
