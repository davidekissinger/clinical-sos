import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function publicKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed?.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (!legacy) throw new Error("Supabase publishable key unavailable");
  return legacy;
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

function safeOrigin(req: Request) {
  const raw = req.headers.get("origin");
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || (url.protocol === "http:" && ["localhost","127.0.0.1"].includes(url.hostname))) {
      return url.origin;
    }
  } catch {}
  return null;
}

async function authenticate(req: Request, url: string) {
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const client = createClient(url, publicKey(), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await client.auth.getUser();
  return error ? null : user;
}

async function resolveClientAccount(admin: ReturnType<typeof createClient>, userId: string) {
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("id,email,full_name,role").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.role !== "client") return { profile, account: null, membership: null, error: "Forbidden — client role required" };

  const { data: memberships, error: membershipError } = await admin.from("client_memberships")
    .select("*").eq("client_user_id", userId).eq("membership_status", "Active");
  if (membershipError) throw membershipError;
  if (!memberships?.length) return { profile, account: null, membership: null, error: "No active client membership found" };
  if (memberships.length !== 1) return { profile, account: null, membership: null, error: "Multiple active client memberships detected" };

  const membership = memberships[0];
  const { data: account, error: accountError } = await admin.from("client_accounts")
    .select("*").eq("id", membership.client_account_id).maybeSingle();
  if (accountError) throw accountError;
  if (!account) return { profile, account: null, membership, error: "Client account not found" };
  if (["Suspended","Terminated"].includes(account.access_status)) {
    return { profile, account, membership, error: "Client account is not eligible for checkout" };
  }
  return { profile, account, membership, error: null };
}

async function audit(admin: ReturnType<typeof createClient>, accountId: string, user: Record<string, unknown>, tier: Record<string, unknown>) {
  const now = new Date().toISOString();
  const { error } = await admin.from("automation_logs").insert({
    automation: "Client Access Change",
    started: now,
    completed: now,
    status: "Success",
    client_account_id: accountId,
    previous_access_state: "N/A",
    new_access_state: "Checkout Initiated",
    reason: `Checkout session created for tier: ${tier.tier_name} (${tier.annual_price}/yr)`,
    triggering_source: "stripe-billing:create_checkout",
    acting_user_id: user.id,
    acting_profile_id: user.id,
    acting_user_name: user.full_name || user.email || "Unknown",
    manual_override: false,
    affected_record_ids: [accountId],
  });
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET","POST"].includes(req.method)) return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL unavailable");
    const user = await authenticate(req, url);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, secretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const resolved = await resolveClientAccount(admin, user.id);
    if (resolved.error) return json({ error: resolved.error }, resolved.error.startsWith("Forbidden") ? 403 : 409);

    if (req.method === "GET") {
      const { data, error } = await admin.from("subscription_tiers")
        .select("id,tier_name,tier_key,description,annual_price,features,facility_limit,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return json({ tiers: data || [] });
    }

    const body = await req.json().catch(() => ({}));
    const tierId = typeof body.tier_id === "string" ? body.tier_id : "";
    if (!tierId) return json({ error: "tier_id is required" }, 400);

    const { data: tier, error: tierError } = await admin.from("subscription_tiers")
      .select("*").eq("id", tierId).eq("is_active", true).maybeSingle();
    if (tierError) throw tierError;
    if (!tier) return json({ error: "Subscription tier not found or inactive" }, 404);
    if (!tier.stripe_price_id) return json({ error: "Subscription tier is not configured for checkout" }, 503);

    const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecret) return json({ error: "Stripe checkout is not configured" }, 503);

    const origin = safeOrigin(req);
    if (!origin) return json({ error: "Unable to determine a safe checkout return URL" }, 400);

    const account = resolved.account!;
    const profile = resolved.profile!;
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", `${origin}/client/subscription?status=success`);
    form.set("cancel_url", `${origin}/client/subscription?status=cancelled`);
    form.set("client_reference_id", account.id);
    form.set("line_items[0][price]", tier.stripe_price_id);
    form.set("line_items[0][quantity]", "1");

    const metadata: Record<string,string> = {
      client_account_id: account.id,
      client_user_id: user.id,
      tier_id: tier.id,
      tier_key: tier.tier_key,
      tier_name: tier.tier_name,
      source: "clinical-sos-supabase",
    };
    for (const [k,v] of Object.entries(metadata)) {
      form.set(`metadata[${k}]`, v);
      if (["client_account_id","tier_id","tier_key"].includes(k)) form.set(`subscription_data[metadata][${k}]`, v);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Idempotency-Key": crypto.randomUUID(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) {
      console.error("Stripe checkout error", session?.error?.message);
      return json({ error: session?.error?.message || "Failed to create checkout session" }, 400);
    }

    await audit(admin, account.id, profile, tier);
    return json({ success: true, checkout_url: session.url, session_id: session.id });
  } catch (error) {
    console.error("stripe-checkout failed", error);
    return json({ error: "Unable to start checkout" }, 500);
  }
});
