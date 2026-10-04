import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2.116.0/cors";

const headers = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, "Content-Type": "application/json" },
});

function key(bundle: string, legacy: string) {
  const raw = Deno.env.get(bundle);
  const value = raw ? JSON.parse(raw)?.default : Deno.env.get(legacy);
  if (!value) throw new Error("Server configuration unavailable");
  return value;
}

const sortColumns: Record<string, string> = {
  created_date: "created_at", created_at: "created_at",
  full_name: "full_name", email: "email", role: "role", id: "id",
};

export async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("Server configuration unavailable");
    const caller = createClient(url, key("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);
    // Read the current server-managed role through the caller's own-profile RLS.
    const { data: actor, error: roleError } = await caller.from("profiles")
      .select("role").eq("id", user.id).maybeSingle();
    if (roleError) throw roleError;
    if (actor?.role !== "admin") return json({ error: "Forbidden — admin only" }, 403);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body" }, 400);
    const sort = body.sort ?? "-created_date";
    const limit = body.limit ?? 50;
    const skip = body.skip ?? 0;
    if (typeof sort !== "string" || !Object.hasOwn(sortColumns, sort.replace(/^[+-]/, "")) ||
        !Number.isInteger(limit) || limit < 1 || limit > 500 ||
        !Number.isInteger(skip) || skip < 0 || skip > 100000) {
      return json({ error: "Invalid sorting or pagination" }, 400);
    }
    if (body.pending_only !== undefined && typeof body.pending_only !== "boolean") {
      return json({ error: "Invalid eligibility filter" }, 400);
    }
    const search = body.search_email;
    if (search !== undefined && (typeof search !== "string" || search.trim().length < 3 || search.length > 254)) {
      return json({ error: "Email search must contain 3–254 characters" }, 400);
    }
    // Create a privileged client only after current administrator authorization.
    const admin = createClient(url, key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let query = admin.from("profiles").select("id,email,full_name,role,created_at");
    if (body.pending_only === true) query = query.eq("role", "pending");
    if (search !== undefined) {
      const literal = search.trim().replace(/[\\%_]/g, "\\$&");
      query = query.ilike("email", "%" + literal + "%");
    }
    const column = sortColumns[sort.replace(/^[+-]/, "")];
    query = query.order(column, { ascending: !sort.startsWith("-") });
    if (column !== "id") query = query.order("id", { ascending: true });
    const { data, error } = await query.range(skip, skip + limit - 1);
    if (error) throw error;
    return json({ users: (data || []).map(({ id, email, full_name, role, created_at }) => ({
      id, email, full_name, role, created_date: created_at,
    })) });
  } catch {
    return json({ error: "Unable to load users" }, 500);
  }
}

Deno.serve(handleRequest);
