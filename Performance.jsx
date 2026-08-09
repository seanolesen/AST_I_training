import React, { useState, useEffect } from "react";
import { loadRuns, loadDoc } from "./storage";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0", ice: "#7cc4ff",
  amber: "#f0812c", good: "#3FA372", warn: "#E0B93C", bad: "#D6483B", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const cap = (s) => (s && typeof s === "string" ? s[0].toUpperCase() + s.slice(1) : (s || "—"));

const TOPIC_LABEL = { terrain: "Terrain", snowpack: "Snowpack", weather: "Weather",
  forecast: "Forecast & Danger", planning: "Trip Planning", rescue: "Companion Rescue", travel: "Travel & Human Factors" };
const AST2_TOPIC = { snowpack: "Snowpack & Tests", problems: "Avalanche Problems", terrain: "Terrain & ATES",
  weather: "Weather & Evolution", planning: "Planning & Decisions", rescue: "Advanced Rescue", human: "Human & Group" };
const FORMAT_LABEL = { mc: "Multiple choice", tf: "True / False", match: "Matching" };

// ---- Pure normalizers: raw stored data -> flat attempts {correct, ts, dims{}} ----
function normalizeExam(payloads, topicMap) {
  const out = [];
  for (const r of payloads || []) {
    if (Array.isArray(r.questions) && r.questions.length) {
      for (const q of r.questions)
        out.push({ correct: !!q.correct, ts: r.ts || 0, conf: q.conf ?? null,
          dims: { Subject: topicMap[q.topic] || cap(q.topic), Format: FORMAT_LABEL[q.type] || cap(q.type), Difficulty: cap(q.diff) } });
    } else if (r.byTopic) {
      for (const [tk, v] of Object.entries(r.byTopic))
        for (let i = 0; i < v.n; i++)
          out.push({ correct: i < v.c, ts: r.ts || 0, dims: { Subject: topicMap[tk] || cap(tk), Format: "Unlogged", Difficulty: "Unlogged" } });
    } else if (typeof r.correct === "number" && typeof r.total === "number") {
      for (let i = 0; i < r.total; i++)
        out.push({ correct: i < r.correct, ts: r.ts || 0, dims: { Subject: "Unlogged", Format: "Unlogged", Difficulty: "Unlogged" } });
    }
  }
  return out;
}
export const normalizeAst1 = (payloads) => normalizeExam(payloads, TOPIC_LABEL);
export const normalizeAst2 = (payloads) => normalizeExam(payloads, AST2_TOPIC);
export function normalizeSlope(hist) {
  const at = (hist && hist.attempts) || [];
  return at.map((a) => ({ correct: !!a.correct, ts: a.ts || 0, dims: {
    View: a.view === "field" ? "Field" : "Profile",
    Proximity: Math.abs(a.angle - 30) <= 5 ? "Near (\u00b15\u00b0)" : "Clear of 30\u00b0",
    Difficulty: cap(a.diff),
  } }));
}
const GRAIN_LABEL = { PP: "New snow", DF: "Decomposing", RG: "Rounded", FC: "Faceted",
  DH: "Depth hoar", SH: "Surface hoar", MF: "Melt-freeze" };
export function normalizeCard(hist) {
  const at = (hist && hist.attempts) || [];
  return at.map((a) => ({ correct: !!a.correct, ts: a.ts || 0, dims: {
    Skill: a.mode === "size" ? "Sizing" : "Grain ID",
    Grain: GRAIN_LABEL[a.code] || cap(a.code),
    Difficulty: cap(a.diff),
  } }));
}

// ---- Registry (add a tool here to give it a panel everywhere) ----
export const TOOLS = [
  { key: "ast1", name: "AST 1 Practice", accent: T.ice, dims: ["Subject", "Format", "Difficulty"], learner: true, nTopics: 7,
    load: async () => { try { return normalizeAst1(await loadRuns("ast1")); } catch (e) { return []; } } },
  { key: "ast2", name: "AST 2 Practice", accent: "#b98cff", dims: ["Subject", "Format", "Difficulty"], learner: true, nTopics: 7,
    load: async () => { try { return normalizeAst2(await loadRuns("ast2")); } catch (e) { return []; } } },
  { key: "slope", name: "Slope-Angle Trainer", accent: T.amber, dims: ["View", "Proximity", "Difficulty"],
    load: async () => { try { return normalizeSlope(await loadDoc("slope", { attempts: [] })); } catch (e) { return []; } } },
  { key: "card", name: "Crystal Card Trainer", accent: "#5AD1CF", dims: ["Skill", "Grain", "Difficulty"],
    load: async () => { try { return normalizeCard(await loadDoc("card", { attempts: [] })); } catch (e) { return []; } } },
];

const pctOf = (list) => (list.length ? Math.round((100 * list.filter((a) => a.correct).length) / list.length) : null);
const colorFor = (p) => (p == null ? T.dim : p >= 80 ? T.good : p >= 50 ? T.warn : T.bad);

