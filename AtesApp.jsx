import React, { useState, useEffect } from "react";
import { loadDoc, saveDoc } from "./storage";
import { TrendGuide } from "./Trend.jsx";
import { useLang } from "./i18n.jsx";

/*
 * ATES terrain classifier (#15). Shows a short terrain profile (a handful of
 * terrain factors) and the user classifies it Simple / Challenging / Complex on
 * the Avalanche Terrain Exposure Scale. Each profile's factors are drawn from a
 * single class, so ground truth is unambiguous; difficulty controls subtlety and
 * whether the (harder) Challenging middle class appears.
 */

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";
const TONE = { good: C.good, warn: C.warn, bad: C.bad };

// Official ATES class colours: Simple green, Challenging blue, Complex black.
const CLASSES = [
  { key: "simple", chip: "#53a551", chipText: "#0c1218" },
  { key: "challenging", chip: "#2f6fb0", chipText: "#ffffff" },
  { key: "complex", chip: "#0c1218", chipText: "#e8eef4" },
];
const FACTORS = ["angle", "forest", "traps", "paths", "overhead", "options"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function makeItem(difficulty) {
  const pool = difficulty === "easy" ? ["simple", "complex"] : ["simple", "challenging", "complex"];
  const target = pick(pool);
  const core = ["paths", "overhead", "options"];              // most diagnostic
  const extras = shuffle(["angle", "forest", "traps"]);
  const nExtra = difficulty === "easy" ? 1 : 2;
  const chosen = shuffle([...core, ...extras.slice(0, nExtra)]);
  const rows = chosen.map((f) => ({ factor: f, descKey: "ates.desc." + f + "." + target }));
  return { target, rows, answer: target, explain: "ates.exp." + target };
}

function buildInsights(answers) {
  const out = [];
  const byClass = {};
  for (const a of answers) { (byClass[a.cls] = byClass[a.cls] || { c: 0, n: 0 }); byClass[a.cls].n++; if (a.correct) byClass[a.cls].c++; }
  for (const cls of ["simple", "challenging", "complex"]) {
    const v = byClass[cls]; if (!v || v.n < 2) continue;
    const pct = Math.round((100 * v.c) / v.n);
    out.push({ tone: pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad",
      titleKey: "ates.insight." + cls, bodyKey: "ates.insight.body", vars: { pct, n: v.n } });
  }
  return out;
}

function Eyebrow({ children }) {
  return <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: C.textDim }}>{children}</div>;
}
const Seg = ({ label, hint, value, onChange, options }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 13, fontWeight: 600, color: C.snow, marginBottom: hint ? 2 : 8 }}>{label}</div>
    {hint && <div style={{ fontSize: 11.5, color: C.textMute, marginBottom: 8 }}>{hint}</div>}
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button key={String(o.value)} onClick={() => onChange(o.value)}
            style={{ padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: `1px solid ${on ? C.ice : C.line}`, background: on ? "rgba(124,196,255,0.14)" : "transparent",
              color: on ? C.ice : C.textDim }}>{o.label}</button>
        );
      })}
    </div>
  </div>
);

const DEFAULTS = { difficulty: "moderate", count: 10, feedback: "full", record: true };

