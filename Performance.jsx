import React, { useState, useEffect } from "react";
import { loadRuns, loadDoc } from "./storage";
import { useLang } from "./i18n.jsx";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0", ice: "#7cc4ff",
  amber: "#f0812c", good: "#3FA372", warn: "#E0B93C", bad: "#D6483B", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const cap = (s) => (s && typeof s === "string" ? s[0].toUpperCase() + s.slice(1) : (s || "—"));

const TOPIC_LABEL = { terrain: "Terrain", snowpack: "Snowpack", weather: "Weather",
  forecast: "Forecast & Danger", planning: "Trip Planning", rescue: "Companion Rescue", travel: "Travel & Human Factors" };
const AST2_TOPIC = { snowpack: "Snowpack & Tests", problems: "Avalanche Problems", terrain: "Terrain & ATES",
  weather: "Weather & Evolution", planning: "Planning & Decisions", rescue: "Advanced Rescue", human: "Human & Group" };
const FORMAT_LABEL = { mc: "Multiple choice", tf: "True / False", match: "Matching" };

import { normalizeDanger } from "./DangerApp.jsx";
import { normalizeBulletin } from "./BulletinApp.jsx";
import { normalizeSnowtest } from "./SnowTestApp.jsx";
import { normalizeTerrain } from "./TerrainApp.jsx";
import { normalizeAtes } from "./AtesApp.jsx";
import { normalizeBeacon } from "./BeaconApp.jsx";

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
  { key: "slope", name: "Slope-Angle Trainer", accent: T.amber, dims: ["View", "Proximity", "Difficulty"],
    load: async () => { try { return normalizeSlope(await loadDoc("slope", { attempts: [] })); } catch (e) { return []; } } },
  { key: "card", name: "Crystal Card Trainer", accent: "#5AD1CF", dims: ["Skill", "Grain", "Difficulty"],
    load: async () => { try { return normalizeCard(await loadDoc("card", { attempts: [] })); } catch (e) { return []; } } },
  { key: "snowtest", name: "Snowpack-Test Interpreter", accent: "#8bd0c0", dims: ["Test", "Difficulty"],
    load: async () => { try { return normalizeSnowtest(await loadDoc("snowtest", { attempts: [] })); } catch (e) { return []; } } },
  { key: "danger", name: "Danger-Rating Trainer", accent: "#ef8b2b", dims: ["Band", "Difficulty"],
    load: async () => { try { return normalizeDanger(await loadDoc("danger", { attempts: [] })); } catch (e) { return []; } } },
  { key: "bulletin", name: "Bulletin Trainer", accent: "#7aa2c2", dims: ["Skill", "Difficulty"],
    load: async () => { try { return normalizeBulletin(await loadDoc("bulletin", { attempts: [] })); } catch (e) { return []; } } },
  { key: "terrain", name: "Terrain-Trap Trainer", accent: "#A6754C", dims: ["Feature", "Difficulty"],
    load: async () => { try { return normalizeTerrain(await loadDoc("terrain", { attempts: [] })); } catch (e) { return []; } } },
  { key: "ates", name: "ATES Terrain Classifier", accent: "#7fae6b", dims: ["Class", "Difficulty"],
    load: async () => { try { return normalizeAtes(await loadDoc("ates", { attempts: [] })); } catch (e) { return []; } } },
  { key: "beacon", name: "Beacon Search Simulator", accent: "#3fb6c9", dims: ["Result", "Difficulty"],
    load: async () => { try { return normalizeBeacon(await loadDoc("beacon", { attempts: [] })); } catch (e) { return []; } } },
  { key: "ast1", name: "AST 1 Practice", accent: T.ice, dims: ["Subject", "Format", "Difficulty"], learner: true, nTopics: 7,
    load: async () => { try { return normalizeAst1(await loadRuns("ast1")); } catch (e) { return []; } } },
  { key: "ast2", name: "AST 2 Practice", accent: "#b98cff", dims: ["Subject", "Format", "Difficulty"], learner: true, nTopics: 7,
    load: async () => { try { return normalizeAst2(await loadRuns("ast2")); } catch (e) { return []; } } },
];

const pctOf = (list) => (list.length ? Math.round((100 * list.filter((a) => a.correct).length) / list.length) : null);
const colorFor = (p) => (p == null ? T.dim : p >= 80 ? T.good : p >= 50 ? T.warn : T.bad);

// ==================== LEARNER ANALYTICS (exam tools) ====================
const DIFF_COLS = ["Easy", "Moderate", "Hard"];
const bandColor = (acc, n) => (n < 3 ? "#243040" : acc >= 0.85 ? T.good : acc >= 0.7 ? "#6FB98F"
  : acc >= 0.5 ? T.warn : T.bad);

