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

export async function loadRuns(app) {
  const uid = await currentUserId();
  let rows;
  if (uid) {
    const { data, error } = await supabase
      .from("runs")
      .select("payload, created_at")
      .order("created_at", { ascending: true });
    rows = error ? localLoadRuns() : (data || []).map((r) => r.payload);
  } else {
    rows = localLoadRuns();
  }
  // Runs are tagged with an app key; older untagged runs are AST 1.
  if (app) rows = rows.filter((r) => r && (r.app || "ast1") === app);
  return rows;
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

// ---- Per-user document store (a single JSON blob per app namespace) ----
// Used by tools that keep one history object (e.g. the slope trainer).
function localDocGet(app, fallback) {
  try {
    const v = localStorage.getItem("doc:" + app);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
function localDocSet(app, obj) {
  try {
    localStorage.setItem("doc:" + app, JSON.stringify(obj));
  } catch {
    /* ignore */
  }
}

export async function loadDoc(app, fallback) {
  const uid = await currentUserId();
  if (uid) {
    const { data, error } = await supabase
      .from("docs")
      .select("data")
      .eq("user_id", uid)
      .eq("app", app)
      .maybeSingle();
    if (!error && data && data.data != null) return data.data;
    // cloud missing / empty / errored -> use a local copy if we have one
    const local = localDocGet(app, null);
    if (local != null) return local;
    return fallback;
  }
  return localDocGet(app, fallback);
}

export async function saveDoc(app, obj) {
  const uid = await currentUserId();
  if (uid) {
    const { error } = await supabase
      .from("docs")
      .upsert(
        { user_id: uid, app, data: obj, updated_at: new Date().toISOString() },
        { onConflict: "user_id,app" }
      );
    if (!error) return { ok: true, where: "cloud" };
    // cloud write failed -> keep a local copy AND report why
    localDocSet(app, obj);
    const msg = (error && (error.message || error.code || error.details || error.hint)) || "unknown";
    return { ok: false, where: "local(fallback)", error: String(msg) };
  }
  localDocSet(app, obj);
  return { ok: true, where: "local(guest)" };
}

// ---- Account & privacy: export / delete everything for the current identity ----
const DOC_APPS = ["slope", "card", "danger", "terrain", "beacon"];

export async function exportAllData() {
  const runs = await loadRuns(); // all apps
  const docs = {};
  for (const a of DOC_APPS) docs[a] = await loadDoc(a, null);
  const recordPref = await loadRecordPref();
  const uid = await currentUserId();
  return {
    app: "Avalanche Safety Training Prep",
    exportedAt: new Date().toISOString(),
    account: uid ? "signed-in" : "guest/local",
    runs,
    docs,
    recordPref,
  };
}

export async function deleteAllData() {
  const uid = await currentUserId();
  let serverError = null;
  if (uid && supabase) {
    const r1 = await supabase.from("runs").delete().eq("user_id", uid);
    const r2 = await supabase.from("docs").delete().eq("user_id", uid);
    serverError = (r1 && r1.error) || (r2 && r2.error) || null;
  }
  try {
    localStorage.removeItem(RUNS_KEY);
    for (const a of DOC_APPS) localStorage.removeItem("doc:" + a);
  } catch {
    /* ignore */
  }
  return { ok: !serverError, error: serverError ? (serverError.message || String(serverError)) : null };
}

// ---- Migration: fold device-local history into the signed-in account -------
// Guest/pre-sync reps live in localStorage; this merges them into Supabase,
// de-duplicating by timestamp so it is safe to run more than once.
function localDocAttempts(app) {
  const d = localDocGet(app, null);
  return d && Array.isArray(d.attempts) ? d.attempts : [];
}

export async function scanLocalHistory() {
  const docs = {};
  let docTotal = 0;
  for (const a of DOC_APPS) {
    const n = localDocAttempts(a).length;
    if (n) { docs[a] = n; docTotal += n; }
  }
  const runs = localLoadRuns().length;
  return { docs, docTotal, runs, total: docTotal + runs };
}

export async function importLocalHistory() {
  const uid = await currentUserId();
  if (!uid || !supabase) return { ok: false, error: "not signed in" };
  const imported = { docs: {}, runs: 0 };
  for (const a of DOC_APPS) {
    const local = localDocAttempts(a);
    if (!local.length) continue;
    let remote;
    try { remote = await loadDoc(a, { attempts: [] }); } catch (e) { remote = { attempts: [] }; }
    const rem = remote && Array.isArray(remote.attempts) ? remote.attempts : [];
    const seen = new Set(rem.map((x) => x && x.ts));
    const added = local.filter((x) => x && x.ts != null && !seen.has(x.ts));
    if (added.length) {
      const merged = { ...(remote || {}), attempts: [...rem, ...added].sort((p, q) => (p.ts || 0) - (q.ts || 0)) };
      try { await saveDoc(a, merged); imported.docs[a] = added.length; } catch (e) { /* skip this app */ }
    }
  }
  const localRuns = localLoadRuns();
  if (localRuns.length) {
    let remoteRuns = [];
    try { remoteRuns = await loadRuns(); } catch (e) { remoteRuns = []; }
    const seen = new Set(remoteRuns.map((r) => r && r.ts).filter((x) => x != null));
    const toAdd = localRuns.filter((r) => r && r.ts != null && !seen.has(r.ts));
    for (const r of toAdd) {
      try { const { error } = await supabase.from("runs").insert({ user_id: uid, payload: r }); if (!error) imported.runs += 1; } catch (e) { /* skip */ }
    }
  }
  const total = Object.values(imported.docs).reduce((s, n) => s + n, 0) + imported.runs;
  return { ok: true, imported, total };
}