// ==================== LEARNER ANALYTICS (exam tools) ====================
const DIFF_COLS = ["Easy", "Moderate", "Hard"];
const bandColor = (acc, n) => (n < 3 ? "#243040" : acc >= 0.85 ? T.good : acc >= 0.7 ? "#6FB98F"
  : acc >= 0.5 ? T.warn : T.bad);

function readinessScore(timed, nTopics) {
  const logged = timed.filter((a) => a.dims.Subject !== "Unlogged");
  if (!logged.length) return null;
  const acc = logged.filter((a) => a.correct).length / logged.length;
  const byT = {};
  for (const a of logged) { const t = a.dims.Subject; (byT[t] = byT[t] || { c: 0, n: 0 }); byT[t].n++; if (a.correct) byT[t].c++; }
  const covered = Object.values(byT).filter((t) => t.n >= 5);
  const masteryMean = covered.length ? covered.reduce((s, t) => s + t.c / t.n, 0) / covered.length : acc;
  const breadth = nTopics ? Math.min(1, covered.length / nTopics) : 1;
  const volume = Math.min(1, logged.length / 150);
  const base = 0.55 * acc + 0.30 * masteryMean + 0.15 * breadth;
  const score = Math.round(100 * base * (0.5 + 0.5 * volume));
  return { score, acc, covered: covered.length, nTopics, volume, n: logged.length };
}
const readinessLabel = (s) => s >= 85 ? "Exam-ready (self-study)" : s >= 70 ? "Approaching ready"
  : s >= 50 ? "Developing" : "Building foundation";

function masteryGrid(timed) {
  const rows = {};
  for (const a of timed) {
    const t = a.dims.Subject, d = a.dims.Difficulty;
    if (t === "Unlogged" || !DIFF_COLS.includes(d)) continue;
    (rows[t] = rows[t] || {});
    (rows[t][d] = rows[t][d] || { c: 0, n: 0 });
    rows[t][d].n++; if (a.correct) rows[t][d].c++;
  }
  return Object.entries(rows).map(([topic, cells]) => ({ topic, cells })).sort((a, b) => a.topic.localeCompare(b.topic));
}

function calibration(timed) {
  const order = [["low", "Low"], ["med", "Med"], ["high", "High"]];
  const buckets = order.map(([k, l]) => {
    const list = timed.filter((a) => a.conf === k);
    return { key: k, label: l, n: list.length, acc: list.length ? list.filter((a) => a.correct).length / list.length : null };
  });
  return { buckets, totalTagged: buckets.reduce((s, b) => s + b.n, 0) };
}

