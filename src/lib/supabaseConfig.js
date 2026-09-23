/// <reference types="vite/client" />

// Supabase publishable keys are intentionally safe for browser use. Environment
// variables can override these project defaults without changing application code.
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://htlyplekracwejhkhttu.supabase.co";
export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_TEX--Y1HuutcKB79PtkI_g_3sxit_Xl";

export const isSupabaseSsoEnabled =
  import.meta.env.VITE_SUPABASE_SSO_ENABLED === "true";
