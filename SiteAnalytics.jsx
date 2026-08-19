import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { AnalyticsPanels, normalizeAst1, normalizeAst2, normalizeSlope, normalizeCard } from "./Performance.jsx";
import { normalizeDanger } from "./DangerApp.jsx";
import { normalizeTerrain } from "./TerrainApp.jsx";
import { normalizeBeacon } from "./BeaconApp.jsx";
import { useLang } from "./i18n.jsx";
import { BANK as BANK1 } from "./questions";
import { BANK as BANK2 } from "./questions2";
import { fetchOverrides, adminSaveOverride, adminClearOverride } from "./overrides.js";

const SUPER_ADMIN = "sean.olesen@gmail.com";
const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0", ice: "#7cc4ff",
  good: "#3FA372", warn: "#f0812c", bad: "#D6483B", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const isSuper = (email) => (email || "").toLowerCase() === SUPER_ADMIN.toLowerCase();
const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "\u2014");

function statsFor(payloads, slopeHist) {
  let q = 0, c = 0, last = 0, ast1 = 0, ast2 = 0;
  for (const p of payloads) {
    const app = p.app || "ast1";
    if (app === "ast2") ast2 += 1; else ast1 += 1;
    const tot = p.total != null ? p.total : (Array.isArray(p.questions) ? p.questions.length : 0);
    const cor = p.correct != null ? p.correct : (Array.isArray(p.questions) ? p.questions.filter((x) => x.correct).length : 0);
    q += tot; c += cor;
    if (p.ts) last = Math.max(last, p.ts);
  }
  const slope = (slopeHist && slopeHist.attempts) || [];
  for (const a of slope) if (a.ts) last = Math.max(last, a.ts);
  return { runs: ast1 + ast2, ast1, ast2, questions: q, acc: q ? Math.round((100 * c) / q) : null, slope: slope.length, last };
}

