import React, { useState, useEffect } from "react";
import { loadDoc, saveDoc } from "./storage";
import { TrendGuide } from "./Trend.jsx";
import { useLang } from "./i18n.jsx";

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";

// Terrain features: trap (amplifies consequence) or not. Order = rough top->bottom placement.
const FEATURES = {
  ridge:    { trap: false, zone: 0 },
  trees:    { trap: true,  zone: 1 },
  hollow:   { trap: true,  zone: 1 },
  gully:    { trap: true,  zone: 2 },
  cliff:    { trap: true,  zone: 2 },
  crevasse: { trap: true,  zone: 2 },
  bench:    { trap: true,  zone: 3 },
  apron:    { trap: false, zone: 3 },
  meadow:   { trap: false, zone: 3 },
  spread:   { trap: false, zone: 3 },
};
const TRAPS = Object.keys(FEATURES).filter((k) => FEATURES[k].trap);
const SAFE = Object.keys(FEATURES).filter((k) => !FEATURES[k].trap);
const shuffle = (a) => { const x = a.slice(); for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// One scene: n features, guaranteed >=1 trap and >=1 non-trap.
function makeScene(difficulty) {
  const n = difficulty === "hard" ? 4 : 3;
  const nTrap = 1 + Math.floor(Math.random() * (n - 1)); // 1..n-1 traps
  const chosen = shuffle([...shuffle(TRAPS).slice(0, nTrap), ...shuffle(SAFE).slice(0, n - nTrap)]);
  // assign scattered positions
  const spots = shuffle([{ x: 30, y: 34 }, { x: 62, y: 30 }, { x: 44, y: 58 }, { x: 74, y: 62 }, { x: 22, y: 66 }]).slice(0, n);
  return chosen.map((type, i) => ({ type, trap: FEATURES[type].trap, pos: spots[i] }));
}

// ---- Small feature glyphs (used in scene + option list) --------------
function Glyph({ type, s = 22, color = "#cfe0ee" }) {
  const st = { stroke: color, strokeWidth: 1.6, fill: "none", strokeLinejoin: "round", strokeLinecap: "round" };
  const P = (d, extra) => <path d={d} style={{ ...st, ...extra }} />;
  let body = null;
  if (type === "gully") body = P("M3 4 L11 19 L19 4");
  else if (type === "cliff") body = <g style={st}><path d="M3 6 H11 V13 H19 V19" /><path d="M13 15 l2 3 M16 15 l2 3" style={{ ...st, strokeWidth: 1 }} /></g>;
  else if (type === "bench") body = P("M3 8 L9 8 L9 15 L19 15");
  else if (type === "trees") body = <g style={st}><path d="M6 18 L6 8 M3 13 L6 6 L9 13 M14 18 L14 9 M11 14 L14 7 L17 14" /></g>;
  else if (type === "hollow") body = P("M3 5 C6 20 16 20 19 5", { fill: "rgba(255,255,255,0.05)" });
  else if (type === "crevasse") body = P("M6 4 L9 10 L6 12 L10 19");
  else if (type === "apron") body = <g style={st}><path d="M11 4 L4 19 M11 4 L18 19 M6 14 H16" strokeDasharray="2 2" /></g>;
  else if (type === "meadow") body = <g style={st}><path d="M3 15 H19 M6 15 v-3 M10 15 v-4 M14 15 v-3 M17 15 v-2" strokeWidth="1.1" /></g>;
  else if (type === "ridge") body = P("M3 16 C7 5 15 5 19 16");
  else if (type === "spread") body = <g style={st}><path d="M11 3 V19 M11 12 L4 19 M11 12 L18 19" /></g>;
  return <svg viewBox="0 0 22 22" width={s} height={s} style={{ flexShrink: 0 }}>{body}</svg>;
}

function Scene({ features, marks }) {
  // marks: null (unrevealed) or map index->{trap, correct}
  const W = 300, H = 190;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 340, display: "block", margin: "0 auto" }}
      role="img" aria-label="A slope scene with terrain features to classify.">
      <defs>
        <linearGradient id="tsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#16202c" /><stop offset="1" stopColor="#0f1720" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill="url(#tsky)" />
      {/* mountainside */}
      <polygon points={`0,${H} 0,120 90,40 150,74 300,150 300,${H}`} fill="#1b2836" stroke="rgba(255,255,255,0.08)" />
      <polygon points={`0,${H} 300,${H} 300,150 150,74 90,40 0,120`} fill="none" />
      <path d="M0 120 L90 40 L150 74 L300 150" stroke="rgba(255,255,255,0.16)" strokeWidth="1.5" fill="none" />
      <text x="12" y="112" fontFamily={MONO} fontSize="9" fill={C.textMute}>start zone</text>
      {features.map((f, i) => {
        const x = (f.pos.x / 100) * W, y = (f.pos.y / 100) * H;
        const m = marks ? marks[i] : null;
        const ring = m ? (m.correct ? C.good : C.bad) : "rgba(255,255,255,0.5)";
        const badge = m ? (m.trap ? "!" : "·") : String.fromCharCode(65 + i);
        const badgeCol = m ? (m.trap ? C.warn : C.textMute) : C.snow;
        return (
          <g key={i} transform={`translate(${x - 11},${y - 11})`}>
            <circle cx="11" cy="11" r="16" fill="rgba(15,23,32,0.82)" stroke={ring} strokeWidth={m ? 2 : 1.2} />
            <g transform="translate(0,0)"><Glyph type={f.type} s={22} color="#d7e6f4" /></g>
            <circle cx="24" cy="-2" r="8" fill={C.slate} stroke={ring} strokeWidth="1.4" />
            <text x="24" y="1.5" textAnchor="middle" fontFamily={MONO} fontWeight="800" fontSize="9" fill={badgeCol}>{badge}</text>
          </g>
        );
      })}
    </svg>
  );
}

