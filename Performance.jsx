import React, { useState, useEffect } from "react";
import { loadRuns, loadDoc } from "./storage";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0", ice: "#7cc4ff",
  amber: "#f0812c", good: "#3FA372", warn: "#E0B93C", bad: "#D6483B", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const cap = (s) => (s && typeof s === "string" ? s[0].toUpperCase() + s.slice(1) : (s || "\u2014"));

const TOPIC_LABEL = { terrain: "Terrain", snowpack: "Snowpack", weather: "Weather",
  forecast: "Forecast & Danger", planning: "Trip Planning", rescue: "Companion Rescue", travel: "Travel & Human Factors" };
const FORMAT_LABEL = { mc: "Multiple choice", tf: "True / False", match: "Matching" };

// ---- Normalize each tool's stored data into flat attempts: {correct, ts, dims{}} ----
async function loadAst1() {
  let runs = [];
  try { runs = await loadRuns("ast1"); } catch (e) { runs = []; }
  const out = [];
  for (const r of runs || []) {
    if (Array.isArray(r.questions) && r.questions.length) {
      for (const q of r.questions)
        out.push({ correct: !!q.correct, ts: r.ts || 0,
          dims: { Subject: TOPIC_LABEL[q.topic] || cap(q.topic), Format: FORMAT_LABEL[q.type] || cap(q.type), Difficulty: cap(q.diff) } });
    } else if (r.byTopic) {
      for (const [tk, v] of Object.entries(r.byTopic))
        for (let i = 0; i < v.n; i++)
          out.push({ correct: i < v.c, ts: r.ts || 0,
            dims: { Subject: TOPIC_LABEL[tk] || cap(tk), Format: "Unlogged", Difficulty: "Unlogged" } });
    } else if (typeof r.correct === "number" && typeof r.total === "number") {
      for (let i = 0; i < r.total; i++)
        out.push({ correct: i < r.correct, ts: r.ts || 0, dims: { Subject: "Unlogged", Format: "Unlogged", Difficulty: "Unlogged" } });
    }
  }
  return out;
}
async function loadSlope() {
  let hist = { attempts: [] };
  try { hist = await loadDoc("slope", { attempts: [] }); } catch (e) { hist = { attempts: [] }; }
  const at = (hist && hist.attempts) || [];
  return at.map((a) => ({ correct: !!a.correct, ts: a.ts || 0, dims: {
    View: a.view === "field" ? "Field" : "Profile",
    Proximity: Math.abs(a.angle - 30) <= 5 ? "Near (\u00b15\u00b0)" : "Clear of 30\u00b0",
    Difficulty: cap(a.diff),
  } }));
}

// Registry — add a new tool here to give it its own performance panel.
const AST2_TOPIC = { snowpack: "Snowpack & Tests", problems: "Avalanche Problems", terrain: "Terrain & ATES",
  weather: "Weather & Evolution", planning: "Planning & Decisions", rescue: "Advanced Rescue", human: "Human & Group" };
async function loadAst2() {
  let runs = [];
  try { runs = await loadRuns("ast2"); } catch (e) { runs = []; }
  const out = [];
  for (const r of runs || []) {
    if (Array.isArray(r.questions) && r.questions.length) {
      for (const q of r.questions)
        out.push({ correct: !!q.correct, ts: r.ts || 0,
          dims: { Subject: AST2_TOPIC[q.topic] || cap(q.topic), Format: FORMAT_LABEL[q.type] || cap(q.type), Difficulty: cap(q.diff) } });
    } else if (typeof r.correct === "number" && typeof r.total === "number") {
      for (let i = 0; i < r.total; i++)
        out.push({ correct: i < r.correct, ts: r.ts || 0, dims: { Subject: "Unlogged", Format: "Unlogged", Difficulty: "Unlogged" } });
    }
  }
  return out;
}

const TOOLS = [
  { key: "ast1", name: "AST 1 Practice", accent: T.ice, dims: ["Subject", "Format", "Difficulty"], load: loadAst1 },
  { key: "ast2", name: "AST 2 Practice", accent: "#b98cff", dims: ["Subject", "Format", "Difficulty"], load: loadAst2 },
  { key: "slope", name: "Slope-Angle Trainer", accent: T.amber, dims: ["View", "Proximity", "Difficulty"], load: loadSlope },
];

const pctOf = (list) => (list.length ? Math.round((100 * list.filter((a) => a.correct).length) / list.length) : null);
const colorFor = (p) => (p == null ? T.dim : p >= 80 ? T.good : p >= 50 ? T.warn : T.bad);

function Sparkline({ attempts }) {
  const sorted = [...attempts].sort((a, b) => a.ts - b.ts);
  if (sorted.length < 4) return null;
  const nB = Math.min(10, Math.max(3, Math.floor(sorted.length / 3)));
  const size = Math.ceil(sorted.length / nB);
  const buckets = [];
  for (let i = 0; i < sorted.length; i += size) buckets.push(pctOf(sorted.slice(i, i + size)));
  if (buckets.length < 2) return null;
  const W = 240, H = 44, pad = 4;
  const x = (i) => pad + (i / (buckets.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  const pts = buckets.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
      <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={T.line} strokeWidth="1" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={T.ice} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {buckets.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === buckets.length - 1 ? 3.2 : 2} fill={i === buckets.length - 1 ? T.ice : T.dim} />)}
    </svg>
  );
}

