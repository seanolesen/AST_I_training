import { supabase } from "./supabaseClient";

// Fetch answer/explanation overrides for a bank ("ast1"/"ast2") as { qid: {answer, explain, q} }.
export async function fetchOverrides(bank) {
  if (!supabase) return {};
  try {
    const { data, error } = await supabase
      .from("question_overrides").select("qid, answer, explain, q").eq("bank", bank);
    if (error || !data) return {};
    const map = {};
    for (const r of data) map[r.qid] = r;
    return map;
  } catch (e) { return {}; }
}

// Merge overrides onto a question bank (pure; only fields present in an override are replaced).
export function applyOverrides(bankArr, map) {
  if (!map || !Object.keys(map).length) return bankArr;
  return bankArr.map((qq) => {
    const o = map[qq.id];
    if (!o) return qq;
    const m = { ...qq };
    if (o.answer !== null && o.answer !== undefined) m.answer = o.answer;
    if (o.explain != null && o.explain !== "") m.explain = o.explain;
    if (o.q != null && o.q !== "") m.q = o.q;
    return m;
  });
}

export async function adminSaveOverride(bank, qid, fields) {
  if (!supabase || !bank || !qid) return { ok: false };
  const row = { bank, qid, ...fields, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("question_overrides").upsert(row, { onConflict: "bank,qid" });
  return { ok: !error, error: error && error.message };
}

export async function adminClearOverride(bank, qid) {
  if (!supabase || !bank || !qid) return { ok: false };
  const { error } = await supabase.from("question_overrides").delete().eq("bank", bank).eq("qid", qid);
  return { ok: !error, error: error && error.message };
}
