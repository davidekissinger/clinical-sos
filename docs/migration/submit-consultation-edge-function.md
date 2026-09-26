# submit-consultation Edge Function

Independent public Supabase replacement for Base44 `submitConsultation`.

The function is intentionally public (no user JWT) because the website contact form is unauthenticated. It implements custom HTTP-boundary abuse controls and then invokes the locked-down server-only `public.ingest_consultation` RPC with a server-side Supabase credential.

## HTTP-boundary controls

- POST only
- honeypot field with silent-success bot handling
- minimum 3-second form-load time gate
- client IP normalization
- no secret/client-internal data returned

## Database contract

The existing `ingest_consultation` RPC performs:

- required-field validation
- consent enforcement
- email validation
- urgency allowlist validation
- input-length caps
- atomic 10-minute email/IP rate limiting
- lead scoring/tiering
- consultation record creation
- contact email deduplication/upsert
- opportunity creation
- inbound interaction logging
- follow-up task creation
- partial-failure audit logging

The RPC is not executable by anonymous/authenticated/public database roles; only the Edge Function's server credential can invoke it.