const TOPIC_REV = {
  ast1: Object.fromEntries(Object.entries(TOPIC_LABEL).map(([k, v]) => [v, k])),
  ast2: Object.fromEntries(Object.entries(AST2_TOPIC).map(([k, v]) => [v, k])),
};
const VAL_KEY = {
  Format: { "Multiple choice": "exam.fmt.mc", "True / False": "exam.fmt.tf", "Matching": "exam.fmt.match" },
  Difficulty: { "Easy": "exam.diff.easy", "Moderate": "exam.diff.moderate", "Hard": "exam.diff.hard" },
  View: { "Field": "slope.view.field", "Profile": "slope.view.profile" },
  Proximity: { "Near (\u00b15\u00b0)": "perf.prox.near", "Clear of 30\u00b0": "perf.prox.clear" },
  Skill: { "Sizing": "card.trend.sizing", "Grain ID": "card.trend.grainId" },
  Band: { "Alpine": "danger.band.alp", "Treeline": "danger.band.tl", "Below treeline": "danger.band.btl" },
  Result: { "Strike": "beacon.res.strike", "Close": "beacon.res.close", "Miss": "beacon.res.miss" },
  Feature: { "Gully": "terrain.feat.gully.name", "Cliff": "terrain.feat.cliff.name", "Bench": "terrain.feat.bench.name", "Trees": "terrain.feat.trees.name", "Hollow": "terrain.feat.hollow.name", "Crevasse": "terrain.feat.crevasse.name", "Apron": "terrain.feat.apron.name", "Meadow": "terrain.feat.meadow.name", "Ridge": "terrain.feat.ridge.name", "Spread": "terrain.feat.spread.name" },
};
// Localize a dimension VALUE for display (grouping still uses the raw English value).
function dispVal(toolKey, dim, val, t) {
  if (val === "Unlogged") return t("perf.unlogged");
  if (dim === "Subject") {
    const rev = TOPIC_REV[toolKey];
    if (rev && rev[val]) { const k = "topic." + toolKey + "." + rev[val]; const s = t(k); return s === k ? val : s; }
    return val;
  }
  const m = VAL_KEY[dim];
  if (m && m[val]) return t(m[val]);
  return val;
}

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
const readinessLabel = (s) => s >= 85 ? "perf.readiness.ready" : s >= 70 ? "perf.readiness.approaching"
  : s >= 50 ? "perf.readiness.developing" : "perf.readiness.building";

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

