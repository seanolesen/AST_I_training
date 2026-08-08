import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client = null;
try {
  if (url && key) client = createClient(url, key);
} catch (e) {
  console.error("Supabase init failed:", e);
  client = null;
}

export const supabase = client;
