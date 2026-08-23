import { createClientFromRequest } from 'npm:@base44/sdk@0.8.42';
import { syncClientUserAuthorization, auditAccessChange } from "../../shared/clientEntitlements.ts";

// Stripe webhook signature verification
async function verifyStripeSignature(payload, signature, secret) {
  // Import Stripe's signature verification using Web Crypto API
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Parse the Stripe signature header: t=1234567890,v1=abc123
  const parts = signature.split(',');
  let timestamp = null;
  let v1Sig = null;
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    if (k === 'v1') v1Sig = v;
  }

  if (!timestamp || !v1Sig) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
  const expectedHex = Array.from(new Uint8Array(expectedSig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  if (expectedHex.length !== v1Sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ v1Sig.charCodeAt(i);
  }
  return diff === 0;
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  // Read raw body for signature verification
  const payload = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!webhookSecret || !signature) {
    return Response.json({ error: 'Missing webhook secret or signature' }, { status: 400 });
  }

  let event;
  try {
    const isValid = await verifyStripeSignature(payload, signature, webhookSecret);
    if (!isValid) {
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }
    event = JSON.parse(payload);
  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    return Response.json({ error: 'Signature verification failed' }, { status: 400 });
  }

  // ── Idempotency: check if this Stripe event ID was already processed ──
  const stripeEventId = event.id;
  if (stripeEventId) {
    try {
      const existing = await base44.asServiceRole.entities.AutomationLog.filter({
        triggered_by: `stripe_event:${stripeEventId}`,
        status: 'Success'
      });
      const existingList = Array.isArray(existing) ? existing : (existing?.data || []);
      if (existingList.length > 0) {
        // Duplicate delivery — acknowledge silently without reprocessing
        return Response.json({ received: true, duplicate: true });
      }
    } catch (_idempotencyErr) { /* non-blocking — proceed with processing */ }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const clientAccountId = session.client_reference_id || session.metadata?.client_account_id;
        const tierKey = session.metadata?.tier_key;
        const tierName = session.metadata?.tier_name;

        if (!clientAccountId) {
          console.error('checkout.session.completed: No client_account_id in metadata');
          break;
        }

        // Retrieve the subscription to get full details
        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
          headers: {
            'Authorization': `Bearer ${Deno.env.get('STRIPE_SECRET_KEY')}`,
            'Stripe-Version': '2025-10-29.clover'
          }
        });
        const subscription = await subRes.json();

        const startDate = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString();
        const renewalDate = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
        const endDate = subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null;

        await base44.asServiceRole.entities.ClientAccount.update(clientAccountId, {
          subscription_status: 'Active',
          subscription_plan: tierName || tierKey || 'Unknown',
          subscription_start_date: startDate,
          subscription_renewal_date: renewalDate,
          subscription_end_date: endDate,
          billing_status: 'Paid'
        });

        // Update membership capabilities if tier_id is present
        const tierId = session.metadata?.tier_id;
        if (tierId) {
          const tier = await base44.asServiceRole.entities.SubscriptionTier.get(tierId);
          if (tier) {
            const memberships = await base44.asServiceRole.entities.ClientMembership.filter({ client_account_id: clientAccountId });
            for (const m of memberships) {
              if (m.membership_status === 'Active') {
                const updateData = {};
                for (const cap of tier.included_capabilities || []) {
                  if (cap in m) updateData[cap] = true;
                }
                if (Object.keys(updateData).length > 0) {
                  await base44.asServiceRole.entities.ClientMembership.update(m.id, updateData);
                }
              }
            }
          }
        }

        await auditAccessChange(base44, {
          client_account_id: clientAccountId,
          previous_access_state: 'N/A',
          new_access_state: 'Active',
          reason: `Subscription activated: ${tierName || tierKey} (Stripe sub: ${session.subscription})`,
          triggering_source: 'stripeWebhook:checkout.session.completed',
          acting_user_id: 'system',
          acting_user_name: 'System — Stripe Webhook'
        });
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const clientAccountId = invoice.metadata?.client_account_id || invoice.subscription_details?.metadata?.client_account_id;

        if (clientAccountId) {
          const renewalDate = invoice.lines?.data?.[0]?.period?.end
            ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
            : null;

          await base44.asServiceRole.entities.ClientAccount.update(clientAccountId, {
            subscription_status: 'Active',
            billing_status: 'Paid',
            subscription_renewal_date: renewalDate,
            past_due_since: null,
            grace_period_end: null
          });

          await auditAccessChange(base44, {
            client_account_id: clientAccountId,
            previous_access_state: 'N/A',
            new_access_state: 'Active',
            reason: `Invoice paid: ${invoice.id}`,
            triggering_source: 'stripeWebhook:invoice.paid',
            acting_user_id: 'system',
            acting_user_name: 'System — Stripe Webhook'
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const clientAccountId = invoice.metadata?.client_account_id || invoice.subscription_details?.metadata?.client_account_id;

        if (clientAccountId) {
          await base44.asServiceRole.entities.ClientAccount.update(clientAccountId, {
            billing_status: 'Past Due',
            subscription_status: 'Past Due',
            past_due_since: new Date().toISOString()
          });

          await auditAccessChange(base44, {
            client_account_id: clientAccountId,
            previous_access_state: 'Active',
            new_access_state: 'Past Due',
            reason: `Invoice payment failed: ${invoice.id}`,
            triggering_source: 'stripeWebhook:invoice.payment_failed',
            acting_user_id: 'system',
            acting_user_name: 'System — Stripe Webhook'
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const clientAccountId = subscription.metadata?.client_account_id;

        if (clientAccountId) {
          const startDate = subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : null;
          const renewalDate = subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
          const endDate = subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : null;

          let subStatus = 'Active';
          if (subscription.status === 'past_due') subStatus = 'Past Due';
          else if (subscription.status === 'canceled') subStatus = 'Cancelled';
          else if (subscription.status === 'unpaid') subStatus = 'Past Due';
          else if (subscription.status === 'incomplete_expired') subStatus = 'Expired';

          await base44.asServiceRole.entities.ClientAccount.update(clientAccountId, {
            subscription_status: subStatus,
            subscription_start_date: startDate,
            subscription_renewal_date: renewalDate,
            subscription_end_date: endDate
          });

          // If subscription was cancelled or expired, sync user authorization
          if (subscription.status === 'canceled' || subscription.status === 'incomplete_expired') {
            const memberships = await base44.asServiceRole.entities.ClientMembership.filter({ client_account_id: clientAccountId });
            const activeMembership = (memberships || []).find(m => m.membership_status === 'Active');
            if (activeMembership) {
              await syncClientUserAuthorization(base44, activeMembership, 'Restricted', activeMembership.membership_status);
            }
          }

          await auditAccessChange(base44, {
            client_account_id: clientAccountId,
            previous_access_state: 'N/A',
            new_access_state: subStatus,
            reason: `Subscription updated: ${subscription.status} (Stripe sub: ${subscription.id})`,
            triggering_source: 'stripeWebhook:customer.subscription.updated',
            acting_user_id: 'system',
            acting_user_name: 'System — Stripe Webhook'
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const clientAccountId = subscription.metadata?.client_account_id;

        if (clientAccountId) {
          await base44.asServiceRole.entities.ClientAccount.update(clientAccountId, {
            subscription_status: 'Cancelled',
            subscription_end_date: new Date().toISOString(),
            billing_status: 'Past Due'
          });

          const memberships = await base44.asServiceRole.entities.ClientMembership.filter({ client_account_id: clientAccountId });
          const activeMembership = (memberships || []).find(m => m.membership_status === 'Active');
          if (activeMembership) {
            await syncClientUserAuthorization(base44, activeMembership, 'Suspended', activeMembership.membership_status);
          }

          await auditAccessChange(base44, {
            client_account_id: clientAccountId,
            previous_access_state: 'Active',
            new_access_state: 'Suspended',
            reason: `Subscription deleted: ${subscription.id}`,
            triggering_source: 'stripeWebhook:customer.subscription.deleted',
            acting_user_id: 'system',
            acting_user_name: 'System — Stripe Webhook'
          });
        }
        break;
      }

      default:
        // Unhandled event type — acknowledge silently
        break;
    }

    // ── Record successful processing for idempotency ──
    if (stripeEventId) {
      try {
        await base44.asServiceRole.entities.AutomationLog.create({
          automation: `Stripe Webhook — ${event.type}`,
          started: new Date().toISOString(),
          completed: new Date().toISOString(),
          status: 'Success',
          triggered_by: `stripe_event:${stripeEventId}`,
          reason: `Processed Stripe event: ${stripeEventId} (${event.type})`,
          acting_user_id: 'system',
          acting_user_name: 'System — Stripe Webhook',
        });
      } catch (_logErr) { /* non-blocking */ }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('stripeWebhook processing error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}