# Historical deployment source reconciliation — 2026-09-30

> **Historical record only.** This file preserves the provenance of the September 2026 Netlify source recovery. It is not active deployment guidance. Current deployment instructions are in `docs/production-deployment.md`.

## Provenance

- Netlify site: `83494837-a639-468e-a63c-dba7631b1e9a` (`clinical-sos`).
- Recovered published deploy: `6ab1aaf0118fa8990dfdf1e5`, uploaded 2026-09-21.
- Build: `6ab1aaf0118fa8990dfdf1e3`.
- The archive was downloaded using Netlify's authenticated source-download action.
- Archive SHA-256: `2F787928F9972C940D602C181916AD51AE8EEFE34D1BF0C8A5C23837DFEA0265`.
- At recovery time the Netlify site had no linked Git repository and empty build settings in site metadata.
- GitHub `main` at recovery was `d4de095c5b206443d207e58dfb22b49ad91bd1af`.

## Historical source divergence

The separately uploaded Netlify source had already moved to direct Supabase authentication, a Supabase data adapter, SQL migrations, and a same-origin consultation endpoint while the then-current GitHub line still contained the legacy application implementation. Replacing the deployed source with that older GitHub line would have regressed the Netlify site.

The recovery therefore preserved the deployed frontend and server function first, then reconciled later migration work into GitHub. That reconciliation was merged back to `main` in October 2026.

## Recovery verification

Recovery commit `0c61b15` passed locked dependency installation, lint, and the Vite production build. Draft deploy `6abd486134a64270b625668b` included the consultation function. Authenticated browser checks confirmed the home/contact routes rendered and that server-side form validation executed before database writes.

The recovery deploy was promoted on 2026-09-30 while Netlify visitor protection remained enabled. No DNS or database changes were made as part of that recovery operation.

## Superseded guidance

Any statements in the original recovery process about using a recovery branch, retaining a second runtime, or waiting for later portal/workflow migration are superseded. The current independent source of truth is GitHub `main` using Supabase + Netlify.