function SubHead({ children, note }) {
  return (
    <div style={{ marginTop: 18, marginBottom: 8 }}>
      <div style={{ fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", color: T.dim }}>{children}</div>
      {note && <div style={{ fontSize: 11, color: "#6E8291", marginTop: 2, lineHeight: 1.4 }}>{note}</div>}
    </div>
  );
}

function LearnerAnalytics({ timed, nTopics, accent }) {
  const rd = readinessScore(timed, nTopics);
  const grid = masteryGrid(timed);
  const cal = calibration(timed);

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 4 }}>
      {/* Readiness */}
      <SubHead note="Self-study heuristic from accuracy, topic breadth, and volume — not an official readiness measure.">Readiness</SubHead>
      {rd ? (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 30, fontWeight: 800, color: colorFor(rd.score), lineHeight: 1 }}>{rd.score}</div>
            <div style={{ fontSize: 13, color: T.snow, fontWeight: 700 }}>{readinessLabel(rd.score)}</div>
          </div>
          <div style={{ height: 7, background: "#0d141d", borderRadius: 4, overflow: "hidden", margin: "8px 0 6px" }}>
            <div style={{ height: "100%", width: `${rd.score}%`, background: colorFor(rd.score) }} />
          </div>
          <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.5 }}>
            {Math.round(rd.acc * 100)}% accuracy · {rd.covered}/{rd.nTopics} topics with enough data · {rd.n} question{rd.n === 1 ? "" : "s"} logged
            {rd.volume < 1 && <span> · score is capped until you’ve logged more (~150)</span>}
          </div>
        </div>
      ) : <div style={{ fontSize: 12.5, color: T.dim }}>Run a recorded set with per-question logging to unlock a readiness score.</div>}

      {/* Mastery map */}
      <SubHead note="Accuracy by topic × difficulty. Cells with under 3 seen stay muted.">Mastery map</SubHead>
      {grid.length ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(3, 1fr)", gap: 3, fontSize: 10.5 }}>
            <div />
            {DIFF_COLS.map((d) => <div key={d} style={{ textAlign: "center", color: T.dim, fontWeight: 700, paddingBottom: 2 }}>{d}</div>)}
            {grid.map((row) => (
              <React.Fragment key={row.topic}>
                <div style={{ color: T.snow, fontSize: 11, alignSelf: "center", paddingRight: 4, lineHeight: 1.2 }}>{row.topic}</div>
                {DIFF_COLS.map((d) => {
                  const cell = row.cells[d];
                  const n = cell ? cell.n : 0, acc = cell ? cell.c / cell.n : null;
                  return (
                    <div key={d} title={cell ? `${cell.c}/${cell.n}` : "no data"}
                      style={{ background: acc == null ? "#141c26" : bandColor(acc, n), borderRadius: 5, minHeight: 30,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: acc == null ? "#3E4E5E" : (n < 3 ? T.dim : "#0c1218"), fontWeight: 800, fontSize: 11 }}>
                      {acc == null ? "—" : Math.round(acc * 100) + "%"}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8, fontSize: 10.5, color: T.dim }}>
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: T.good, borderRadius: 2, marginRight: 4 }} />Mastered 85%+</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: T.warn, borderRadius: 2, marginRight: 4 }} />Developing 50–69%</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: T.bad, borderRadius: 2, marginRight: 4 }} />Weak &lt;50%</span>
          </div>
        </div>
      ) : <div style={{ fontSize: 12.5, color: T.dim }}>Topic × difficulty mastery appears once you’ve logged some questions.</div>}

      {/* Calibration */}
      <SubHead note="Are you right as often as you feel? Set confidence on questions to build this.">Calibration</SubHead>
      {cal.totalTagged >= 8 ? (
        <div>
          {cal.buckets.map((b) => (
            <div key={b.key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: T.snow }}>{b.label} confidence <span style={{ color: T.dim }}>· {b.n}</span></span>
                <span style={{ color: b.acc == null ? T.dim : colorFor(b.acc * 100), fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>{b.acc == null ? "—" : Math.round(b.acc * 100) + "%"}</span>
              </div>
              <div style={{ height: 6, background: "#0d141d", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${(b.acc || 0) * 100}%`, background: b.acc == null ? T.dim : colorFor(b.acc * 100) }} />
              </div>
            </div>
          ))}
          {(() => {
            const hi = cal.buckets[2], lo = cal.buckets[0];
            let msg = null;
            if (hi.acc != null && lo.acc != null) {
              if (hi.acc - lo.acc >= 0.1) msg = "Well calibrated — you're right more often when you feel confident.";
              else if (hi.acc < lo.acc) msg = "Inverted — you're missing more of the questions you felt sure about. Slow down on “High” answers.";
              else msg = "Confidence isn't tracking accuracy yet — your hit rate is similar regardless of how sure you feel.";
            }
            if (hi.acc != null && hi.acc < 0.7 && hi.n >= 4) msg = (msg ? msg + " " : "") + "You're overconfident on “High” answers.";
            return msg ? <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>{msg}</div> : null;
          })()}
        </div>
      ) : <div style={{ fontSize: 12.5, color: T.dim }}>Tap Low / Med / High on questions as you answer — once you’ve tagged ~8, your confidence-vs-accuracy calibration shows here.</div>}
    </div>
  );
}

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
        <span style={{ color: T.snow }}>{label} <span style={{ color: T.dim }}>· {n}</span></span>
        <span style={{ color: col, fontWeight: 700, fontFamily: "ui-monospace, Menlo, monospace" }}>{pct == null ? "—" : pct + "%"}</span>
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
  if (!attempts || !attempts.length) {
    return (
      <div style={cardBase}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{tool.name}</div>
        <div style={{ fontSize: 13, color: T.dim, marginTop: 6 }}>No recorded runs yet.</div>
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
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 34, fontWeight: 800, color: colorFor(overall), lineHeight: 1 }}>{overall == null ? "—" : overall + "%"}</div>
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
      {tool.learner && <LearnerAnalytics timed={timed} nTopics={tool.nTopics} accent={tool.accent} />}
    </div>
  );
}

// Reusable panel set — renders one ToolPanel per tool from already-loaded attempts.
export function AnalyticsPanels({ attemptsByTool }) {
  return <>{TOOLS.map((t) => <ToolPanel key={t.key} tool={t} attempts={(attemptsByTool && attemptsByTool[t.key]) || []} />)}</>;
}

export function Performance({ onHome, session }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(TOOLS.map(async (t) => [t.key, await t.load()]));
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
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 16px", lineHeight: 1.5 }}>Tap any bar to filter, and combine filters across categories. Exam runs recorded before per-question logging appear as "Unlogged" for format and difficulty.</p>
        {!signedIn ? (
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, fontSize: 13.5, color: T.dim }}>Sign in from the top bar to see your synced performance across devices.</div>
        ) : data == null ? (
          <div style={{ fontSize: 13, color: T.dim }}>Loading your history…</div>
        ) : (
          <AnalyticsPanels attemptsByTool={data} />
        )}
      </div>
    </div>
  );
}
