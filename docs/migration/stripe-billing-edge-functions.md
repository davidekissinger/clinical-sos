# Stripe billing Edge Functions

This migration replaces Base44 subscription checkout/webhook handling with two Supabase Edge Functions.

## stripe-checkout

JWT-protected client endpoint that:

- returns a client-safe active tier catalog on GET
- validates exactly one active client membership
- creates Stripe subscription checkout sessions on POST
- uses server-side `STRIPE_SECRET_KEY`
- writes checkout-initiation audit logs
- removes the need for the client UI to read raw `subscription_tiers`

## stripe-webhook

Public webhook endpoint with custom Stripe signature verification:

- requires `STRIPE_WEBHOOK_SECRET`
- enforces a 5-minute signature timestamp tolerance
- uses the atomic `claim_stripe_webhook_event` / `complete_stripe_webhook_event` RPCs for durable idempotency/retry state
- updates client subscription/billing state for checkout, invoice and subscription lifecycle events
- applies included tier capabilities to active memberships
- records audit events
- marks cancelled subscriptions suspended at the client-account level

## Required external secrets

The function source is deployable without committing credentials, but successful Stripe runtime operation requires these Supabase Edge Function secrets:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Those values cannot be read or copied from Base44 through the available connectors and must exist in Supabase before live checkout/webhook traffic is cut over.

## October 4 integration boundary

PR #29 already supplied the checkout implementation and client catalog routing;
this integration preserves that source unchanged and selectively restores the
webhook from #20. Both checkout and webhook reject live Stripe keys. The webhook
also requires `livemode: false`, checks every database result, returns retryable
errors for in-progress claims or failed persistence, and only acknowledges an
event after its completion RPC succeeds.

Tests use locally signed fixture events and mocked Stripe/network boundaries;
no payment sessions or production records are created. Activation, credentials,
Stripe endpoint configuration and full signed-in acceptance are separate from
repository integration. A source merge does not update the existing deployed
function. The webhook's writes span multiple requests; retries may repeat audit
entries after a partial failure, so this is durable retry handling, not an
atomic transaction across all billing and entitlement updates.
