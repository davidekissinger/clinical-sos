# Deployment source reconciliation — 2026-09-30

## Provenance

- Netlify site: `83494837-a639-468e-a63c-dba7631b1e9a` (`clinical-sos`).
- Published deploy: `6ab1aaf0118fa8990dfdf1e5`, uploaded 2026-09-21.
- Build: `6ab1aaf0118fa8990dfdf1e3`.
- Archive downloaded using Netlify's authenticated **Download source code** action.
- Archive SHA-256: `2F787928F9972C940D602C181916AD51AE8EEFE34D1BF0C8A5C23837DFEA0265`.
- Netlify site had no linked Git repository and empty build settings in its site metadata.
- GitHub main at recovery: `d4de095c5b206443d207e58dfb22b49ad91bd1af`, following Phase 1 merge `bdc3f85`.

## Why the sources differed

GitHub main and the Base44 preview run the Base44 application. The separately
uploaded Netlify source already has direct Supabase authentication, a Supabase
data adapter, SQL migrations, and a same-origin consultation endpoint.
Its `Contact.jsx` posts to `/api/consultations`; the corresponding Netlify
function invokes the `ingest_consultation` database RPC. GitHub main instead
invokes Base44 `submitConsultation`. Replacing the Netlify frontend with main
would therefore regress the deployment and omit its server function.

The Supabase Edge Function in PR #17 is another implementation. Its CORS fix
does not affect the recovered Netlify frontend, which uses the same-origin
Netlify function. Retain that live contract until a deliberate, tested switch.

## Recovery scope

This branch preserves the recovered source (excluding generated `dist`),
retains the Phase 1 CI workflow, and adds provenance/setup documentation.
Any lint-only cleanup is limited to unused imports. No database migrations,
production deployment, DNS, access controls, or environment values were changed
by source recovery. The local checkout is linked to the existing Netlify site.

## Integration boundary

This is a recovery baseline, not a completed migration or a replacement for
the currently active Base44 main branch. Protected workflows and data import
remain subject to the original `supabase-auth.md` launch prerequisites.
Use this source when preparing Netlify builds, and reconcile existing migration
PRs against it before enabling a Git-based production pipeline.
