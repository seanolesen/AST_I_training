import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { AnalyticsPanels, normalizeAst1, normalizeAst2, normalizeSlope } from "./Performance.jsx";
import { useLang } from "./i18n.jsx";

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
    if (isSuper(p.email)) return; // permanent
    setBusyId(p.id);
    try {
      const next = !p.is_admin;
      const { error } = await supabase.from("profiles").update({ is_admin: next }).eq("id", p.id);
      if (!error) setState((s) => ({ ...s, profiles: s.profiles.map((x) => (x.id === p.id ? { ...x, is_admin: next } : x)) }));
    } finally { setBusyId(null); }
  };

  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow, fontFamily: FONT, padding: "22px 14px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 720, margin: "0 auto" };
  const back = (label, fn) => <button onClick={fn} style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 600 }}>{label}</button>;

  // ---- selected user drill-in ----
  if (selected) {
    const p = state.profiles.find((x) => x.id === selected);
    const payloads = state.runsByUser[selected] || [];
    const docs = state.docsByUser[selected] || {};
    const attemptsByTool = {
      ast1: normalizeAst1(payloads.filter((x) => (x.app || "ast1") === "ast1")),
      ast2: normalizeAst2(payloads.filter((x) => x.app === "ast2")),
      slope: normalizeSlope(docs.slope || { attempts: [] }),
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

  // ---- list ----
  return (
    <div style={wrap}><div style={inner}>
      {onHome && back(t("nav.allTools"), onHome)}
      <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>{t("sa.eyebrow")}</div>
      <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 4px" }}>{t("sa.h1")}</h1>
      <p style={{ fontSize: 13, color: T.dim, margin: "0 0 16px", lineHeight: 1.5 }}>{t("sa.intro")}</p>

      {state.loading ? <div style={{ color: T.dim, fontSize: 13 }}>{t("sa.loading")}</div>
        : state.error === "signin" ? <div style={{ color: T.dim, fontSize: 13 }}>{t("sa.signin")}</div>
        : !iAmAdmin ? <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, color: T.dim, fontSize: 13 }}>{t("sa.noAccess")}</div>
        : state.error ? <div style={{ color: T.bad, fontSize: 13 }}>{t("sa.loadError", { error: state.error })}</div>
        : (
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
                      <button onClick={() => toggleAdmin(p)} disabled={busyId === p.id}
                        style={{ fontSize: 11.5, fontWeight: 700, cursor: "pointer", borderRadius: 6, padding: "4px 9px",
                          border: `1px solid ${p.is_admin ? T.ice : T.line}`, background: p.is_admin ? "rgba(124,196,255,0.14)" : "transparent",
                          color: p.is_admin ? T.ice : T.dim }}>
                        {p.is_admin ? t("sa.adminYes") : t("sa.makeAdmin")}
                      </button>
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
              </div>
            );
          })}
          {state.profiles.length === 0 && <div style={{ color: T.dim, fontSize: 13 }}>{t("sa.noUsers")}</div>}
        </div>
      )}
    </div></div>
  );
}
