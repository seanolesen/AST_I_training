import React, { useState, useEffect, useMemo } from "react";
import { loadDoc, saveDoc } from "./storage";
import { useLang } from "./i18n.jsx";

/*
 * Scenario decision drill (#9). Runs short, multi-step backcountry scenarios —
 * conditions, then observations, then decisions — and scores the user's calls.
 * Each decision has one best-practice answer (option "a" in the data; display is
 * shuffled) with an explanation. Decisions are tagged by theme for analytics.
 * Authored content (judgment-based), so answers reflect avalanche best practice
 * rather than a procedural rule.
 */

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";
const TONE = { good: C.good, warn: C.warn, bad: C.bad };

// Scenario bank. Text lives in i18n under scen.<id>.*; here we hold structure:
// each step's theme (analytics) and which option key is the best answer ("a").
const SCENARIOS = [
  { id: "storm", steps: [{ theme: "terrainChoice" }, { theme: "observations" }] },
  { id: "beacon", steps: [{ theme: "rescueReadiness" }, { theme: "rescueReadiness" }] },
  { id: "familiar", steps: [{ theme: "humanFactors" }, { theme: "terrainChoice" }] },
  { id: "spring", steps: [{ theme: "timing" }, { theme: "observations" }] },
  { id: "whumpf", steps: [{ theme: "redFlags" }, { theme: "terrainChoice" }] },
  { id: "rescue", steps: [{ theme: "rescue" }, { theme: "rescue" }] },
];
const OPT_KEYS = ["a", "b", "c"]; // "a" is always the best answer
const THEME_EN = { terrainChoice: "Terrain choice", observations: "Observations", rescueReadiness: "Rescue readiness", humanFactors: "Human factors", timing: "Timing", redFlags: "Red flags", rescue: "Rescue" };

