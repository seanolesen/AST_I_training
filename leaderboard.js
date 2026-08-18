// Opt-in practice leaderboard. Only a summary row (display name + per-tool
// accuracy) is ever published; raw runs/docs stay private under their own RLS.
import { supabase } from "./supabaseClient";
import { TOOLS } from "./Performance.jsx";

export const QUALIFY = 5; // minimum recorded attempts to appear on a board

async function uid() {
  if (!supabase) return null;
  try { const { data } = await supabase.auth.getSession(); return data?.session?.user?.id || null; }
  catch { return null; }
}

// Aggregate the signed-in user's own accuracy per tool, reusing each tool's
// normalizer via TOOLS.load() (which reads only this user's data).
export async function computeMyStats() {
  const stats = {};
  for (const tool of TOOLS) {
    try {
      const at = await tool.load();
      const n = at.length;
      const c = at.filter((a) => a.correct).length;
      stats[tool.key] = { acc: n ? Math.round((100 * c) / n) : null, n };
    } catch (e) { stats[tool.key] = { acc: null, n: 0 }; }
  }
  return stats;
}

export async function fetchLeaderboard() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("leaderboard").select("user_id, display_name, stats, updated_at");
  return error ? [] : (data || []);
}

export async function getMyLeaderboard() {
  const id = await uid();
  if (!id || !supabase) return null;
  const { data, error } = await supabase.from("leaderboard").select("user_id, display_name, stats").eq("user_id", id).maybeSingle();
  return error ? null : (data || null);
}

export async function upsertMyLeaderboard(displayName) {
  const id = await uid();
  if (!id || !supabase) return { ok: false, error: "not signed in" };
  const name = (displayName || "").trim().slice(0, 40);
  if (!name) return { ok: false, error: "empty name" };
  const stats = await computeMyStats();
  const { error } = await supabase.from("leaderboard").upsert({ user_id: id, display_name: name, stats, updated_at: new Date().toISOString() });
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Recompute this user's stats from their latest play and re-upload — but only
// if they've already opted in (have a display name). Called when the board opens
// so newly played tools (e.g. Card, Beacon) show up without re-saving the name.
export async function refreshMyStats() {
  try {
    const id = await uid();
    if (!id || !supabase) return { ok: false };
    const mine = await getMyLeaderboard();
    if (!mine || !mine.display_name) return { ok: false, skipped: true };
    const stats = await computeMyStats();
    const { error } = await supabase.from("leaderboard")
      .upsert({ user_id: id, display_name: mine.display_name, stats, updated_at: new Date().toISOString() });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) { return { ok: false, error: e && e.message }; }
}

export async function deleteMyLeaderboard() {
  const id = await uid();
  if (!id || !supabase) return { ok: false, error: "not signed in" };
  const { error } = await supabase.from("leaderboard").delete().eq("user_id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// Rank rows for one tool key: qualified, sorted by accuracy then volume.
export function rankFor(rows, key) {
  return (rows || [])
    .filter((r) => r.stats && r.stats[key] && r.stats[key].acc != null && (r.stats[key].n || 0) >= QUALIFY)
    .map((r) => ({ user_id: r.user_id, name: r.display_name, acc: r.stats[key].acc, n: r.stats[key].n }))
    .sort((a, b) => (b.acc - a.acc) || (b.n - a.n));
}

// ---- Admin moderation (requires the admin RLS policies in schema.sql) ----
export async function adminResetName(userId) {
  if (!supabase || !userId) return { ok: false };
  const { error } = await supabase.from("leaderboard")
    .update({ display_name: "", updated_at: new Date().toISOString() }).eq("user_id", userId);
  return { ok: !error, error: error && error.message };
}
export async function adminRemoveEntry(userId) {
  if (!supabase || !userId) return { ok: false };
  const { error } = await supabase.from("leaderboard").delete().eq("user_id", userId);
  return { ok: !error, error: error && error.message };
}
