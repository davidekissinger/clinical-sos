# Test checkout integration

The client subscription page previously called a missing checkout endpoint and
read subscription_tiers directly, although that table has staff-only policies.
The adapter now uses the existing stripe-checkout POST and its curated GET
catalog. Staff tier administration remains unchanged.

The recovered function uses pinned Supabase 2.116.0 SDK CORS headers and retains
JWT, client role, single active membership, account status and tier checks.
Checkout now rejects non-test Stripe keys before any Stripe call, enforcing
the existing frontend promise that live payments are not enabled. No Stripe
keys, prices, webhooks, memberships or payment configuration were changed.

Returning with a success query parameter no longer claims the subscription
has activated; the UI explains that confirmation is still required.

Tests exercise actual adapter and handler code with mocked external services:
catalog projection, ineligible callers, live/missing-key rejection, server
price/account selection, and checkout response handling. No Stripe sessions
or charges are created during testing. Full Stripe test-mode checkout/webhook
and authenticated client acceptance remain outstanding.
