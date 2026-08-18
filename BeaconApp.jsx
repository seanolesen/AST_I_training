import React, { useState, useEffect } from "react";
import { loadDoc, saveDoc } from "./storage";
import { useLang } from "./i18n.jsx";

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C", screen: "#0a2a12", screenText: "#57e08a" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";

const DIFF = {
  easy:     { w: 10, h: 10, noise: 0.0, strikeTol: 1.2 },
  moderate: { w: 12, h: 12, noise: 0.15, strikeTol: 0.9 },
  hard:     { w: 14, h: 14, noise: 0.35, strikeTol: 0.7 },
};

function makeSearch(difficulty) {
  const d = DIFF[difficulty] || DIFF.moderate;
  const tx = { x: 2 + Math.random() * (d.w - 4), y: 2 + Math.random() * (d.h - 4) };
  // start on a random edge, well away from the burial
  const edge = Math.floor(Math.random() * 4);
  const start = edge === 0 ? { x: Math.random() * d.w, y: 0.5 }
    : edge === 1 ? { x: d.w - 0.5, y: Math.random() * d.h }
    : edge === 2 ? { x: Math.random() * d.w, y: d.h - 0.5 }
    : { x: 0.5, y: Math.random() * d.h };
  return { tx, theta: Math.random() * Math.PI * 2, start: { x: Math.round(start.x), y: Math.round(start.y) }, w: d.w, h: d.h, strikeTol: d.strikeTol, noise: d.noise };
}

// Beacon reading at (sx,sy): distance + inbound flux-line tangent (dipole field).
function beacon(sx, sy, s) {
  const rx = sx - s.tx.x, ry = sy - s.tx.y;
  const rmag = Math.hypot(rx, ry) || 1e-4;
  const rhx = rx / rmag, rhy = ry / rmag;
  const mx = Math.cos(s.theta), my = Math.sin(s.theta);
  const md = mx * rhx + my * rhy;
  let bx = 3 * md * rhx - mx, by = 3 * md * rhy - my;
  if (bx * rhx + by * rhy > 0) { bx = -bx; by = -by; } // point inbound toward Tx
  const bmag = Math.hypot(bx, by) || 1;
  const dist = Math.max(0, rmag + (s.noise ? (Math.random() - 0.5) * s.noise : 0));
  return { dist, ax: bx / bmag, ay: by / bmag };
}

const DIRS = [
  { k: "nw", dx: -1, dy: -1 }, { k: "n", dx: 0, dy: -1 }, { k: "ne", dx: 1, dy: -1 },
  { k: "w", dx: -1, dy: 0 }, { k: "probe", dx: 0, dy: 0 }, { k: "e", dx: 1, dy: 0 },
  { k: "sw", dx: -1, dy: 1 }, { k: "s", dx: 0, dy: 1 }, { k: "se", dx: 1, dy: 1 },
];
const ARROW = { n: "↑", ne: "↗", e: "→", se: "↘", s: "↓", sw: "↙", w: "←", nw: "↖" };

function buildInsights(answers) {
  const out = [];
  const misses = answers.filter((a) => a.result === "miss");
  const strikes = answers.filter((a) => a.result === "strike");
  if (!misses.length && strikes.length === answers.length) { out.push({ tone: "good", titleKey: "beacon.ins.clean.title", bodyKey: "beacon.ins.clean.body", vars: {} }); return out; }
  const avgMoves = answers.reduce((s, a) => s + a.moves, 0) / (answers.length || 1);
  const wander = answers.filter((a) => a.moves > a.optimal * 2.2);
  if (wander.length >= 2) out.push({ tone: "info", titleKey: "beacon.ins.wander.title", bodyKey: "beacon.ins.wander.body", vars: { n: wander.length } });
  if (misses.length >= 1) out.push({ tone: "warn", titleKey: "beacon.ins.pinpoint.title", bodyKey: "beacon.ins.pinpoint.body", vars: { n: misses.length } });
  return out.slice(0, 2);
}
const TONE = { good: C.good, warn: C.warn, info: C.ice };