function buildInsights(answers) {
  const out = [];
  const misses = answers.filter((a) => !a.correct);
  if (!misses.length) { out.push({ tone: "good", titleKey: "terrain.ins.clean.title", bodyKey: "terrain.ins.clean.body", vars: {} }); return out; }
  const missedTraps = misses.filter((a) => a.trap && !a.youSaid); // real trap, not flagged
  const falseAlarms = misses.filter((a) => !a.trap && a.youSaid);  // safe feature flagged
  if (missedTraps.length >= 1 && missedTraps.length >= falseAlarms.length)
    out.push({ tone: "warn", titleKey: "terrain.ins.missed.title", bodyKey: "terrain.ins.missed.body", vars: { n: missedTraps.length } });
  else if (falseAlarms.length >= 2)
    out.push({ tone: "info", titleKey: "terrain.ins.false.title", bodyKey: "terrain.ins.false.body", vars: { n: falseAlarms.length } });
  const byFeat = {};
  for (const a of misses) byFeat[a.feature] = (byFeat[a.feature] || 0) + 1;
  const worst = Object.entries(byFeat).sort((x, y) => y[1] - x[1])[0];
  if (worst && worst[1] >= 2) out.push({ tone: "info", titleKey: "terrain.ins.feat.title", bodyKey: "terrain.ins.feat.body", vars: { n: worst[1] } });
  return out.slice(0, 2);
}
const TONE = { good: C.good, warn: C.warn, info: C.ice };

const DEFAULTS = { difficulty: "moderate", count: 10, feedback: "full", record: true };

