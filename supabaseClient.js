import { createClient } from "@supabase/supabase-js";

// These come from Vercel env vars (and .env.local for local dev).
// If they're missing, the app runs in local-only mode (no sync).
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;