function Bar({ label, n, pct, active, onClick }) {
  const col = colorFor(pct);
  return (
    <button onClick={onClick}
      style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer",
        background: active ? "rgba(124,196,255,0.10)" : "transparent",
        border: active ? `1px solid ${T.ice}` : "1px solid transparent", borderRadius: 8, padding: "6px 8px", marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
        <span style={{ color: T.snow }}>{label} <span style={{ color: T.dim }}>\u00b7 {n}</span></span>
        <span style={{ color: col, fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>{pct == null ? "\u2014" : pct + "%"}</span>
      </div>
      <div style={{ height: 6, background: "#0d141d", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct || 0}%`, background: col }} />
      </div>
    </button>
  );
}

function ToolPanel({ tool, attempts }) {
  const [range, setRange] = useState("all");
  const [filters, setFilters] = useState({});

  const cardBase = { background: T.panel, border: `1px solid ${T.line}`, borderLeft: `4px solid ${tool.accent}`,
    borderRadius: 14, padding: 16, marginBottom: 16 };

  if (!attempts.length) {
    return (
      <div style={cardBase}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{tool.name}</div>
        <div style={{ fontSize: 13, color: T.dim, marginTop: 6 }}>No recorded runs yet. Finish a set while signed in and it will show up here.</div>
      </div>
    );
  }

  const now = Date.now();
  const cutoff = range === "30" ? now - 30 * 864e5 : range === "7" ? now - 7 * 864e5 : 0;
  const timed = attempts.filter((a) => (a.ts || 0) >= cutoff);
  const filtered = timed.filter((a) => Object.entries(filters).every(([d, v]) => v == null || a.dims[d] === v));
  const overall = pctOf(filtered);
  const toggle = (d, v) => setFilters((f) => ({ ...f, [d]: f[d] === v ? undefined : v }));
  const active = Object.entries(filters).filter(([, v]) => v != null);

  const rangeChip = (val, lab) => (
    <button onClick={() => setRange(val)} style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, cursor: "pointer",
      border: `1px solid ${range === val ? tool.accent : T.line}`, background: range === val ? "rgba(124,196,255,0.12)" : "transparent",
      color: range === val ? T.snow : T.dim }}>{lab}</button>
  );

  return (
    <div style={cardBase}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{tool.name}</div>
        <div style={{ display: "flex", gap: 6 }}>{rangeChip("all", "All time")}{rangeChip("30", "30d")}{rangeChip("7", "7d")}</div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 34, fontWeight: 800, color: colorFor(overall), lineHeight: 1 }}>{overall == null ? "\u2014" : overall + "%"}</div>
        <div style={{ fontSize: 12.5, color: T.dim }}>{filtered.length} question{filtered.length === 1 ? "" : "s"}{active.length ? " (filtered)" : ""}</div>
      </div>
      <div style={{ marginTop: 4 }}><Sparkline attempts={filtered} /></div>

      {active.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "6px 0 2px" }}>
          {active.map(([d, v]) => (
            <span key={d} onClick={() => toggle(d, v)} style={{ fontSize: 11.5, color: T.snow, background: "rgba(124,196,255,0.12)",
              border: `1px solid ${T.ice}`, borderRadius: 20, padding: "3px 9px", cursor: "pointer" }}>{d}: {v} \u2715</span>
          ))}
          <button onClick={() => setFilters({})} style={{ fontSize: 11.5, color: T.dim, background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
        </div>
      )}

      {tool.dims.map((d) => {
        const base = timed.filter((a) => Object.entries(filters).filter(([fd]) => fd !== d).every(([fd, fv]) => fv == null || a.dims[fd] === fv));
        const groups = {};
        for (const a of base) { const val = a.dims[d]; (groups[val] = groups[val] || []).push(a); }
        const rows = Object.entries(groups).map(([val, list]) => ({ val, n: list.length, pct: pctOf(list) }))
          .sort((a, b) => (a.pct == null ? 999 : a.pct) - (b.pct == null ? 999 : b.pct));
        if (!rows.length) return null;
        return (
          <div key={d} style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", color: T.dim, marginBottom: 6 }}>{d}</div>
            {rows.map((r) => <Bar key={r.val} label={r.val} n={r.n} pct={r.pct} active={filters[d] === r.val} onClick={() => toggle(d, r.val)} />)}
          </div>
        );
      })}
    </div>
  );
}

export function Performance({ onHome, session }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(TOOLS.map(async (t) => [t.key, await t.load().catch(() => [])]));
      if (alive) setData(Object.fromEntries(entries));
    })();
    return () => { alive = false; };
  }, []);

  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow, fontFamily: FONT, padding: "22px 14px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 560, margin: "0 auto" };
  const signedIn = session && session.user;

  return (
    <div style={wrap}>
      <div style={inner}>
        {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 600 }}>\u2190 All tools</button>}
        <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>Performance analysis</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 2px" }}>Your accuracy across every tool</h1>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 16px", lineHeight: 1.5 }}>Tap any bar to filter, and combine filters across categories. AST 1 runs recorded before per-question logging appear as "Unlogged" for format and difficulty.</p>
        {!signedIn ? (
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, fontSize: 13.5, color: T.dim }}>
            Sign in from the top bar to see your synced performance across devices.
          </div>
        ) : data == null ? (
          <div style={{ fontSize: 13, color: T.dim }}>Loading your history\u2026</div>
        ) : (
          TOOLS.map((t) => <ToolPanel key={t.key} tool={t} attempts={data[t.key] || []} />)
        )}
      </div>
    </div>
  );
}
