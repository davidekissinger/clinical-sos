/// <reference types="vite/client" />

// Supabase publishable keys are safe for browser use. The service-role/secret key
// must never be placed in VITE_* variables or committed to this repository.
export const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || "https://htlyplekracwejhkhttu.supabase.co";

export const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_TEX--Y1HuutcKB79PtkI_g_3sxit_Xl";