export function AtesApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup"); // setup | play | results
  const [settings, setSettings] = useState(DEFAULTS);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [pick_, setPick] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("ates", { attempts: [] }); if (alive) setHistory(d && d.attempts ? d : { attempts: [] }); })(); return () => { alive = false; }; }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const begin = () => {
    const qs = [];
    for (let i = 0; i < settings.count; i++) qs.push(makeItem(settings.difficulty));
    setQueue(qs); setIdx(0); setPick(null); setAnswers([]); setPhase("play");
  };

  const answer = (key) => {
    if (pick_ !== null) return;
    const q = queue[idx];
    const correct = key === q.answer;
    setPick(key);
    const rec = { cls: q.target, correct, difficulty: settings.difficulty, ts: Date.now() };
    setAnswers((prev) => [...prev, rec]);
    if (settings.record && history) setHistory((prev) => { const h = prev || { attempts: [] }; const up = { ...h, attempts: [...(h.attempts || []), rec] }; saveDoc("ates", up); return up; });
  };

  const next = () => { if (idx + 1 < queue.length) { setIdx(idx + 1); setPick(null); } else { setPhase("results"); } };

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
        <Eyebrow>{t("ates.setup.eyebrow")}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("ates.setup.title")}</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("ates.setup.intro")}</p>
        <TrendGuide attempts={history && history.attempts} C={C} t={t} MONO={MONO}
          dl={{ easy: t("ates.diff.easy"), moderate: t("ates.diff.moderate"), hard: t("ates.diff.hard") }} />

        <div style={panel}>
          <Seg label={t("ates.seg.difficulty")} hint={t("ates.seg.difficultyHint")} value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: t("ates.diff.easy"), value: "easy" }, { label: t("ates.diff.moderate"), value: "moderate" }, { label: t("ates.diff.hard"), value: "hard" }]} />
          <Seg label={t("ates.seg.setLength")} value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "15", value: 15 }]} />
          <Seg label={t("ates.seg.feedback")} hint={settings.feedback === "full" ? t("ates.fbHint.full") : t("ates.fbHint.minimal")}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: t("ates.fb.full"), value: "full" }, { label: t("ates.fb.minimal"), value: "minimal" }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("ates.record.label")}</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(124,196,255,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? t("ates.record.on") : t("ates.record.off")}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>
            {settings.record ? t("ates.record.onSub") : t("ates.record.offSub")}
          </div>
        </div>

        <button style={primaryBtn} onClick={begin}>{t("ates.start", { count: settings.count })}</button>
        <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>{t("ates.setup.footer")}</p>
      </div></div>
    );
  }

  // ---------- PLAY ----------
  if (phase === "play" && queue[idx]) {
    const q = queue[idx];
    const revealed = pick_ !== null;
    const isCorrect = pick_ === q.answer;
    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Eyebrow>{settings.record ? t("ates.setup.eyebrow") : t("ates.guest")}</Eyebrow>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim }}>{idx + 1} / {queue.length}</span>
        </div>

        {/* terrain profile */}
        <div style={{ ...panel, padding: "6px 0" }}>
          <div style={{ fontSize: 11, letterSpacing: "1.2px", textTransform: "uppercase", color: C.textMute, padding: "10px 16px 6px" }}>{t("ates.profile.title")}</div>
          {q.rows.map((r, i) => (
            <div key={r.factor} style={{ display: "flex", gap: 12, padding: "9px 16px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <div style={{ flex: "0 0 118px", fontSize: 12.5, fontWeight: 700, color: C.textDim }}>{t("ates.factor." + r.factor)}</div>
              <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.4 }}>{t(r.descKey)}</div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t("ates.prompt")}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CLASSES.map((cl) => {
            let bd = C.line, bg = C.panel;
            if (revealed && cl.key === q.answer) { bd = C.good; bg = "rgba(63,163,114,0.16)"; }
            else if (revealed && cl.key === pick_) { bd = C.bad; bg = "rgba(214,72,59,0.14)"; }
            return (
              <button key={cl.key} onClick={() => answer(cl.key)} disabled={revealed}
                style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px",
                  borderRadius: 12, background: bg, border: `1.5px solid ${bd}`, color: C.snow, cursor: revealed ? "default" : "pointer" }}>
                <span style={{ width: 16, height: 16, borderRadius: 4, background: cl.chip, border: `1px solid ${C.line}`, flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{t("ates.class." + cl.key)}</span>
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{ marginTop: 14, background: C.slate2, border: `1px solid ${isCorrect ? C.good : C.bad}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: isCorrect ? C.good : C.bad }}>{isCorrect ? t("ates.reveal.correct") : t("ates.reveal.miss")}</span>
              {!isCorrect && <span style={{ fontSize: 13, color: C.textDim }}>{t("ates.reveal.itWas")} <b style={{ color: C.snow }}>{t("ates.class." + q.answer)}</b></span>}
            </div>
            {settings.feedback === "full" && (
              <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: "8px 0 0" }}>{t(q.explain)}</p>
            )}
            <div style={{ fontSize: 11, color: C.textMute, marginTop: 8, lineHeight: 1.45 }}>
              <span style={{ color: C.textDim, fontWeight: 700 }}>{t("ates.reveal.reference")}</span>{t("ates.ref")}
            </div>
          </div>
        )}

        {revealed && <button style={primaryBtn} onClick={next}>{idx + 1 < queue.length ? t("ates.next.next") : t("ates.next.results")}</button>}
      </div></div>
    );
  }

  // ---------- RESULTS ----------
  const correct = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((100 * correct) / answers.length) : 0;
  const verdictKey = pct >= 90 ? "ates.verdict.sharp" : pct >= 70 ? "ates.verdict.solid" : pct >= 50 ? "ates.verdict.getting" : "ates.verdict.reps";
  const insights = buildInsights(answers);
  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>{t("ates.results.eyebrow")}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, lineHeight: 1, color: pct >= 80 ? C.good : pct >= 50 ? C.warn : C.bad }}>{pct}%</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t(verdictKey)}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{t("ates.results.correctOf", { correct, total: answers.length })}</div>
        </div>
      </div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("ates.results.guestNote")}</div>}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, marginBottom: 0, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: TONE[ins.tone], marginBottom: 3 }}>{t(ins.titleKey)}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(ins.bodyKey, ins.vars)}</p>
          </div>
        ))}
      </div>

      <button style={primaryBtn} onClick={() => setPhase("setup")}>{t("ates.results.newSet")}</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>{t("nav.allTools")}</button>}
    </div></div>
  );
}

// ---- Normalizer for the Performance dashboard --------------------------
export function normalizeAtes(doc) {
  const attempts = (doc && doc.attempts) || [];
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return attempts.map((a) => ({
    ts: a.ts || 0, correct: !!a.correct,
    dims: {
      Class: cap(a.cls) || "Simple",
      Difficulty: a.difficulty ? cap(a.difficulty) : "Moderate",
    },
  }));
}
