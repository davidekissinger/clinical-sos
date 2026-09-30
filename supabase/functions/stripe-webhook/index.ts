import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!legacy) throw new Error("Supabase server key unavailable");
  return legacy;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload: string, header: string, secret: string) {
  const parts = header.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!timestamp || !signatures.length) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const raw = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const expected = Array.from(new Uint8Array(raw)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((sig) => timingSafeEqual(expected, sig));
}

async function audit(admin: ReturnType<typeof createClient>, values: Record<string, unknown>) {
  const now = new Date().toISOString();
  await admin.from("automation_logs").insert({
    automation: "Client Access Change",
    started: now,
    completed: now,
    status: "Success",
    acting_user_id: "system",
    acting_user_name: "System — Stripe Webhook",
    manual_override: false,
    affected_record_ids: [],
    ...values,
  });
}

function unixDate(value: unknown) {
  return typeof value === "number" && value > 0 ? new Date(value * 1000).toISOString().slice(0,10) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!webhookSecret || !stripeSecret) return json({ error: "Stripe webhook is not configured" }, 503);

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return json({ error: "Missing Stripe signature" }, 400);
  if (!(await verifyStripeSignature(payload, signature, webhookSecret))) return json({ error: "Invalid signature" }, 400);

  let event: any;
  try { event = JSON.parse(payload); } catch { return json({ error: "Invalid payload" }, 400); }
  if (!event?.id || !event?.type) return json({ error: "Invalid Stripe event" }, 400);

  const url = Deno.env.get("SUPABASE_URL");
  if (!url) return json({ error: "Server configuration error" }, 500);
  const admin = createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: claim, error: claimError } = await admin.rpc("claim_stripe_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.type,
  });
  if (claimError) return json({ error: "Unable to claim webhook event" }, 500);
  if (claim === "duplicate") return json({ received: true, duplicate: true });
  if (claim === "in_progress") return json({ received: true, in_progress: true }, 202);

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const accountId = session.client_reference_id || session.metadata?.client_account_id;
      if (accountId) {
        let subscription: any = {};
        if (session.subscription) {
          const res = await fetch(`https://api.stripe.com/v1/subscriptions/${session.subscription}`, {
            headers: { Authorization: `Bearer ${stripeSecret}` },
          });
          subscription = await res.json();
          if (!res.ok) throw new Error(subscription?.error?.message || "Unable to retrieve Stripe subscription");
        }

        await admin.from("client_accounts").update({
          subscription_status: "Active",
          subscription_plan: session.metadata?.tier_name || session.metadata?.tier_key || "Unknown",
          subscription_start_date: unixDate(subscription.current_period_start),
          subscription_renewal_date: unixDate(subscription.current_period_end),
          subscription_end_date: unixDate(subscription.ended_at),
          billing_status: "Paid",
        }).eq("id", accountId);

        const tierId = session.metadata?.tier_id;
        if (tierId) {
          const { data: tier } = await admin.from("subscription_tiers")
            .select("included_capabilities").eq("id", tierId).maybeSingle();
          const caps = Array.isArray(tier?.included_capabilities) ? tier.included_capabilities : [];
          const allowed = new Set([
            "can_login","can_view_engagement","can_view_documents","can_download_documents",
            "can_view_poc","can_review_poc","can_approve_poc","can_view_tasks","can_complete_tasks",
            "can_view_evidence","can_submit_evidence","can_view_audits","can_complete_audits","can_message_consultant",
          ]);
          const update: Record<string, boolean> = {};
          for (const cap of caps) if (allowed.has(cap)) update[cap] = true;
          if (Object.keys(update).length) {
            await admin.from("client_memberships").update(update)
              .eq("client_account_id", accountId).eq("membership_status", "Active");
          }
        }

        await audit(admin, {
          client_account_id: accountId,
          new_access_state: "Active",
          reason: `Subscription activated: ${session.metadata?.tier_name || session.metadata?.tier_key || "Unknown"} (Stripe sub: ${session.subscription || "n/a"})`,
          triggering_source: "stripe-webhook:checkout.session.completed",
          affected_record_ids: [accountId],
        });
      }
    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const accountId = invoice.metadata?.client_account_id || invoice.subscription_details?.metadata?.client_account_id;
      if (accountId) {
        const renewal = invoice.lines?.data?.[0]?.period?.end;
        await admin.from("client_accounts").update({
          subscription_status: "Active",
          billing_status: "Paid",
          subscription_renewal_date: unixDate(renewal),
          past_due_since: null,
          grace_period_end: null,
        }).eq("id", accountId);
        await audit(admin, {
          client_account_id: accountId,
          new_access_state: "Active",
          reason: `Invoice paid: ${invoice.id}`,
          triggering_source: "stripe-webhook:invoice.paid",
          affected_record_ids: [accountId],
        });
      }
    } else if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object;
      const accountId = invoice.metadata?.client_account_id || invoice.subscription_details?.metadata?.client_account_id;
      if (accountId) {
        await admin.from("client_accounts").update({
          billing_status: "Past Due",
          subscription_status: "Past Due",
          past_due_since: new Date().toISOString().slice(0,10),
        }).eq("id", accountId);
        await audit(admin, {
          client_account_id: accountId,
          previous_access_state: "Active",
          new_access_state: "Past Due",
          reason: `Invoice payment failed: ${invoice.id}`,
          triggering_source: "stripe-webhook:invoice.payment_failed",
          affected_record_ids: [accountId],
        });
      }
    } else if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const accountId = subscription.metadata?.client_account_id;
      if (accountId) {
        const mapped =
          subscription.status === "canceled" ? "Cancelled" :
          subscription.status === "incomplete_expired" ? "Expired" :
          ["past_due","unpaid"].includes(subscription.status) ? "Past Due" : "Active";
        await admin.from("client_accounts").update({
          subscription_status: mapped,
          subscription_start_date: unixDate(subscription.current_period_start),
          subscription_renewal_date: unixDate(subscription.current_period_end),
          subscription_end_date: unixDate(subscription.ended_at),
        }).eq("id", accountId);
        await audit(admin, {
          client_account_id: accountId,
          new_access_state: mapped,
          reason: `Subscription updated: ${subscription.status} (Stripe sub: ${subscription.id})`,
          triggering_source: "stripe-webhook:customer.subscription.updated",
          affected_record_ids: [accountId],
        });
      }
    } else if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const accountId = subscription.metadata?.client_account_id;
      if (accountId) {
        await admin.from("client_accounts").update({
          subscription_status: "Cancelled",
          subscription_end_date: new Date().toISOString().slice(0,10),
          billing_status: "Past Due",
          access_status: "Suspended",
          access_restriction_reason: "Subscription cancelled",
          access_restriction_effective_date: new Date().toISOString(),
        }).eq("id", accountId);
        await audit(admin, {
          client_account_id: accountId,
          previous_access_state: "Active",
          new_access_state: "Suspended",
          reason: `Subscription deleted: ${subscription.id}`,
          triggering_source: "stripe-webhook:customer.subscription.deleted",
          affected_record_ids: [accountId],
        });
      }
    }

    await admin.rpc("complete_stripe_webhook_event", {
      p_event_id: event.id,
      p_status: "Success",
      p_error: null,
    });
    return json({ received: true });
  } catch (error) {
    console.error("stripe-webhook processing error", error);
    await admin.rpc("complete_stripe_webhook_event", {
      p_event_id: event.id,
      p_status: "Failed",
      p_error: error instanceof Error ? error.message : "Unknown webhook error",
    }).catch(() => {});
    return json({ error: "Webhook processing failed" }, 500);
  }
});
