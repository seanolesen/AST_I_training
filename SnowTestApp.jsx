import React, { useState, useEffect } from "react";
import { loadDoc, saveDoc } from "./storage";
import { TrendGuide } from "./Trend.jsx";
import { useLang } from "./i18n.jsx";

/*
 * Snowpack-test interpreter (#13). A rule-based drill: the app shows a stability
 * test result (Extended Column Test or Compression Test) and the user chooses the
 * correct interpretation. Ground truth is derived from the result, so every item
 * is unambiguous. Records per-attempt to the "snowtest" doc; feeds Performance.
 */

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";
const TONE = { good: C.good, warn: C.warn, bad: C.bad };

const CHARS = ["SP", "SC", "RP", "PC", "BRK"];
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Build one interpretation item with a rule-derived correct answer.
function makeItem(difficulty) {
  const kinds = difficulty === "easy"
    ? ["ectP", "ectN", "ectX", "ctLoad"]
    : ["ectP", "ectN", "ectX", "ctLoad", "ctChar"];
  const kind = pick(kinds);

  // ---- Extended Column Test ----
  if (kind === "ectP" || kind === "ectN" || kind === "ectX") {
    const outcome = kind === "ectP" ? "P" : kind === "ectN" ? "N" : "X";
    const lo = difficulty === "hard" ? 1 : 3;
    const hi = difficulty === "hard" ? 30 : 28;
    const tap = ri(lo, hi);
    const depth = ri(20, 90);
    const display = outcome === "X" ? "ECTX" : "ECT" + outcome + tap;
    const answer = outcome === "P" ? "prop" : outcome === "N" ? "noprop" : "nofx";
    return {
      test: "ect", angle: "ect", display, depth,
      prompt: "snowtest.q.ect",
      options: [
        { key: "prop", label: "snowtest.opt.ect.prop" },
        { key: "noprop", label: "snowtest.opt.ect.noprop" },
        { key: "nofx", label: "snowtest.opt.ect.nofx" },
      ],
      answer,
      explain: outcome === "P" ? "snowtest.exp.ect.prop" : outcome === "N" ? "snowtest.exp.ect.noprop" : "snowtest.exp.ect.nofx",
      vars: { tap, depth },
    };
  }

  // ---- Compression Test: loading step ----
  if (kind === "ctLoad") {
    const bucket = pick(difficulty === "easy"
      ? ["easy", "moderate", "hard"]
      : ["veryeasy", "easy", "moderate", "hard", "none"]);
    let score;
    if (bucket === "veryeasy") score = "CTV";
    else if (bucket === "easy") score = "CT" + ri(1, 10);
    else if (bucket === "moderate") score = "CT" + ri(11, 20);
    else if (bucket === "hard") score = "CT" + ri(21, 30);
    else score = "CTN";
    const char = pick(CHARS);
    const display = (score === "CTV" || score === "CTN") ? score : score + " " + char;
    return {
      test: "ct", angle: "load", display,
      prompt: "snowtest.q.ct.load",
      options: [
        { key: "veryeasy", label: "snowtest.opt.ct.veryeasy" },
        { key: "easy", label: "snowtest.opt.ct.easy" },
        { key: "moderate", label: "snowtest.opt.ct.moderate" },
        { key: "hard", label: "snowtest.opt.ct.hard" },
        { key: "none", label: "snowtest.opt.ct.none" },
      ],
      answer: bucket, explain: "snowtest.exp.ct.load", vars: {},
    };
  }

  // ---- Compression Test: fracture character ----
  const char = pick(CHARS);
  const score = "CT" + ri(1, 30);
  const answer = (char === "SP" || char === "SC") ? "sudden" : (char === "RP" || char === "PC") ? "resistant" : "nonplanar";
  return {
    test: "ct", angle: "char", display: score + " " + char,
    prompt: "snowtest.q.ct.char",
    options: [
      { key: "sudden", label: "snowtest.opt.ct.sudden" },
      { key: "resistant", label: "snowtest.opt.ct.resistant" },
      { key: "nonplanar", label: "snowtest.opt.ct.nonplanar" },
    ],
    answer, explain: "snowtest.exp.ct.char", vars: {},
  };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildInsights(answers) {
  const out = [];
  const byTest = {};
  for (const a of answers) { (byTest[a.test] = byTest[a.test] || { c: 0, n: 0 }); byTest[a.test].n++; if (a.correct) byTest[a.test].c++; }
  for (const [test, v] of Object.entries(byTest)) {
    if (v.n < 2) continue;
    const pct = Math.round((100 * v.c) / v.n);
    out.push({ tone: pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad",
      titleKey: test === "ect" ? "snowtest.insight.ect" : "snowtest.insight.ct",
      bodyKey: "snowtest.insight.body", vars: { pct, n: v.n } });
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

export function SnowTestApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup"); // setup | play | results
  const [settings, setSettings] = useState(DEFAULTS);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [pick_, setPick] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("snowtest", { attempts: [] }); if (alive) setHistory(d && d.attempts ? d : { attempts: [] }); })(); return () => { alive = false; }; }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const begin = () => {
    const qs = [];
    for (let i = 0; i < settings.count; i++) { const it = makeItem(settings.difficulty); it.options = shuffle(it.options); qs.push(it); }
    setQueue(qs); setIdx(0); setPick(null); setAnswers([]); setPhase("play");
  };

  const answer = (key) => {
    if (pick_ !== null) return;
    const q = queue[idx];
    const correct = key === q.answer;
    setPick(key);
    const rec = { test: q.test, angle: q.angle, correct, difficulty: settings.difficulty, ts: Date.now() };
    setAnswers((prev) => [...prev, rec]);
    if (settings.record && history) setHistory((prev) => { const h = prev || { attempts: [] }; const up = { ...h, attempts: [...(h.attempts || []), rec] }; saveDoc("snowtest", up); return up; });
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
        <Eyebrow>{t("snowtest.setup.eyebrow")}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("snowtest.setup.title")}</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("snowtest.setup.intro")}</p>
        <TrendGuide attempts={history && history.attempts} C={C} t={t} MONO={MONO}
          dl={{ easy: t("snowtest.diff.easy"), moderate: t("snowtest.diff.moderate"), hard: t("snowtest.diff.hard") }} />

        <div style={panel}>
          <Seg label={t("snowtest.seg.difficulty")} hint={t("snowtest.seg.difficultyHint")} value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: t("snowtest.diff.easy"), value: "easy" }, { label: t("snowtest.diff.moderate"), value: "moderate" }, { label: t("snowtest.diff.hard"), value: "hard" }]} />
          <Seg label={t("snowtest.seg.setLength")} value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "15", value: 15 }]} />
          <Seg label={t("snowtest.seg.feedback")} hint={settings.feedback === "full" ? t("snowtest.fbHint.full") : t("snowtest.fbHint.minimal")}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: t("snowtest.fb.full"), value: "full" }, { label: t("snowtest.fb.minimal"), value: "minimal" }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("snowtest.record.label")}</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(124,196,255,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? t("snowtest.record.on") : t("snowtest.record.off")}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>
            {settings.record ? t("snowtest.record.onSub") : t("snowtest.record.offSub")}
          </div>
        </div>

        <button style={primaryBtn} onClick={begin}>{t("snowtest.start", { count: settings.count })}</button>
        <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>{t("snowtest.setup.footer")}</p>
      </div></div>
    );
  }

  // ---------- PLAY ----------
  if (phase === "play" && queue[idx]) {
    const q = queue[idx];
    const revealed = pick_ !== null;
    const isCorrect = pick_ === q.answer;
    const correctLabel = (q.options.find((o) => o.key === q.answer) || {}).label;
    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Eyebrow>{settings.record ? t("snowtest.setup.eyebrow") : t("snowtest.guest")}</Eyebrow>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim }}>{idx + 1} / {queue.length}</span>
        </div>

        {/* result card */}
        <div style={{ ...panel, textAlign: "center", padding: "22px 16px" }}>
          <div style={{ fontSize: 11, letterSpacing: "1.2px", textTransform: "uppercase", color: C.textMute, marginBottom: 8 }}>
            {q.test === "ect" ? t("snowtest.test.ect") : t("snowtest.test.ct")}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 800, color: C.ice, letterSpacing: "0.5px" }}>{q.display}</div>
          {q.test === "ect" && <div style={{ fontSize: 12, color: C.textDim, marginTop: 6 }}>{t("snowtest.depth", { depth: q.depth })}</div>}
        </div>

        <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{t(q.prompt)}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options.map((o) => {
            let bd = C.line, bg = C.panel;
            if (revealed && o.key === q.answer) { bd = C.good; bg = "rgba(63,163,114,0.16)"; }
            else if (revealed && o.key === pick_) { bd = C.bad; bg = "rgba(214,72,59,0.14)"; }
            return (
              <button key={o.key} onClick={() => answer(o.key)} disabled={revealed}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, background: bg,
                  border: `1.5px solid ${bd}`, color: C.snow, cursor: revealed ? "default" : "pointer", fontSize: 14, lineHeight: 1.4 }}>
                {t(o.label)}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{ marginTop: 14, background: C.slate2, border: `1px solid ${isCorrect ? C.good : C.bad}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: isCorrect ? C.good : C.bad }}>{isCorrect ? t("snowtest.reveal.correct") : t("snowtest.reveal.miss")}</span>
              {!isCorrect && correctLabel && <span style={{ fontSize: 13, color: C.textDim }}>{t("snowtest.reveal.itWas")} <b style={{ color: C.snow }}>{t(correctLabel)}</b></span>}
            </div>
            {settings.feedback === "full" && (
              <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: "8px 0 0" }}>{t(q.explain, q.vars)}</p>
            )}
            <div style={{ fontSize: 11, color: C.textMute, marginTop: 8, lineHeight: 1.45 }}>
              <span style={{ color: C.textDim, fontWeight: 700 }}>{t("snowtest.reveal.reference")}</span>{t("snowtest.ref")}
            </div>
          </div>
        )}

        {revealed && <button style={primaryBtn} onClick={next}>{idx + 1 < queue.length ? t("snowtest.next.next") : t("snowtest.next.results")}</button>}
      </div></div>
    );
  }

  // ---------- RESULTS ----------
  const correct = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((100 * correct) / answers.length) : 0;
  const verdictKey = pct >= 90 ? "snowtest.verdict.sharp" : pct >= 70 ? "snowtest.verdict.solid" : pct >= 50 ? "snowtest.verdict.getting" : "snowtest.verdict.reps";
  const insights = buildInsights(answers);
  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>{t("snowtest.results.eyebrow")}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, lineHeight: 1, color: pct >= 80 ? C.good : pct >= 50 ? C.warn : C.bad }}>{pct}%</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t(verdictKey)}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{t("snowtest.results.correctOf", { correct, total: answers.length })}</div>
        </div>
      </div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("snowtest.results.guestNote")}</div>}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, marginBottom: 0, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: TONE[ins.tone], marginBottom: 3 }}>{t(ins.titleKey)}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(ins.bodyKey, ins.vars)}</p>
          </div>
        ))}
      </div>

      <button style={primaryBtn} onClick={() => setPhase("setup")}>{t("snowtest.results.newSet")}</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>{t("nav.allTools")}</button>}
    </div></div>
  );
}

// ---- Normalizer for the Performance dashboard --------------------------
export function normalizeSnowtest(doc) {
  const attempts = (doc && doc.attempts) || [];
  return attempts.map((a) => ({
    ts: a.ts || 0, correct: !!a.correct,
    dims: {
      Test: a.test === "ect" ? "Extended Column (ECT)" : "Compression (CT)",
      Difficulty: a.difficulty ? a.difficulty[0].toUpperCase() + a.difficulty.slice(1) : "Moderate",
    },
  }));
}