function LearnerAnalytics({ timed, nTopics, accent, toolKey }) {
  const { t } = useLang();
  const rd = readinessScore(timed, nTopics);
  const grid = masteryGrid(timed);
  const cal = calibration(timed);

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 4 }}>
      {/* Readiness */}
      <SubHead note={t("perf.readiness.note")}>{t("perf.readiness.title")}</SubHead>
      {rd ? (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 30, fontWeight: 800, color: colorFor(rd.score), lineHeight: 1 }}>{rd.score}</div>
            <div style={{ fontSize: 13, color: T.snow, fontWeight: 700 }}>{t(readinessLabel(rd.score))}</div>
          </div>
          <div style={{ height: 7, background: "#0d141d", borderRadius: 4, overflow: "hidden", margin: "8px 0 6px" }}>
            <div style={{ height: "100%", width: `${rd.score}%`, background: colorFor(rd.score) }} />
          </div>
          <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.5 }}>
            {t("perf.readiness.detail", { acc: Math.round(rd.acc * 100), covered: rd.covered, nTopics: rd.nTopics, n: rd.n })}
            {rd.volume < 1 && <span>{t("perf.readiness.capped")}</span>}
          </div>
        </div>
      ) : <div style={{ fontSize: 12.5, color: T.dim }}>{t("perf.readiness.empty")}</div>}

      {/* Mastery map */}
      <SubHead note={t("perf.mastery.note")}>{t("perf.mastery.title")}</SubHead>
      {grid.length ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(3, 1fr)", gap: 3, fontSize: 10.5 }}>
            <div />
            {DIFF_COLS.map((d) => <div key={d} style={{ textAlign: "center", color: T.dim, fontWeight: 700, paddingBottom: 2 }}>{t("exam.diff." + d.toLowerCase())}</div>)}
            {grid.map((row) => (
              <React.Fragment key={row.topic}>
                <div style={{ color: T.snow, fontSize: 11, alignSelf: "center", paddingRight: 4, lineHeight: 1.2 }}>{dispVal(toolKey, "Subject", row.topic, t)}</div>
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
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: T.good, borderRadius: 2, marginRight: 4 }} />{t("perf.mastery.legendMastered")}</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: T.warn, borderRadius: 2, marginRight: 4 }} />{t("perf.mastery.legendDeveloping")}</span>
            <span><span style={{ display: "inline-block", width: 9, height: 9, background: T.bad, borderRadius: 2, marginRight: 4 }} />{t("perf.mastery.legendWeak")}</span>
          </div>
        </div>
      ) : <div style={{ fontSize: 12.5, color: T.dim }}>{t("perf.mastery.empty")}</div>}

      {/* Calibration */}
      <SubHead note={t("perf.cal.note")}>{t("perf.cal.title")}</SubHead>
      {cal.totalTagged >= 8 ? (
        <div>
          {cal.buckets.map((b) => (
            <div key={b.key} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                <span style={{ color: T.snow }}>{t("perf.cal." + b.key)} <span style={{ color: T.dim }}>· {b.n}</span></span>
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
              if (hi.acc - lo.acc >= 0.1) msg = t("perf.cal.wellCalibrated");
              else if (hi.acc < lo.acc) msg = t("perf.cal.inverted");
              else msg = t("perf.cal.notTracking");
            }
            if (hi.acc != null && hi.acc < 0.7 && hi.n >= 4) msg = (msg ? msg + " " : "") + t("perf.cal.overconfident");
            return msg ? <div style={{ fontSize: 11.5, color: T.dim, lineHeight: 1.5, marginTop: 6 }}>{msg}</div> : null;
          })()}
        </div>
      ) : <div style={{ fontSize: 12.5, color: T.dim }}>{t("perf.cal.empty")}</div>}
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
  const { t } = useLang();
  const [range, setRange] = useState("all");
  const [filters, setFilters] = useState({});
  const cardBase = { background: T.panel, border: `1px solid ${T.line}`, borderLeft: `4px solid ${tool.accent}`,
    borderRadius: 14, padding: 16, marginBottom: 16 };
  if (!attempts || !attempts.length) {
    return (
      <div style={cardBase}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{t("tool." + tool.key + ".name")}</div>
        <div style={{ fontSize: 13, color: T.dim, marginTop: 6 }}>{t("perf.noRuns")}</div>
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
        <div style={{ fontSize: 16, fontWeight: 800 }}>{t("tool." + tool.key + ".name")}</div>
        <div style={{ display: "flex", gap: 6 }}>{rangeChip("all", t("perf.range.all"))}{rangeChip("30", t("perf.range.30"))}{rangeChip("7", t("perf.range.7"))}</div>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 8 }}>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 34, fontWeight: 800, color: colorFor(overall), lineHeight: 1 }}>{overall == null ? "—" : overall + "%"}</div>
        <div style={{ fontSize: 12.5, color: T.dim }}>{t(filtered.length === 1 ? "perf.qOne" : "perf.qMany", { n: filtered.length })}{active.length ? t("perf.filtered") : ""}</div>
      </div>
      <div style={{ marginTop: 4 }}><Sparkline attempts={filtered} /></div>
      {active.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", margin: "6px 0 2px" }}>
          {active.map(([d, v]) => (
            <span key={d} onClick={() => toggle(d, v)} style={{ fontSize: 11.5, color: T.snow, background: "rgba(124,196,255,0.12)",
              border: `1px solid ${T.ice}`, borderRadius: 20, padding: "3px 9px", cursor: "pointer" }}>{t("perf.dim." + d)}: {dispVal(tool.key, d, v, t)} \u2715</span>
          ))}
          <button onClick={() => setFilters({})} style={{ fontSize: 11.5, color: T.dim, background: "none", border: "none", cursor: "pointer" }}>{t("perf.clearAll")}</button>
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
            <div style={{ fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", color: T.dim, marginBottom: 6 }}>{t("perf.dim." + d)}</div>
            {rows.map((r) => <Bar key={r.val} label={dispVal(tool.key, d, r.val, t)} n={r.n} pct={r.pct} active={filters[d] === r.val} onClick={() => toggle(d, r.val)} />)}
          </div>
        );
      })}
      {tool.learner && <LearnerAnalytics timed={timed} nTopics={tool.nTopics} accent={tool.accent} toolKey={tool.key} />}
    </div>
  );
}

// Reusable panel set — renders one ToolPanel per tool from already-loaded attempts.
export function AnalyticsPanels({ attemptsByTool }) {
  return <>{TOOLS.map((t) => <ToolPanel key={t.key} tool={t} attempts={(attemptsByTool && attemptsByTool[t.key]) || []} />)}</>;
}

export function Performance({ onHome, session }) {
  const { t } = useLang();
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
        {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 600 }}>{t("nav.allTools")}</button>}
        <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>{t("perf.eyebrow")}</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 2px" }}>{t("perf.h1")}</h1>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 16px", lineHeight: 1.5 }}>{t("perf.intro")}</p>
        {!signedIn ? (
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, fontSize: 13.5, color: T.dim }}>{t("perf.signIn")}</div>
        ) : data == null ? (
          <div style={{ fontSize: 13, color: T.dim }}>{t("perf.loading")}</div>
        ) : (
          <AnalyticsPanels attemptsByTool={data} />
        )}
      </div>
    </div>
  );
}