const DEFAULTS = { difficulty: "moderate", count: 5, record: true };

const Seg = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</div>
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((o) => {
        const on = value === o.value;
        return <button key={String(o.value)} onClick={() => onChange(o.value)}
          style={{ flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: on ? 700 : 500,
            background: on ? C.ice : C.slate2, color: on ? C.slate : C.textDim, border: `1px solid ${on ? C.ice : C.line}` }}>{o.label}</button>;
      })}
    </div>
  </div>
);

const Eyebrow = ({ children }) => <div style={{ fontSize: 12, letterSpacing: "1.4px", textTransform: "uppercase", color: C.textDim }}>{children}</div>;

export function BeaconApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup"); // setup | search | results
  const [settings, setSettings] = useState(DEFAULTS);
  const [count, setCount] = useState(5);
  const [idx, setIdx] = useState(0);
  const [srch, setSrch] = useState(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [path, setPath] = useState([]);
  const [moves, setMoves] = useState(0);
  const [probed, setProbed] = useState(null); // {result, dist}
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("beacon", { attempts: [] }); if (alive) setHistory(d && d.attempts ? d : { attempts: [] }); })(); return () => { alive = false; }; }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const newSearch = (n, arr) => {
    const s = makeSearch(settings.difficulty);
    setSrch(s); setPos({ ...s.start }); setPath([{ ...s.start }]); setMoves(0); setProbed(null);
    setIdx(n); setAnswers(arr);
  };
  const begin = () => { setCount(settings.count); newSearch(0, []); setPhase("search"); };

  const step = (dx, dy) => {
    if (probed) return;
    setPos((p) => {
      const nx = Math.max(0, Math.min(srch.w - 1, p.x + dx));
      const ny = Math.max(0, Math.min(srch.h - 1, p.y + dy));
      if (nx === p.x && ny === p.y) return p;
      const np = { x: nx, y: ny };
      setPath((pa) => [...pa, np]);
      setMoves((m) => m + 1);
      return np;
    });
  };

  const probe = () => {
    if (probed) return;
    const d = Math.hypot(pos.x - srch.tx.x, pos.y - srch.tx.y);
    const result = d <= srch.strikeTol ? "strike" : d <= 1.6 ? "close" : "miss";
    const optimal = Math.round(Math.hypot(srch.start.x - srch.tx.x, srch.start.y - srch.tx.y));
    setProbed({ result, dist: d });
    const rec = { result, correct: result === "strike", finalDist: +d.toFixed(2), moves, optimal, difficulty: settings.difficulty, ts: Date.now() };
    setAnswers((prev) => [...prev, rec]);
    if (settings.record && history) setHistory((prev) => { const h = prev || { attempts: [] }; const up = { ...h, attempts: [...(h.attempts || []), rec] }; saveDoc("beacon", up); return up; });
  };

  const next = async () => {
    if (idx + 1 < count) { newSearch(idx + 1, answers); return; }
    setPhase("results");
  };

  const wrap = { minHeight: "calc(100vh - 44px)", background: C.slate, color: C.snow, fontFamily: FONT, padding: "22px 16px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 540, margin: "0 auto" };
  const panel = { background: C.slate2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 16 };
  const primaryBtn = { width: "100%", padding: "15px", borderRadius: 14, border: "none", cursor: "pointer", background: C.ice, color: C.slate, fontSize: 16, fontWeight: 800, marginTop: 8 };
  const ghostBtn = { width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "transparent", color: C.textDim, cursor: "pointer", fontSize: 13, fontWeight: 600, marginTop: 8 };

  // ---------- SETUP ----------
  if (phase === "setup") {
    return (
      <div style={wrap}><div style={inner}>
        {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: C.ice, cursor: "pointer", fontSize: 13, padding: "2px 0 10px", fontWeight: 700 }}>← {t("nav.allTools")}</button>}
        <Eyebrow>{t("beacon.setup.eyebrow")}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("beacon.setup.title")}</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("beacon.setup.intro")}</p>
        <div style={panel}>
          <Seg label={t("beacon.seg.difficulty")} value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: t("beacon.diff.easy"), value: "easy" }, { label: t("beacon.diff.moderate"), value: "moderate" }, { label: t("beacon.diff.hard"), value: "hard" }]} />
          <Seg label={t("beacon.seg.setLength")} value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "3", value: 3 }, { label: "5", value: 5 }, { label: "8", value: 8 }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("beacon.record.label")}</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(124,196,255,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? t("beacon.record.on") : t("beacon.record.off")}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>{settings.record ? t("beacon.record.onSub") : t("beacon.record.offSub")}</div>
        </div>
        <button style={primaryBtn} onClick={begin}>{t("beacon.start", { count: settings.count })}</button>
        <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>{t("beacon.setup.footer")}</p>
      </div></div>
    );
  }

  // ---------- SEARCH ----------
  if (phase === "search" && srch) {
    const read = beacon(pos.x, pos.y, srch);
    const distShown = probed ? probed.dist : read.dist;
    // 8-dir arrow label from flux tangent
    const ang = Math.atan2(read.ay, read.ax); // screen coords (y down)
    const oct = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8;
    const arrowKey = ["e", "se", "s", "sw", "w", "nw", "n", "ne"][oct];
    const phaseKey = probed ? null : distShown > 3 ? "beacon.phase.search" : distShown > 1 ? "beacon.phase.fine" : "beacon.phase.pinpoint";
    // grid geometry
    const GW = 300, cell = GW / srch.w, GH = cell * srch.h;
    const cx = (x) => (x + 0.5) * cell, cy = (y) => (y + 0.5) * cell;
    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Eyebrow>{settings.record ? t("beacon.setup.eyebrow") : t("beacon.guest")}</Eyebrow>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim }}>{idx + 1} / {count}</span>
        </div>

        {/* Beacon screen */}
        <div style={{ background: C.screen, border: `1px solid ${C.line}`, borderRadius: 14, padding: "12px 16px", marginBottom: 12,
          display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "inset 0 0 24px rgba(0,0,0,0.5)" }}>
          <div style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800, color: C.screenText, letterSpacing: "1px" }}>
            {distShown.toFixed(1)}<span style={{ fontSize: 18, marginLeft: 4 }}>m</span>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 34, color: probed ? C.textMute : C.screenText, lineHeight: 1 }}>{probed ? "•" : ARROW[arrowKey]}</div>
            {phaseKey && <div style={{ fontSize: 9.5, color: C.screenText, opacity: 0.8, letterSpacing: "0.5px", marginTop: 2 }}>{t(phaseKey)}</div>}
          </div>
        </div>

        {/* Debris grid */}
        <div style={{ ...panel, padding: 10 }}>
          <svg viewBox={`0 0 ${GW} ${GH}`} width="100%" style={{ display: "block" }} role="img" aria-label="Top-down beacon search grid.">
            <rect x="0" y="0" width={GW} height={GH} fill="#101a24" />
            {Array.from({ length: srch.w + 1 }).map((_, i) => <line key={"v" + i} x1={i * cell} y1="0" x2={i * cell} y2={GH} stroke="rgba(255,255,255,0.05)" />)}
            {Array.from({ length: srch.h + 1 }).map((_, i) => <line key={"h" + i} x1="0" y1={i * cell} x2={GW} y2={i * cell} stroke="rgba(255,255,255,0.05)" />)}
            {/* breadcrumb path */}
            {path.length > 1 && <polyline points={path.map((p) => `${cx(p.x)},${cy(p.y)}`).join(" ")} fill="none" stroke="rgba(124,196,255,0.35)" strokeWidth="2" />}
            {/* reveal on probe */}
            {probed && (
              <g>
                <line x1={cx(pos.x)} y1={cy(pos.y)} x2={cx(srch.tx.x)} y2={cy(srch.tx.y)} stroke={probed.result === "strike" ? C.good : C.bad} strokeWidth="1.5" strokeDasharray="3 3" />
                <circle cx={cx(srch.tx.x)} cy={cy(srch.tx.y)} r={Math.max(6, cell * 0.32)} fill="none" stroke={C.warn} strokeWidth="2.5" />
                <circle cx={cx(srch.tx.x)} cy={cy(srch.tx.y)} r="3" fill={C.warn} />
              </g>
            )}
            {/* searcher + arrow */}
            <g>
              <circle cx={cx(pos.x)} cy={cy(pos.y)} r={Math.max(6, cell * 0.34)} fill={C.ice} stroke="#0c1218" strokeWidth="1.5" />
              {!probed && <line x1={cx(pos.x)} y1={cy(pos.y)} x2={cx(pos.x) + read.ax * cell * 0.9} y2={cy(pos.y) + read.ay * cell * 0.9} stroke="#0c1218" strokeWidth="2.5" />}
            </g>
          </svg>
        </div>

        {probed ? (
          <div style={{ ...panel, marginBottom: 0, border: `1px solid ${probed.result === "strike" ? C.good : probed.result === "close" ? C.warn : C.bad}` }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: probed.result === "strike" ? C.good : probed.result === "close" ? C.warn : C.bad }}>
              {t("beacon.reveal." + probed.result)}
            </div>
            <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 4 }}>{t("beacon.reveal.dist", { d: probed.dist.toFixed(1), moves })}</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 260, margin: "0 auto" }}>
            {DIRS.map((d) => {
              if (d.k === "probe") return (
                <button key="probe" onClick={probe}
                  style={{ padding: "14px 0", borderRadius: 12, border: "none", background: C.warn, color: "#0c1218", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>{t("beacon.probe")}</button>
              );
              return (
                <button key={d.k} onClick={() => step(d.dx, d.dy)}
                  style={{ padding: "14px 0", borderRadius: 12, border: `1px solid ${C.line}`, background: C.slate2, color: C.snow, fontSize: 20, cursor: "pointer" }}>{ARROW[d.k]}</button>
              );
            })}
          </div>
        )}

        {probed && <button style={primaryBtn} onClick={next}>{idx + 1 < count ? t("beacon.next.next") : t("beacon.next.results")}</button>}
      </div></div>
    );
  }

  // ---------- RESULTS ----------
  const strikes = answers.filter((a) => a.result === "strike").length;
  const rate = answers.length ? Math.round((100 * strikes) / answers.length) : 0;
  const avgDist = answers.length ? (answers.reduce((s, a) => s + a.finalDist, 0) / answers.length) : 0;
  const verdictKey = rate >= 90 ? "beacon.verdict.sharp" : rate >= 70 ? "beacon.verdict.solid" : rate >= 40 ? "beacon.verdict.getting" : "beacon.verdict.reps";
  const insights = buildInsights(answers);
  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>{t("beacon.results.eyebrow")}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, lineHeight: 1, color: rate >= 80 ? C.good : rate >= 40 ? C.warn : C.bad }}>{rate}%</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t(verdictKey)}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{t("beacon.results.strikeRate", { strikes, total: answers.length })}</div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 8 }}>{t("beacon.results.avgDist", { d: avgDist.toFixed(1) })}</div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("beacon.results.guestNote")}</div>}
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, marginBottom: 0, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: TONE[ins.tone], marginBottom: 3 }}>{t(ins.titleKey)}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(ins.bodyKey, ins.vars)}</p>
          </div>
        ))}
      </div>
      <button style={primaryBtn} onClick={() => setPhase("setup")}>{t("beacon.results.newSet")}</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>{t("nav.allTools")}</button>}
    </div></div>
  );
}

// ---- Performance normalizer ------------------------------------------
export function normalizeBeacon(doc) {
  const attempts = (doc && doc.attempts) || [];
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return attempts.map((a) => ({
    ts: a.ts || 0, correct: a.result === "strike",
    dims: { Result: cap(a.result || "miss"), Difficulty: cap(a.difficulty || "moderate") },
  }));
}
