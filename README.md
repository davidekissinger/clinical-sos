# Clinical SOS — recovered Netlify production source

This branch recovers the source archive of Netlify production deploy
`6ab1aaf0118fa8990dfdf1e5` (2026-09-21), site
`83494837-a639-468e-a63c-dba7631b1e9a`, https://clinical-sos.netlify.app.
The archive SHA-256 is recorded in `docs/deployment-recovery.md`.

The Netlify deployment was uploaded independently and had no Git repository
connection. GitHub `main` remains the Base44 application; this branch preserves
the existing Netlify application for comparison and reproducible builds.
Do not merge this recovery snapshot into main as a completed migration.

Run `npm ci`, configure the public Supabase build variables described in
`docs/supabase-auth.md`, and run `npm run build`.
The Netlify function `netlify/functions/submit-consultation.ts` owns
`/api/consultations`; it must be included whenever this frontend is deployed.
Server secrets must never be placed in browser-prefixed variables.

The original cutover notes in `docs/` describe remaining data import and
protected workflow prerequisites. Recovery does not complete those prerequisites.
