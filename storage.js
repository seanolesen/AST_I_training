// Unified persistence: Supabase when signed in, localStorage otherwise.
// Keeps the same async API the app already used (loadRuns/saveRun/pref).
import { supabase } from "./supabaseClient";

const RUNS_KEY = "ast1:runs";
const GUEST_KEY = "ast1:recordPref";

async function currentUserId() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.user?.id || null;
  } catch {
    return null;
  }
}

function localLoadRuns() {
  try {
    return JSON.parse(localStorage.getItem(RUNS_KEY)) || [];
  } catch {
    return [];
  }
}
function localSaveRun(run) {
  try {
    let runs = localLoadRuns();
    runs.push(run);
    if (runs.length > 200) runs = runs.slice(runs.length - 200);
    localStorage.setItem(RUNS_KEY, JSON.stringify(runs));
  } catch {
    /* ignore */
  }
}

export async function loadRuns() {
  const uid = await currentUserId();
  if (uid) {
    const { data, error } = await supabase
      .from("runs")
      .select("payload, created_at")
      .order("created_at", { ascending: true });
    if (error) return localLoadRuns(); // graceful fallback
    return (data || []).map((r) => r.payload);
  }
  return localLoadRuns();
}

export async function saveRun(run) {
  const uid = await currentUserId();
  if (uid) {
    const { error } = await supabase.from("runs").insert({ user_id: uid, payload: run });
    if (!error) return;
    // if the insert failed, keep a local copy so nothing is lost
  }
  localSaveRun(run);
}

// Guest/record toggle lives on the device either way.
export async function loadRecordPref() {
  try {
    const v = localStorage.getItem(GUEST_KEY);
    return v == null ? true : JSON.parse(v);
  } catch {
    return true;
  }
}
export async function saveRecordPref(v) {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}