function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function buildInsights(answers) {
  const by = {};
  for (const a of answers) { (by[a.theme] = by[a.theme] || { c: 0, n: 0 }); by[a.theme].n++; if (a.correct) by[a.theme].c++; }
  const out = [];
  for (const [theme, v] of Object.entries(by)) {
    if (v.n < 2) continue;
    const pct = Math.round((100 * v.c) / v.n);
    out.push({ tone: pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad", titleKey: "scen.theme." + theme, bodyKey: "scen.insight.body", vars: { pct, n: v.n } });
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

const DEFAULTS = { count: 6, feedback: "full", record: true };

export function ScenarioApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup");
  const [settings, setSettings] = useState(DEFAULTS);
  const [selected, setSelected] = useState([]);
  const [sIdx, setSIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [pick, setPick] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("scenario", { attempts: [] }); if (alive) setHistory(d && d.attempts ? d : { attempts: [] }); })(); return () => { alive = false; }; }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const totalDecisions = useMemo(() => selected.reduce((n, sc) => n + sc.steps.length, 0), [selected]);
  const decisionNumber = useMemo(() => { let n = 0; for (let i = 0; i < sIdx; i++) n += selected[i].steps.length; return n + stepIdx + 1; }, [selected, sIdx, stepIdx]);

  const begin = () => {
    const sel = shuffle(SCENARIOS).slice(0, settings.count);
    setSelected(sel); setSIdx(0); setStepIdx(0); setPick(null); setAnswers([]); setPhase("play");
  };

  // Stable shuffled option order for the current step.
  const optOrder = useMemo(() => shuffle(OPT_KEYS), [sIdx, stepIdx, phase]);

  const scenario = selected[sIdx];
  const step = scenario && scenario.steps[stepIdx];

  const answer = (optKey) => {
    if (pick !== null) return;
    const correct = optKey === "a";
    setPick(optKey);
    const rec = { scenario: scenario.id, theme: step.theme, correct, ts: Date.now() };
    setAnswers((prev) => [...prev, rec]);
    if (settings.record && history) setHistory((prev) => { const h = prev || { attempts: [] }; const up = { ...h, attempts: [...(h.attempts || []), rec] }; saveDoc("scenario", up); return up; });
  };

  const next = () => {
    if (stepIdx + 1 < scenario.steps.length) { setStepIdx(stepIdx + 1); setPick(null); return; }
    if (sIdx + 1 < selected.length) { setSIdx(sIdx + 1); setStepIdx(0); setPick(null); return; }
    setPhase("results");
  };

  const wrap = { minHeight: "calc(100vh - 44px)", background: C.slate, color: C.snow, fontFamily: FONT, padding: "22px 16px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 540, margin: "0 auto" };
  const panel = { background: C.slate2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 16 };
  const primaryBtn = { width: "100%", padding: "15px", borderRadius: 14, border: "none", cursor: "pointer", background: C.ice, color: C.slate, fontSize: 16, fontWeight: 800, marginTop: 8 };
  const ghostBtn = { width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "transparent", color: C.textDim, cursor: "pointer", fontSize: 13, fontWeight: 600, marginTop: 8 };

  // ---------- SETUP ----------
  if (phase === "setup") {
    const recentN = history && history.attempts ? history.attempts.length : 0;
    return (
      <div style={wrap}><div style={inner}>
        {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: C.ice, cursor: "pointer", fontSize: 13, padding: "2px 0 10px", fontWeight: 700 }}>← {t("nav.allTools")}</button>}
        <Eyebrow>{t("scen.setup.eyebrow")}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("scen.setup.title")}</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("scen.setup.intro")}</p>

        <div style={panel}>
          <Seg label={t("scen.seg.count")} value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "3", value: 3 }, { label: t("scen.count.all"), value: 6 }]} />
          <Seg label={t("scen.seg.feedback")} hint={settings.feedback === "full" ? t("scen.fbHint.full") : t("scen.fbHint.minimal")}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: t("scen.fb.full"), value: "full" }, { label: t("scen.fb.minimal"), value: "minimal" }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("scen.record.label")}</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(124,196,255,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? t("scen.record.on") : t("scen.record.off")}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>
            {settings.record ? t("scen.record.onSub") : t("scen.record.offSub")}
          </div>
        </div>

        {recentN > 0 && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("scen.recorded", { n: recentN })}</div>}
        <button style={primaryBtn} onClick={begin}>{t("scen.start")}</button>
        <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>{t("scen.setup.footer")}</p>
      </div></div>
    );
  }

  // ---------- PLAY ----------
  if (phase === "play" && step) {
    const revealed = pick !== null;
    const isCorrect = pick === "a";
    const base = "scen." + scenario.id;
    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Eyebrow>{settings.record ? t("scen.setup.eyebrow") : t("scen.guest")}</Eyebrow>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim }}>{decisionNumber} / {totalDecisions}</span>
        </div>

        {/* scenario context */}
        <div style={panel}>
          <div style={{ fontSize: 11, letterSpacing: "1px", textTransform: "uppercase", color: C.textMute, marginBottom: 6 }}>
            {t("scen.scenarioOf", { s: sIdx + 1, total: selected.length })} · {t("scen.theme." + step.theme)}
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>{t(base + ".title")}</div>
          <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: 0 }}>{t(base + ".setup")}</p>
        </div>

        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, lineHeight: 1.45 }}>{t(base + ".s" + (stepIdx + 1) + ".q")}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {optOrder.map((ok) => {
            let bd = C.line, bg = C.panel;
            if (revealed && ok === "a") { bd = C.good; bg = "rgba(63,163,114,0.16)"; }
            else if (revealed && ok === pick) { bd = C.bad; bg = "rgba(214,72,59,0.14)"; }
            return (
              <button key={ok} onClick={() => answer(ok)} disabled={revealed}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, background: bg,
                  border: `1.5px solid ${bd}`, color: C.snow, cursor: revealed ? "default" : "pointer", fontSize: 14, lineHeight: 1.45 }}>
                {t(base + ".s" + (stepIdx + 1) + "." + ok)}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{ marginTop: 14, background: C.slate2, border: `1px solid ${isCorrect ? C.good : C.bad}`, borderRadius: 14, padding: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: isCorrect ? C.good : C.bad, marginBottom: 6 }}>{isCorrect ? t("scen.reveal.good") : t("scen.reveal.rethink")}</div>
            {settings.feedback === "full" && (
              <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(base + ".s" + (stepIdx + 1) + ".exp")}</p>
            )}
          </div>
        )}

        {revealed && <button style={primaryBtn} onClick={next}>{decisionNumber < totalDecisions ? t("scen.next.next") : t("scen.next.results")}</button>}
      </div></div>
    );
  }

  // ---------- RESULTS ----------
  const correct = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((100 * correct) / answers.length) : 0;
  const verdictKey = pct >= 90 ? "scen.verdict.sharp" : pct >= 70 ? "scen.verdict.solid" : pct >= 50 ? "scen.verdict.getting" : "scen.verdict.reps";
  const insights = buildInsights(answers);
  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>{t("scen.results.eyebrow")}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, lineHeight: 1, color: pct >= 80 ? C.good : pct >= 50 ? C.warn : C.bad }}>{pct}%</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t(verdictKey)}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{t("scen.results.correctOf", { correct, total: answers.length })}</div>
        </div>
      </div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("scen.results.guestNote")}</div>}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, marginBottom: 0, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: TONE[ins.tone], marginBottom: 3 }}>{t(ins.titleKey)}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(ins.bodyKey, ins.vars)}</p>
          </div>
        ))}
      </div>

      <button style={primaryBtn} onClick={() => setPhase("setup")}>{t("scen.results.newSet")}</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>{t("nav.allTools")}</button>}
    </div></div>
  );
}

// ---- Normalizer for the Performance dashboard --------------------------
export function normalizeScenario(doc) {
  const attempts = (doc && doc.attempts) || [];
  return attempts.map((a) => ({
    ts: a.ts || 0, correct: !!a.correct,
    dims: { Theme: THEME_EN[a.theme] || "Decision" },
  }));
}