export function SiteAnalytics({ onHome, session }) {
  const { t } = useLang();
  const [state, setState] = useState({ loading: true, error: null, profiles: [], runsByUser: {}, docsByUser: {} });
  const [selected, setSelected] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [page, setPage] = useState("home"); // home | users | qa | sessions

  const myEmail = session && session.user && session.user.email;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!supabase || !session || !session.user) { if (alive) setState({ loading: false, error: "signin", profiles: [] }); return; }
      try {
        const [pr, rr, dr] = await Promise.all([
          supabase.from("profiles").select("id,email,is_admin,created_at"),
          supabase.from("runs").select("user_id,payload"),
          supabase.from("docs").select("user_id,app,data"),
        ]);
        if (pr.error) throw pr.error;
        const runsByUser = {}, docsByUser = {};
        for (const row of rr.data || []) (runsByUser[row.user_id] = runsByUser[row.user_id] || []).push(row.payload);
        for (const row of dr.data || []) { docsByUser[row.user_id] = docsByUser[row.user_id] || {}; docsByUser[row.user_id][row.app] = row.data; }
        const profiles = (pr.data || []).slice().sort((a, b) => (a.email || "").localeCompare(b.email || ""));
        if (alive) setState({ loading: false, error: null, profiles, runsByUser, docsByUser });
      } catch (e) {
        if (alive) setState({ loading: false, error: (e && e.message) || "load", profiles: [] });
      }
    })();
    return () => { alive = false; };
  }, [session]);

  const iAmAdmin = isSuper(myEmail) || state.profiles.some((p) => p.email === myEmail && p.is_admin);

  const toggleAdmin = async (p) => {
    if (isSuper(p.email)) return;
    setBusyId(p.id);
    try {
      const next = !p.is_admin;
      const { error } = await supabase.from("profiles").update({ is_admin: next }).eq("id", p.id);
      if (!error) setState((s) => ({ ...s, profiles: s.profiles.map((x) => (x.id === p.id ? { ...x, is_admin: next } : x)) }));
    } finally { setBusyId(null); }
  };

  const [confirmDel, setConfirmDel] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const deleteUser = async (p) => {
    setDelBusy(true);
    try {
      await supabase.from("runs").delete().eq("user_id", p.id);
      await supabase.from("docs").delete().eq("user_id", p.id);
      await supabase.from("leaderboard").delete().eq("user_id", p.id);
      await supabase.from("profiles").delete().eq("id", p.id);
      setState((s2) => ({ ...s2, profiles: s2.profiles.filter((x) => x.id !== p.id) }));
      setSelected(null); setConfirmDel(null);
    } finally { setDelBusy(false); }
  };

  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow, fontFamily: FONT, padding: "22px 14px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 720, margin: "0 auto" };
  const back = (label, fn) => <button onClick={fn} style={{ background: "transparent", border: "none", color: T.ice, cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 700 }}>{"\u2190 "}{label}</button>;
  const eyebrow = <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>{t("sa.eyebrow")}</div>;
  const gate = state.loading ? t("sa.loading")
    : state.error === "signin" ? t("sa.signin")
    : !iAmAdmin ? t("sa.noAccess")
    : state.error ? t("sa.loadError", { error: state.error }) : null;
  const gateBox = (msg) => <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, color: T.dim, fontSize: 13 }}>{msg}</div>;

  // ---------- Q&A master sheet ----------
  if (page === "qa") {
    return (
      <div style={wrap}><div style={inner}>
        {back(t("sa.backAdmin"), () => setPage("home"))}
        {eyebrow}
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 4px" }}>{t("qa.title")}</h1>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 16px", lineHeight: 1.5 }}>{t("qa.intro")}</p>
        {gate ? gateBox(gate) : <QAMasterSheet />}
      </div></div>
    );
  }

  // ---------- Users & Engagement: user drill-in ----------
  if (page === "users" && selected) {
    const p = state.profiles.find((x) => x.id === selected);
    const payloads = state.runsByUser[selected] || [];
    const docs = state.docsByUser[selected] || {};
    const attemptsByTool = {
      slope: normalizeSlope(docs.slope || { attempts: [] }),
      card: normalizeCard(docs.card || { attempts: [] }),
      danger: normalizeDanger(docs.danger || { attempts: [] }),
      terrain: normalizeTerrain(docs.terrain || { attempts: [] }),
      beacon: normalizeBeacon(docs.beacon || { attempts: [] }),
      ast1: normalizeAst1(payloads.filter((x) => (x.app || "ast1") === "ast1")),
      ast2: normalizeAst2(payloads.filter((x) => x.app === "ast2")),
    };
    return (
      <div style={wrap}><div style={inner}>
        {back(t("sa.backUsers"), () => setSelected(null))}
        <div style={{ fontSize: 12, letterSpacing: "1.4px", textTransform: "uppercase", color: T.dim }}>{t("sa.userPerf")}</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: "6px 0 16px", wordBreak: "break-all" }}>{p ? p.email : selected}</h1>
        <AnalyticsPanels attemptsByTool={attemptsByTool} />
      </div></div>
    );
  }

  // ---------- Users & Engagement: list ----------
  if (page === "users") {
    return (
      <div style={wrap}><div style={inner}>
        {back(t("sa.backAdmin"), () => setPage("home"))}
        {eyebrow}
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 4px" }}>{t("sa.usersTitle")}</h1>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 16px", lineHeight: 1.5 }}>{t("sa.intro")}</p>
        {gate ? gateBox(gate) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {state.profiles.map((p) => {
              const st = statsFor(state.runsByUser[p.id] || [], (state.docsByUser[p.id] || {}).slope);
              const sup = isSuper(p.email);
              return (
                <div key={p.id} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button onClick={() => setSelected(p.id)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: T.snow, fontSize: 14.5, fontWeight: 700, wordBreak: "break-all" }}>
                      {p.email || p.id}
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {sup ? (
                        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.4px", color: T.good, border: `1px solid ${T.good}`, borderRadius: 6, padding: "2px 7px" }}>{t("sa.superAdmin")}</span>
                      ) : (
                        <React.Fragment>
                          <button onClick={() => toggleAdmin(p)} disabled={busyId === p.id}
                            style={{ fontSize: 11.5, fontWeight: 700, cursor: "pointer", borderRadius: 6, padding: "4px 9px",
                              border: `1px solid ${p.is_admin ? T.ice : T.line}`, background: p.is_admin ? "rgba(124,196,255,0.14)" : "transparent",
                              color: p.is_admin ? T.ice : T.dim }}>
                            {p.is_admin ? t("sa.adminYes") : t("sa.makeAdmin")}
                          </button>
                          <button onClick={() => setConfirmDel(p.id)}
                            style={{ fontSize: 11.5, fontWeight: 700, cursor: "pointer", borderRadius: 6, padding: "4px 9px",
                              border: `1px solid ${T.bad}`, background: "transparent", color: T.bad }}>
                            {t("sa.deleteUser")}
                          </button>
                        </React.Fragment>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: 12, color: T.dim }}>
                    <span><b style={{ color: T.snow, fontFamily: "ui-monospace, Menlo, monospace" }}>{st.runs}</b> {t("sa.runs")} <span style={{ color: T.dim }}>{t("sa.astSplit", { ast1: st.ast1, ast2: st.ast2 })}</span></span>
                    <span><b style={{ color: T.snow, fontFamily: "ui-monospace, Menlo, monospace" }}>{st.questions}</b> {t("sa.questions")}</span>
                    <span>{t("sa.acc")} <b style={{ color: st.acc == null ? T.dim : st.acc >= 80 ? T.good : st.acc >= 50 ? T.warn : T.bad, fontFamily: "ui-monospace, Menlo, monospace" }}>{st.acc == null ? "\u2014" : st.acc + "%"}</b></span>
                    <span><b style={{ color: T.snow, fontFamily: "ui-monospace, Menlo, monospace" }}>{st.slope}</b> {t("sa.slopeCalls")}</span>
                    <span>{t("sa.lastActive", { date: fmtDate(st.last) })}</span>
                  </div>
                  {confirmDel === p.id && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "rgba(214,72,59,0.10)", border: `1px solid ${T.bad}` }}>
                      <div style={{ fontSize: 12.5, color: T.snow, marginBottom: 8, lineHeight: 1.5 }}>{t("sa.deleteConfirm")}</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button disabled={delBusy} onClick={() => deleteUser(p)}
                          style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: T.bad, color: "#fff", fontWeight: 800, fontSize: 12.5 }}>{t("sa.deleteYes")}</button>
                        <button disabled={delBusy} onClick={() => setConfirmDel(null)}
                          style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${T.line}`, cursor: "pointer", background: "transparent", color: T.dim, fontSize: 12.5 }}>{t("sa.deleteCancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {state.profiles.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>{t("sa.noUsers")}</div>}
          </div>
        )}
      </div></div>
    );
  }

  if (page === "sessions") {
    return (
      <div style={wrap}><div style={inner}>
        {back(t("sa.backAdmin"), () => setPage("home"))}
        {eyebrow}
        <SessionsAdmin />
      </div></div>
    );
  }

  // ---------- Landing ----------
  const card = (title, desc, onClick) => (
    <button onClick={onClick} style={{ display: "block", width: "100%", textAlign: "left", background: T.panel, border: `1px solid ${T.line}`,
      borderRadius: 14, padding: "18px 40px 18px 18px", color: T.snow, cursor: "pointer", position: "relative" }}>
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <p style={{ margin: 0, fontSize: 13.5, color: T.dim, lineHeight: 1.5 }}>{desc}</p>
      <span style={{ position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)", color: T.dim, opacity: 0.5, fontSize: 18 }}>&rarr;</span>
    </button>
  );
  return (
    <div style={wrap}><div style={inner}>
      {onHome && back(t("nav.allTools"), onHome)}
      {eyebrow}
      <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 4px" }}>{t("sa.homeTitle")}</h1>
      <p style={{ fontSize: 13, color: T.dim, margin: "0 0 16px", lineHeight: 1.5 }}>{t("sa.adminIntro")}</p>
      {gate ? gateBox(gate) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {card(t("sa.card.users"), t("sa.card.usersDesc"), () => { setSelected(null); setPage("users"); })}
          {card(t("qa.title"), t("sa.card.qaDesc"), () => setPage("qa"))}
          {card(t("sess.title"), t("sess.desc"), () => setPage("sessions"))}
        </div>
      )}
    </div></div>
  );
}

// ================= Q&A master sheet =================
function QAMasterSheet() {
  const { t } = useLang();
  const [bankKey, setBankKey] = useState("ast1");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [ov, setOv] = useState({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ answer: null, explain: "" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const bank = bankKey === "ast1" ? BANK1 : BANK2;

  useEffect(() => {
    let alive = true; setLoading(true); setEditing(null);
    fetchOverrides(bankKey).then((m) => { if (alive) { setOv(m || {}); setLoading(false); } });
    return () => { alive = false; };
  }, [bankKey]);

  const effAnswer = (q) => (ov[q.id] && ov[q.id].answer != null ? ov[q.id].answer : q.answer);
  const effExplain = (q) => (ov[q.id] && ov[q.id].explain ? ov[q.id].explain : q.explain);
  const effQ = (q) => (ov[q.id] && ov[q.id].q ? ov[q.id].q : q.q);

  const topics = ["all", ...Array.from(new Set(bank.map((q) => q.topic)))];
  const ql = query.trim().toLowerCase();
  const filtered = bank.filter((q) =>
    (topic === "all" || q.topic === topic) &&
    (!ql || (q.id || "").toLowerCase().includes(ql) || (q.q || "").toLowerCase().includes(ql)));
  const CAP = 60;
  const shown = filtered.slice(0, CAP);

  const startEdit = (q) => { setEditing(q.id); setDraft({ answer: effAnswer(q), explain: effExplain(q) || "", q: effQ(q) || "" }); setNote(""); };
  const cancel = () => { setEditing(null); setNote(""); };
  const save = async (q) => {
    setBusy(true); setNote("");
    const fields = { explain: draft.explain, q: draft.q };
    if (q.type === "mc" || q.type === "tf") fields.answer = draft.answer;
    const r = await adminSaveOverride(bankKey, q.id, fields);
    setBusy(false);
    if (r.ok) { setOv((m) => ({ ...m, [q.id]: { ...(m[q.id] || {}), ...fields } })); setEditing(null); }
    else setNote(t("qa.saveErr", { error: r.error || "" }));
  };
  const revert = async (q) => {
    setBusy(true); setNote("");
    const r = await adminClearOverride(bankKey, q.id);
    setBusy(false);
    if (r.ok) { setOv((m) => { const n = { ...m }; delete n[q.id]; return n; }); setEditing(null); }
    else setNote(t("qa.saveErr", { error: r.error || "" }));
  };

  const bankBtn = (k, label) => (
    <button onClick={() => setBankKey(k)} style={{ flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer", fontSize: 13,
      fontWeight: bankKey === k ? 700 : 500, background: bankKey === k ? T.ice : T.panel,
      color: bankKey === k ? "#0c1218" : T.dim, border: `1px solid ${bankKey === k ? T.ice : T.line}` }}>{label}</button>
  );
  const inputStyle = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, background: T.panel, border: `1px solid ${T.line}`, color: T.snow, fontSize: 14 };
  const badge = (txt, c) => <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.3px", color: c, border: `1px solid ${c}`, borderRadius: 6, padding: "1px 6px" }}>{txt}</span>;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>{bankBtn("ast1", "AST 1")}{bankBtn("ast2", "AST 2")}</div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("qa.search")} style={{ ...inputStyle, marginBottom: 8 }} />
      <select value={topic} onChange={(e) => setTopic(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
        {topics.map((tp) => <option key={tp} value={tp}>{tp === "all" ? t("qa.topicAll") : tp}</option>)}
      </select>

      {loading ? <div style={{ color: T.dim, fontSize: 13 }}>{t("qa.loading")}</div> : (
        <div>
          <div style={{ fontSize: 12, color: T.dim, marginBottom: 10 }}>{t("qa.showing", { n: shown.length, total: filtered.length })}{filtered.length > CAP ? " \u00b7 " + t("qa.refine") : ""}</div>
          {shown.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>{t("qa.none")}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {shown.map((q) => {
              const edited = !!ov[q.id];
              const isEd = editing === q.id;
              const ans = effAnswer(q);
              return (
                <div key={q.id} style={{ background: T.panel, border: `1px solid ${edited ? T.ice : T.line}`, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                    {badge(q.topic, T.dim)}{badge(q.diff, T.dim)}{badge(q.type, T.dim)}
                    {edited && badge(t("qa.edited"), T.ice)}
                    <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11, color: T.dim }}>{q.id}</span>
                  </div>
                  <div style={{ fontSize: 14, color: T.snow, lineHeight: 1.5, marginBottom: 8 }}>{effQ(q)}</div>

                  {!isEd && (
                    <div>
                      {q.type === "mc" && Array.isArray(q.options) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
                          {q.options.map((o, i) => (
                            <div key={i} style={{ fontSize: 13, color: i === ans ? T.good : T.dim }}>{i === ans ? "\u2713 " : "\u00a0\u00a0\u00a0"}{o}</div>
                          ))}
                        </div>
                      )}
                      {q.type === "tf" && <div style={{ fontSize: 13, color: T.good, marginBottom: 8 }}>{t("qa.correct")}: {ans ? t("qa.tfTrue") : t("qa.tfFalse")}</div>}
                      <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginBottom: 8 }}><b style={{ color: T.snow }}>{t("qa.explanation")}:</b> {effExplain(q)}</div>
                      <button onClick={() => startEdit(q)} style={{ fontSize: 12.5, fontWeight: 700, cursor: "pointer", borderRadius: 8, padding: "6px 12px", border: `1px solid ${T.line}`, background: "transparent", color: T.snow }}>{t("qa.edit")}</button>
                    </div>
                  )}

                  {isEd && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, color: T.dim, marginBottom: 5 }}>{t("qa.question")}</div>
                        <textarea value={draft.q} onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: FONT, lineHeight: 1.5 }} />
                      </div>
                      {q.type === "mc" && Array.isArray(q.options) && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ fontSize: 12, color: T.dim }}>{t("qa.correct")}</div>
                          {q.options.map((o, i) => (
                            <button key={i} onClick={() => setDraft((d) => ({ ...d, answer: i }))} style={{ textAlign: "left", fontSize: 13, cursor: "pointer",
                              padding: "8px 10px", borderRadius: 8, border: `1px solid ${draft.answer === i ? T.ice : T.line}`,
                              background: draft.answer === i ? "rgba(124,196,255,0.14)" : "transparent", color: draft.answer === i ? T.ice : T.snow }}>{o}</button>
                          ))}
                        </div>
                      )}
                      {q.type === "tf" && (
                        <div>
                          <div style={{ fontSize: 12, color: T.dim, marginBottom: 5 }}>{t("qa.correct")}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            {[true, false].map((v) => (
                              <button key={String(v)} onClick={() => setDraft((d) => ({ ...d, answer: v }))} style={{ flex: 1, padding: "9px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700,
                                border: `1px solid ${draft.answer === v ? T.ice : T.line}`, background: draft.answer === v ? "rgba(124,196,255,0.14)" : "transparent", color: draft.answer === v ? T.ice : T.snow }}>{v ? t("qa.tfTrue") : t("qa.tfFalse")}</button>
                            ))}
                          </div>
                        </div>
                      )}
                      {q.type !== "mc" && q.type !== "tf" && <div style={{ fontSize: 12, color: T.warn }}>{t("qa.answerNA")}</div>}
                      <div>
                        <div style={{ fontSize: 12, color: T.dim, marginBottom: 5 }}>{t("qa.explanation")}</div>
                        <textarea value={draft.explain} onChange={(e) => setDraft((d) => ({ ...d, explain: e.target.value }))} rows={3} style={{ ...inputStyle, resize: "vertical", fontFamily: FONT, lineHeight: 1.5 }} />
                      </div>
                      {note && <div style={{ fontSize: 12, color: T.bad }}>{note}</div>}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button disabled={busy} onClick={() => save(q)} style={{ padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", background: T.ice, color: "#0c1218", fontWeight: 800, fontSize: 13 }}>{t("qa.save")}</button>
                        {edited && <button disabled={busy} onClick={() => revert(q)} style={{ padding: "8px 12px", borderRadius: 9, border: `1px solid ${T.warn}`, cursor: "pointer", background: "transparent", color: T.warn, fontWeight: 700, fontSize: 12.5 }}>{t("qa.revert")}</button>}
                        <button disabled={busy} onClick={cancel} style={{ padding: "8px 12px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: T.dim, fontSize: 12.5 }}>{t("qa.cancel")}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ================= Sessions & access (admin) =================
function fmtD(v) { if (!v) return null; try { return new Date(v).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); } catch (e) { return String(v); } }

function SessionsAdmin() {
  const { t } = useLang();
  const [sessions, setSessions] = useState(null);
  const [weeks, setWeeks] = useState("");
  const [reqLogin, setReqLogin] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [sel, setSel] = useState(null);
  const [members, setMembers] = useState(null);
  const [addEmail, setAddEmail] = useState("");
  const [dateFor, setDateFor] = useState(null);
  const [dateVal, setDateVal] = useState("");

  const load = async () => {
    try {
      const { data } = await supabase.rpc("admin_sessions");
      setSessions(data || []);
      const { data: s } = await supabase.from("app_settings").select("value").eq("key", "default_access_weeks").maybeSingle();
      if (s && s.value != null) setWeeks(String(s.value));
      const { data: s2 } = await supabase.from("app_settings").select("value").eq("key", "require_login").maybeSingle();
      if (s2 && s2.value != null) setReqLogin(!!s2.value);
    } catch (e) { setSessions([]); }
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!label.trim()) return;
    setBusy(true); setNote("");
    const { error } = await supabase.rpc("admin_create_session", { p_label: label.trim() });
    setNote(error ? error.message : t("sess.created")); setLabel(""); await load(); setBusy(false);
  };
  const toggle = async (s) => { await supabase.from("sessions").update({ active: !s.active }).eq("id", s.id); await load(); if (sel && sel.id === s.id) setSel({ ...sel, active: !s.active }); };
  const saveWeeks = async () => {
    const n = parseInt(weeks, 10);
    if (!(n > 0)) { setNote(t("sess.weeksBad")); return; }
    const { error } = await supabase.from("app_settings").update({ value: n, updated_at: new Date().toISOString() }).eq("key", "default_access_weeks");
    setNote(error ? error.message : t("sess.weeksSaved"));
  };
  const toggleReqLogin = async () => {
    const next = !reqLogin;
    const { error } = await supabase.from("app_settings").upsert({ key: "require_login", value: next, updated_at: new Date().toISOString() });
    if (error) { setNote(error.message); return; }
    setReqLogin(next); setNote(next ? t("sess.loginOn") : t("sess.loginOff"));
  };
  const openMembers = async (s) => { setSel(s); setMembers(null); setAddEmail(""); setNote(""); const { data } = await supabase.rpc("admin_session_members", { p_session: s.id }); setMembers(data || []); };
  const addMember = async () => {
    if (!addEmail.trim()) return; setBusy(true);
    const { error } = await supabase.rpc("admin_add_member", { p_email: addEmail.trim(), p_session: sel.id });
    setNote(error ? error.message : t("sess.added")); setAddEmail(""); await openMembers(sel); setBusy(false);
  };
  const removeMember = async (uid) => { await supabase.rpc("admin_remove_member", { p_user: uid, p_session: sel.id }); await openMembers(sel); };
  const setAccess = async (uid, mode, until) => { await supabase.rpc("admin_set_access", { p_user: uid, p_mode: mode, p_until: until || null }); setDateFor(null); setDateVal(""); await openMembers(sel); };

  const pill = (fg) => ({ padding: "5px 10px", borderRadius: 8, border: `1px solid ${fg}`, background: "transparent", color: fg, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT });
  const box = { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: 14, marginBottom: 12 };
  const inputS = { background: T.bg, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", color: T.snow, fontSize: 13, outline: "none", fontFamily: FONT };

  if (sel) {
    return (
      <div>
        <button onClick={() => { setSel(null); setMembers(null); }} style={{ background: "transparent", border: "none", color: T.ice, cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 700 }}>{"\u2190 "}{t("sess.backList")}</button>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 2px" }}>{sel.label}</h2>
        <div style={{ fontSize: 12.5, color: T.dim, marginBottom: 14 }}>{t("sess.code")}: <b style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: T.snow }}>{sel.join_code}</b> {"\u00b7"} {sel.active ? t("sess.active") : t("sess.inactive")}</div>
        <div style={box}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{t("sess.addMember")}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder={t("sess.emailPlaceholder")} type="email" style={{ ...inputS, flex: 1 }} />
            <button style={pill(T.ice)} disabled={busy} onClick={addMember}>{t("sess.add")}</button>
          </div>
          <div style={{ fontSize: 11.5, color: T.dim, marginTop: 8 }}>{t("sess.addHint")}</div>
        </div>
        {note && <div style={{ fontSize: 12.5, color: T.dim, marginBottom: 10 }}>{note}</div>}
        {members === null ? <div style={{ color: T.dim, fontSize: 13 }}>{t("sess.loading")}</div> : members.length === 0 ? <div style={{ color: T.dim, fontSize: 13 }}>{t("sess.noMembers")}</div> : members.map((m) => {
          const expired = !m.access_unlimited && m.access_until && new Date(m.access_until) < new Date();
          const status = m.is_admin ? t("sess.adminUser") : m.access_unlimited ? t("sess.unlimited") : m.access_until ? (expired ? t("sess.expiredOn", { date: fmtD(m.access_until) }) : t("sess.untilDate", { date: fmtD(m.access_until) })) : t("sess.defaultWindow");
          return (
            <div key={m.user_id} style={box}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, wordBreak: "break-all" }}>{m.email}</div>
                <div style={{ fontSize: 12, color: expired ? "#ff8a80" : T.dim }}>{status}</div>
              </div>
              {!m.is_admin && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  <button style={pill(T.dim)} onClick={() => setAccess(m.user_id, "unlimited")}>{t("sess.setUnlimited")}</button>
                  <button style={pill(T.dim)} onClick={() => setAccess(m.user_id, "default")}>{t("sess.setDefault")}</button>
                  {dateFor === m.user_id ? (
                    <React.Fragment>
                      <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} style={inputS} />
                      <button style={pill(T.ice)} disabled={!dateVal} onClick={() => setAccess(m.user_id, "until", dateVal ? new Date(dateVal + "T23:59:59").toISOString() : null)}>{t("sess.save")}</button>
                      <button style={pill(T.dim)} onClick={() => { setDateFor(null); setDateVal(""); }}>{t("common.cancel")}</button>
                    </React.Fragment>
                  ) : (
                    <button style={pill(T.dim)} onClick={() => { setDateFor(m.user_id); setDateVal(""); }}>{t("sess.setDate")}</button>
                  )}
                  <button style={pill("#D6483B")} onClick={() => removeMember(m.user_id)}>{t("sess.remove")}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 2px" }}>{t("sess.title")}</h2>
      <p style={{ fontSize: 13, color: T.dim, margin: "0 0 14px", lineHeight: 1.5 }}>{t("sess.intro")}</p>
      <div style={box}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{t("sess.requireLogin")}</div>
        <button style={pill(reqLogin ? "#3FA372" : T.dim)} onClick={toggleReqLogin}>{reqLogin ? t("sess.on") : t("sess.off")}</button>
        <div style={{ fontSize: 11.5, color: T.dim, marginTop: 8 }}>{t("sess.loginHint")}</div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{t("sess.newSession")}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("sess.labelPlaceholder")} style={{ ...inputS, flex: 1 }} />
          <button style={pill(T.ice)} disabled={busy} onClick={create}>{t("sess.create")}</button>
        </div>
        <div style={{ fontSize: 11.5, color: T.dim, marginTop: 8 }}>{t("sess.newHint")}</div>
      </div>
      <div style={box}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>{t("sess.defaultAccess")}</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={weeks} onChange={(e) => setWeeks(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" style={{ ...inputS, width: 70 }} />
          <span style={{ fontSize: 13, color: T.dim }}>{t("sess.weeksLabel")}</span>
          <button style={pill(T.ice)} onClick={saveWeeks}>{t("sess.save")}</button>
        </div>
        <div style={{ fontSize: 11.5, color: T.dim, marginTop: 8 }}>{t("sess.defaultHint")}</div>
      </div>
      {note && <div style={{ fontSize: 12.5, color: T.dim, marginBottom: 10 }}>{note}</div>}
      {sessions === null ? <div style={{ color: T.dim, fontSize: 13 }}>{t("sess.loading")}</div> : sessions.map((s) => (
        <div key={s.id} style={box}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 14.5, fontWeight: 700 }}>{s.label}<span style={{ fontSize: 11.5, color: T.dim, fontWeight: 400 }}>{s.is_legacy ? " \u00b7 " + t("sess.legacy") : ""}</span></div>
            <div style={{ fontSize: 12, color: T.dim }}>{t("sess.members", { n: Number(s.members) })}</div>
          </div>
          <div style={{ fontSize: 12.5, color: T.dim, marginTop: 6 }}>{t("sess.code")}: <b style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: T.snow, letterSpacing: "1px" }}>{s.join_code}</b></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <button style={pill(T.ice)} onClick={() => openMembers(s)}>{t("sess.manage")}</button>
            {!s.is_legacy && <button style={pill(s.active ? "#D6483B" : "#3FA372")} onClick={() => toggle(s)}>{s.active ? t("sess.deactivate") : t("sess.activate")}</button>}
            <span style={{ fontSize: 12, color: s.active ? "#3FA372" : T.dim, alignSelf: "center" }}>{s.active ? t("sess.active") : t("sess.inactive")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
