import React from "react";

// Summarize a tool's recorded attempts for the setup "your recent results" guide.
// Works on the drills (no session id): overall accuracy, per-difficulty accuracy,
// and a sparkline grouped into sessions by time gap.
export function computeTrend(attempts) {
  const at = (attempts || []).filter((a) => a && typeof a.correct !== "undefined");
  const n = at.length;
  if (!n) return { n: 0, acc: null, byDiff: [], sessions: [] };
  const acc = Math.round((at.filter((a) => a.correct).length / n) * 100);

  const per = {};
  for (const a of at) {
    const d = a.difficulty || a.diff || "moderate";
    (per[d] = per[d] || { c: 0, n: 0 });
    per[d].n++;
    if (a.correct) per[d].c++;
  }
  const byDiff = ["easy", "moderate", "hard"]
    .filter((k) => per[k])
    .map((k) => ({ k, acc: Math.round((per[k].c / per[k].n) * 100), n: per[k].n }));

  const sorted = [...at].sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const GAP = 20 * 60 * 1000; // attempts >20 min apart start a new "session"
  const sess = [];
  let cur = null;
  for (const a of sorted) {
    if (!cur || (a.ts || 0) - cur.last > GAP) { cur = { c: 0, n: 0, last: a.ts || 0 }; sess.push(cur); }
    cur.n++;
    if (a.correct) cur.c++;
    cur.last = a.ts || 0;
  }
  const sessions = sess.map((s) => ({ acc: Math.round((s.c / s.n) * 100), n: s.n }));
  return { n, acc, byDiff, sessions };
}

const MONO_DEFAULT = "ui-monospace, Menlo, monospace";
const accCol = (C, a) => (a == null ? C.textDim : a >= 80 ? C.good : a >= 50 ? (C.warn || C.threshold || "#F0812C") : C.bad);

function Spark({ sessions, C }) {
  const d = sessions.slice(-12);
  if (d.length < 2) return null;
  const W = 240, H = 40, pad = 4;
  const x = (i) => pad + (i / (d.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  const pts = d.map((s, i) => `${x(i)},${y(s.acc)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
      <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={C.line} strokeWidth="1" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={C.ice} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {d.map((s, i) => (
        <circle key={i} cx={x(i)} cy={y(s.acc)} r={i === d.length - 1 ? 3.2 : 2} fill={i === d.length - 1 ? C.ice : C.textDim} />
      ))}
    </svg>
  );
}

// History guide for a tool's setup screen. Renders nothing until there's data.
//   attempts: array of recorded attempts ({ correct, difficulty, ts })
//   C: the tool's color palette   t: i18n function   dl: { easy, moderate, hard } labels
export function TrendGuide({ attempts, C, t, MONO, dl }) {
  const tr = computeTrend(attempts);
  if (!tr.n) return null;
  const mono = MONO || MONO_DEFAULT;
  const cell = { flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: "7px 6px", textAlign: "center" };
  return (
    <div style={{ background: C.panel || C.slate2, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.6px", textTransform: "uppercase", color: C.textDim }}>{t("trend.header")}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 34, fontWeight: 700, lineHeight: 1, color: accCol(C, tr.acc) }}>{tr.acc == null ? "\u2014" : tr.acc + "%"}</div>
          <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 3 }}>{t("trend.overN", { n: tr.n })}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}><Spark sessions={tr.sessions} C={C} /></div>
      </div>
      {tr.byDiff.length >= 2 && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {tr.byDiff.map((b) => (
            <div key={b.k} style={cell}>
              <div style={{ fontSize: 10.5, color: C.textDim }}>{(dl && dl[b.k]) || b.k}</div>
              <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: accCol(C, b.acc) }}>{b.acc}%</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: 11, color: C.textMute, marginTop: 10, lineHeight: 1.4 }}>{t("trend.hint")}</div>
    </div>
  );
}