const Seg = ({ label, hint, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
      {hint && <span style={{ fontSize: 11.5, color: C.textMute }}>{hint}</span>}
    </div>
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

export function TerrainApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup");
  const [settings, setSettings] = useState(DEFAULTS);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState({}); // index -> true
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("terrain", { attempts: [] }); if (alive) setHistory(d && d.attempts ? d : { attempts: [] }); })(); return () => { alive = false; }; }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const scene = queue[idx];

  const begin = () => {
    const qs = []; for (let i = 0; i < settings.count; i++) qs.push(makeScene(settings.difficulty));
    setQueue(qs); setIdx(0); setSelected({}); setRevealed(false); setAnswers([]); setPhase("play");
  };
  const toggle = (i) => { if (revealed) return; setSelected((s) => ({ ...s, [i]: !s[i] })); };

  const check = () => {
    if (revealed) return;
    const results = scene.map((f, i) => {
      const youSaid = !!selected[i];
      return { feature: f.type, trap: f.trap, youSaid, correct: youSaid === f.trap, difficulty: settings.difficulty, ts: Date.now() };
    });
    setAnswers((prev) => [...prev, ...results]);
    if (settings.record && history) setHistory((prev) => { const h = prev || { attempts: [] }; const up = { ...h, attempts: [...(h.attempts || []), ...results] }; saveDoc("terrain", up); return up; });
    setRevealed(true);
  };

  const next = async () => {
    if (idx + 1 < queue.length) { setIdx(idx + 1); setSelected({}); setRevealed(false); return; }
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
        <Eyebrow>{t("terrain.setup.eyebrow")}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("terrain.setup.title")}</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("terrain.setup.intro")}</p>
        <TrendGuide attempts={history && history.attempts} C={C} t={t} MONO={MONO}
          dl={{ easy: t("terrain.diff.easy"), moderate: t("terrain.diff.moderate"), hard: t("terrain.diff.hard") }} />

        <div style={panel}>
          <Seg label={t("terrain.seg.difficulty")} value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: t("terrain.diff.easy"), value: "easy" }, { label: t("terrain.diff.moderate"), value: "moderate" }, { label: t("terrain.diff.hard"), value: "hard" }]} />
          <Seg label={t("terrain.seg.setLength")} value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "15", value: 15 }]} />
          <Seg label={t("terrain.seg.feedback")} hint={settings.feedback === "full" ? t("terrain.fbHint.full") : t("terrain.fbHint.minimal")}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: t("terrain.fb.full"), value: "full" }, { label: t("terrain.fb.minimal"), value: "minimal" }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("terrain.record.label")}</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(124,196,255,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? t("terrain.record.on") : t("terrain.record.off")}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>{settings.record ? t("terrain.record.onSub") : t("terrain.record.offSub")}</div>
        </div>
        <button style={primaryBtn} onClick={begin}>{t("terrain.start", { count: settings.count })}</button>
        <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>{t("terrain.setup.footer")}</p>
      </div></div>
    );
  }

  // ---------- PLAY ----------
  if (phase === "play" && scene) {
    const markByIdx = revealed ? scene.map((f, i) => ({ trap: f.trap, correct: (!!selected[i]) === f.trap })) : null;
    const anySel = Object.values(selected).some(Boolean);
    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Eyebrow>{settings.record ? t("terrain.setup.eyebrow") : t("terrain.guest")}</Eyebrow>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim }}>{idx + 1} / {queue.length}</span>
        </div>
        <div style={{ ...panel, padding: "12px 10px" }}><Scene features={scene} marks={markByIdx} /></div>
        <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t("terrain.prompt")}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {scene.map((f, i) => {
            const sel = !!selected[i];
            let bd = sel ? C.warn : C.line, bg = sel ? "rgba(240,129,44,0.12)" : C.panel;
            if (revealed) { const ok = sel === f.trap; bd = ok ? C.good : C.bad; bg = ok ? "rgba(63,163,114,0.12)" : "rgba(214,72,59,0.12)"; }
            return (
              <button key={i} onClick={() => toggle(i)} disabled={revealed}
                style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", padding: "11px 13px",
                  borderRadius: 12, background: bg, border: `1.5px solid ${bd}`, color: C.snow, cursor: revealed ? "default" : "pointer" }}>
                <span style={{ width: 20, fontFamily: MONO, fontWeight: 800, color: C.textDim }}>{String.fromCharCode(65 + i)}</span>
                <Glyph type={f.type} s={22} />
                <span style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{t("terrain.feat." + f.type + ".name")}</span>
                  {revealed && <span style={{ display: "block", fontSize: 11.5, color: C.textMute, marginTop: 2 }}>{f.trap ? t("terrain.trapYes") : t("terrain.trapNo")}</span>}
                </span>
                {revealed && <span style={{ fontSize: 15, fontWeight: 800, color: (sel === f.trap) ? C.good : C.bad }}>{(sel === f.trap) ? "✓" : "✗"}</span>}
                {!revealed && sel && <span style={{ fontSize: 11.5, fontWeight: 700, color: C.warn }}>{t("terrain.trapYes")}</span>}
              </button>
            );
          })}
        </div>

        {revealed && settings.feedback === "full" && (
          <div style={{ ...panel, marginTop: 14, marginBottom: 0 }}>
            {scene.filter((f) => f.trap).map((f, i) => (
              <div key={i} style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, marginBottom: 6 }}>
                <b style={{ color: C.snow }}>{t("terrain.feat." + f.type + ".name")}</b> — {t("terrain.feat." + f.type + ".why")}
              </div>
            ))}
          </div>
        )}

        {!revealed
          ? <button style={{ ...primaryBtn, background: anySel ? C.ice : C.slate2, color: anySel ? C.slate : C.textMute }} onClick={check}>{t("terrain.check")}</button>
          : <button style={primaryBtn} onClick={next}>{idx + 1 < queue.length ? t("terrain.next.next") : t("terrain.next.results")}</button>}
      </div></div>
    );
  }

  // ---------- RESULTS ----------
  const correct = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((100 * correct) / answers.length) : 0;
  const verdictKey = pct >= 90 ? "terrain.verdict.sharp" : pct >= 70 ? "terrain.verdict.solid" : pct >= 50 ? "terrain.verdict.getting" : "terrain.verdict.reps";
  const insights = buildInsights(answers);
  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>{t("terrain.results.eyebrow")}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, lineHeight: 1, color: pct >= 80 ? C.good : pct >= 50 ? C.warn : C.bad }}>{pct}%</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t(verdictKey)}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{t("terrain.results.correctOf", { correct, total: answers.length })}</div>
        </div>
      </div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("terrain.results.guestNote")}</div>}
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, marginBottom: 0, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: TONE[ins.tone], marginBottom: 3 }}>{t(ins.titleKey)}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(ins.bodyKey, ins.vars)}</p>
          </div>
        ))}
      </div>
      <button style={primaryBtn} onClick={() => setPhase("setup")}>{t("terrain.results.newSet")}</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>{t("nav.allTools")}</button>}
    </div></div>
  );
}

// ---- Performance normalizer ------------------------------------------
export function normalizeTerrain(doc) {
  const attempts = (doc && doc.attempts) || [];
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return attempts.map((a) => ({
    ts: a.ts || 0, correct: !!a.correct,
    dims: { Feature: cap(a.feature || "unknown"), Difficulty: cap(a.difficulty || "moderate") },
  }));
}
