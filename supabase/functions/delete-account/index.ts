import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { corsHeaders as sdkCorsHeaders } from "npm:@supabase/supabase-js@2.116.0/cors";

const corsHeaders = {
  ...sdkCorsHeaders,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("SUPABASE_URL unavailable");

    const userClient = createClient(url, publicKey(), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(url, secretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id,email,full_name,role")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    if (!profile || profile.role !== "client") {
      return json({ error: "Client self-service deletion is not available for this account." }, 403);
    }

    const { data: memberships, error: membershipError } = await admin
      .from("client_memberships")
      .select("id,client_account_id,membership_status")
      .eq("client_user_id", user.id);
    if (membershipError) throw membershipError;

    const activeMembership = (memberships || []).find(
      (membership) => membership.membership_status === "Active",
    );

    const started = new Date().toISOString();
    const affectedRecordIds = [
      user.id,
      ...(memberships || []).map((membership) => membership.id),
    ];

    const { data: auditRow, error: auditError } = await admin
      .from("automation_logs")
      .insert({
        automation: "Client Account Deletion",
        started,
        status: "Running",
        records_processed: 0,
        affected_record_ids: affectedRecordIds,
        triggered_by: "delete-account:self-service",
        triggering_source: "delete-account",
        client_account_id: activeMembership?.client_account_id || null,
        previous_access_state: activeMembership?.membership_status || "Authenticated",
        new_access_state: "Deletion Requested",
        reason: "Client self-service sign-in account deletion",
        acting_user_id: user.id,
        acting_profile_id: user.id,
        acting_user_name: profile.full_name || profile.email || user.email || "Client user",
        description:
          "Deletes the authenticated client sign-in identity and cascading profile/membership records while retaining operational records subject to their own retention rules.",
      })
      .select("id")
      .single();
    if (auditError || !auditRow?.id) {
      console.error("Account deletion audit creation failed", auditError);
      return json({ error: "Unable to record account deletion request." }, 500);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      await admin
        .from("automation_logs")
        .update({
          completed: new Date().toISOString(),
          status: "Failed",
          errors: deleteError.message,
          new_access_state: "Deletion Failed",
        })
        .eq("id", auditRow.id);
      console.error("Account deletion failed", deleteError);
      return json({ error: "Unable to delete account." }, 500);
    }

    await admin
      .from("automation_logs")
      .update({
        completed: new Date().toISOString(),
        status: "Success",
        records_processed: 1,
        new_access_state: "Deleted",
      })
      .eq("id", auditRow.id);

    return json({ success: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return json({ error: "Unable to delete account." }, 500);
  }
});
