# Edge Function source reconciliation

The Netlify/Supabase recovery work left three active client-portal Edge Functions deployed in Supabase but absent from the reconciled `main` branch.

This reconciliation restores the exact live source read back from Supabase for:

- `get-client-portal-context` — live version 1
- `get-client-portal-data` — live version 1
- `get-client-portal-detail` — live version 1

These functions are actively referenced by `src/api/backendClient.js` and remain part of the authenticated client-portal path.

No function is redeployed by this source-reconciliation commit itself, and no production data or credentials are changed.

## Consultation intake

The old Supabase `submit-consultation` function remains deployed, but the current application uses the independent Netlify endpoint at `/api/consultations` backed by the same protected Supabase intake RPC.

Because the Netlify implementation is now the authoritative production caller, the older Supabase function is not restored as an active source dependency in this reconciliation. It can be retired separately after confirming no external caller still uses its URL.

## Historical PRs

Earlier PRs #12, #13, and #14 introduced the portal Edge Functions from an older pre-reconciliation branch. Their deployed behavior is preserved here by restoring the exact current live source onto the modern `main` line instead of merging 39-commit-stale branches.

PR #17 is superseded for the production consultation route by the Netlify implementation.
