import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { auditAccessChange } from "../../shared/clientEntitlements.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'client') return Response.json({ error: 'Forbidden — client role required' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { tier_id } = body;
    if (!tier_id) return Response.json({ error: 'tier_id is required' }, { status: 400 });

    // Fetch the subscription tier
    const tier = await base44.asServiceRole.entities.SubscriptionTier.get(tier_id);
    if (!tier || !tier.is_active) {
      return Response.json({ error: 'Subscription tier not found or inactive' }, { status: 404 });
    }

    // Resolve the client's entitlement to find their ClientAccount
    const memberships = await base44.asServiceRole.entities.ClientMembership.filter({ client_user_id: user.id });
    const activeMembership = (memberships || []).find(m => m.membership_status === 'Active');
    if (!activeMembership) {
      return Response.json({ error: 'No active client membership found' }, { status: 403 });
    }

    const account = await base44.asServiceRole.entities.ClientAccount.get(activeMembership.client_account_id);
    if (!account) {
      return Response.json({ error: 'Client account not found' }, { status: 404 });
    }

    // Determine success and cancel URLs
    const origin = req.headers.get('origin') || 'https://clinical-sos-sync.base44.app';
    const successUrl = `${origin}/client/subscription?status=success`;
    const cancelUrl = `${origin}/client/subscription?status=cancelled`;

    // Build checkout session parameters
    const params = {
      mode: 'subscription',
      line_items: [{ price: tier.stripe_price_id, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: account.id,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        client_account_id: account.id,
        client_user_id: user.id,
        tier_id: tier.id,
        tier_key: tier.tier_key,
        tier_name: tier.tier_name
      },
      subscription_data: {
        metadata: {
          base44_app_id: Deno.env.get('BASE44_APP_ID'),
          client_account_id: account.id,
          tier_id: tier.id,
          tier_key: tier.tier_key
        }
      }
    };

    // Encode parameters for Stripe API
    const formBody = new URLSearchParams();
    formBody.append('mode', params.mode);
    formBody.append('success_url', params.success_url);
    formBody.append('cancel_url', params.cancel_url);
    formBody.append('client_reference_id', params.client_reference_id);
    for (const [k, v] of Object.entries(params.metadata)) {
      formBody.append(`metadata[${k}]`, String(v));
    }
    for (const [k, v] of Object.entries(params.subscription_data.metadata)) {
      formBody.append(`subscription_data[metadata][${k}]`, String(v));
    }
    formBody.append('line_items[0][price]', params.line_items[0].price);
    formBody.append('line_items[0][quantity]', String(params.line_items[0].quantity));

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
        'Stripe-Version': '2025-10-29.clover',
        'Idempotency-Key': crypto.randomUUID(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody
    });

    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error('Stripe checkout session error:', session.error?.message);
      return Response.json({ error: session.error?.message || 'Failed to create checkout session' }, { status: 400 });
    }

    // Audit the checkout initiation
    await auditAccessChange(base44, {
      client_account_id: account.id,
      previous_access_state: 'N/A',
      new_access_state: 'Checkout Initiated',
      reason: `Checkout session created for tier: ${tier.tier_name} (${tier.annual_price}/yr)`,
      triggering_source: 'createCheckoutSession',
      acting_user_id: user.id,
      acting_user_name: user.full_name || user.email
    });

    return Response.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    });
  } catch (error) {
    console.error('createCheckoutSession error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}