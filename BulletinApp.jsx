import React, { useState, useEffect } from "react";
import { loadDoc, saveDoc } from "./storage";
import { TrendGuide } from "./Trend.jsx";
import { useLang } from "./i18n.jsx";

/*
 * Bulletin Trainer (#11). Shows a procedurally generated mock avalanche bulletin
 * (danger by elevation band + the day's avalanche problems), then asks one
 * interpretation question whose answer is derived from the bulletin. Question
 * types: what a danger rating means for travel, which problems are listed, what a
 * problem type is, and how to manage it. Distinct from the Danger tool (which is
 * pure rating calls) by focusing on reading + interpreting a full bulletin.
 */

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";
const TONE = { good: C.good, warn: C.warn, bad: C.bad };

const RATINGS = [
  { n: 1, key: "low", color: "#53a551", text: "#0c1218" },
  { n: 2, key: "moderate", color: "#fff835", text: "#0c1218" },
  { n: 3, key: "considerable", color: "#ef8b2b", text: "#0c1218" },
  { n: 4, key: "high", color: "#ef2b2d", text: "#ffffff" },
  { n: 5, key: "extreme", color: "#231f20", text: "#ef2b2d" },
];
const RAT = (n) => RATINGS[Math.max(1, Math.min(5, n)) - 1];
const BANDS = ["alp", "tl", "btl"];
const PROBLEMS = ["storm", "wind", "persistent", "deepPersistent", "wetSlab", "looseWet", "looseDry", "cornice", "glide"];

const SKILL = { ratingMeaning: "ratings", primaryProblem: "problemId", problemDef: "problemTypes", problemManage: "management" };

const rnd = () => Math.random();
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
function shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function genRatings(diff) {
  let alp = diff === "easy" ? 2 + Math.floor(rnd() * 4) : 1 + Math.floor(rnd() * 5);
  let tl = Math.max(1, alp - (rnd() < 0.6 ? Math.floor(rnd() * 2) : 0));
  let btl = Math.max(1, tl - (rnd() < 0.6 ? Math.floor(rnd() * 2) : 0));
  if (diff === "hard" && rnd() < 0.18) btl = Math.min(5, tl + 1);
  return { alp, tl, btl };
}

function makeItem(diff) {
  const ratings = genRatings(diff);
  const nProb = diff === "easy" ? 1 : (rnd() < 0.5 ? 1 : 2);
  const problems = shuffle(PROBLEMS).slice(0, nProb);
  const qpool = diff === "easy"
    ? ["primaryProblem", "ratingMeaning"]
    : diff === "moderate"
      ? ["primaryProblem", "ratingMeaning", "problemDef", "problemManage"]
      : ["ratingMeaning", "problemDef", "problemManage", "problemManage", "primaryProblem"];
  const qtype = pick(qpool);
  const base = { qtype, skill: SKILL[qtype], ratings, problems };

  if (qtype === "ratingMeaning") {
    const band = pick(BANDS);
    const rk = RAT(ratings[band]).key;
    return { ...base, band,
      options: RATINGS.map((r) => ({ key: r.key, labelKey: "bulletin.advice." + r.key })),
      answer: rk };
  }
  if (qtype === "primaryProblem") {
    const answer = problems[0];
    const distract = shuffle(PROBLEMS.filter((p) => !problems.includes(p))).slice(0, 3);
    return { ...base,
      options: shuffle([answer, ...distract]).map((k) => ({ key: k, labelKey: "bulletin.problem." + k })),
      answer };
  }
  if (qtype === "problemDef") {
    const target = pick(problems);
    const distract = shuffle(PROBLEMS.filter((p) => p !== target)).slice(0, 3);
    return { ...base, target,
      options: shuffle([target, ...distract]).map((k) => ({ key: k, labelKey: "bulletin.def." + k })),
      answer: target };
  }
  // problemManage
  const target = pick(problems);
  const distract = shuffle(PROBLEMS.filter((p) => p !== target)).slice(0, 3);
  return { ...base, target,
    options: shuffle([target, ...distract]).map((k) => ({ key: k, labelKey: "bulletin.manage." + k })),
    answer: target };
}

function buildInsights(answers, t) {
  const by = {};
  for (const a of answers) { (by[a.skill] = by[a.skill] || { c: 0, n: 0 }); by[a.skill].n++; if (a.correct) by[a.skill].c++; }
  const out = [];
  for (const [skill, v] of Object.entries(by)) {
    if (v.n < 2) continue;
    const pct = Math.round((100 * v.c) / v.n);
    out.push({ tone: pct >= 80 ? "good" : pct >= 50 ? "warn" : "bad",
      titleKey: "bulletin.skill." + skill, bodyKey: "bulletin.insight.body", vars: { pct, n: v.n } });
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

// The mock bulletin shown as the stimulus.
function BulletinCard({ q, t }) {
  const panel = { background: C.slate2, border: `1px solid ${C.line}`, borderRadius: 16, marginBottom: 16, overflow: "hidden" };
  return (
    <div style={panel}>
      <div style={{ fontSize: 11, letterSpacing: "1.2px", textTransform: "uppercase", color: C.textMute, padding: "12px 16px 4px" }}>{t("bulletin.card.title")}</div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textDim, padding: "8px 16px 4px" }}>{t("bulletin.card.danger")}</div>
      {BANDS.map((b) => {
        const r = RAT(q.ratings[b]);
        return (
          <div key={b} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 16px" }}>
            <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{t("bulletin.band." + b)}</span>
            <span style={{ width: 24, height: 24, borderRadius: 6, background: r.color, color: r.text, fontFamily: MONO, fontWeight: 800, fontSize: 14, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{r.n}</span>
            <span style={{ width: 118, textAlign: "right", fontSize: 12.5, color: C.textDim }}>{t("bulletin.rating." + r.key)}</span>
          </div>
        );
      })}
      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.textDim, padding: "10px 16px 4px", borderTop: `1px solid ${C.line}`, marginTop: 6 }}>{t("bulletin.card.problems")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "2px 16px 14px" }}>
        {q.problems.map((p) => (
          <span key={p} style={{ fontSize: 12.5, fontWeight: 600, color: C.snow, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 10px" }}>{t("bulletin.problem." + p)}</span>
        ))}
      </div>
    </div>
  );
}

const DEFAULTS = { difficulty: "moderate", count: 10, feedback: "full", record: true };

export function BulletinApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup");
  const [settings, setSettings] = useState(DEFAULTS);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [pick_, setPick] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("bulletin", { attempts: [] }); if (alive) setHistory(d && d.attempts ? d : { attempts: [] }); })(); return () => { alive = false; }; }, []);

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
    const rec = { qtype: q.qtype, skill: q.skill, correct, difficulty: settings.difficulty, ts: Date.now() };
    setAnswers((prev) => [...prev, rec]);
    if (settings.record && history) setHistory((prev) => { const h = prev || { attempts: [] }; const up = { ...h, attempts: [...(h.attempts || []), rec] }; saveDoc("bulletin", up); return up; });
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
        <Eyebrow>{t("bulletin.setup.eyebrow")}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("bulletin.setup.title")}</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("bulletin.setup.intro")}</p>
        <TrendGuide attempts={history && history.attempts} C={C} t={t} MONO={MONO}
          dl={{ easy: t("bulletin.diff.easy"), moderate: t("bulletin.diff.moderate"), hard: t("bulletin.diff.hard") }} />

        <div style={panel}>
          <Seg label={t("bulletin.seg.difficulty")} hint={t("bulletin.seg.difficultyHint")} value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: t("bulletin.diff.easy"), value: "easy" }, { label: t("bulletin.diff.moderate"), value: "moderate" }, { label: t("bulletin.diff.hard"), value: "hard" }]} />
          <Seg label={t("bulletin.seg.setLength")} value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "15", value: 15 }]} />
          <Seg label={t("bulletin.seg.feedback")} hint={settings.feedback === "full" ? t("bulletin.fbHint.full") : t("bulletin.fbHint.minimal")}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: t("bulletin.fb.full"), value: "full" }, { label: t("bulletin.fb.minimal"), value: "minimal" }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("bulletin.record.label")}</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(124,196,255,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? t("bulletin.record.on") : t("bulletin.record.off")}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>
            {settings.record ? t("bulletin.record.onSub") : t("bulletin.record.offSub")}
          </div>
        </div>

        <button style={primaryBtn} onClick={begin}>{t("bulletin.start", { count: settings.count })}</button>
        <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>{t("bulletin.setup.footer")}</p>
      </div></div>
    );
  }

  // ---------- PLAY ----------
  if (phase === "play" && queue[idx]) {
    const q = queue[idx];
    const revealed = pick_ !== null;
    const isCorrect = pick_ === q.answer;

    let promptText;
    if (q.qtype === "ratingMeaning") promptText = t("bulletin.q.ratingMeaning", { band: t("bulletin.band." + q.band), rating: t("bulletin.rating." + RAT(q.ratings[q.band]).key) });
    else if (q.qtype === "primaryProblem") promptText = t("bulletin.q.primaryProblem");
    else if (q.qtype === "problemDef") promptText = t("bulletin.q.problemDef", { problem: t("bulletin.problem." + q.target) });
    else promptText = t("bulletin.q.problemManage", { problem: t("bulletin.problem." + q.target) });

    let explainText, answerLabel;
    if (q.qtype === "ratingMeaning") { explainText = t("bulletin.advice." + q.answer); answerLabel = t("bulletin.rating." + q.answer); }
    else if (q.qtype === "primaryProblem") { explainText = t("bulletin.exp.primaryProblem", { list: q.problems.map((p) => t("bulletin.problem." + p)).join(", ") }); answerLabel = t("bulletin.problem." + q.answer); }
    else if (q.qtype === "problemDef") { explainText = t("bulletin.def." + q.target); answerLabel = t("bulletin.problem." + q.answer); }
    else { explainText = t("bulletin.manage." + q.target); answerLabel = t("bulletin.problem." + q.answer); }

    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Eyebrow>{settings.record ? t("bulletin.setup.eyebrow") : t("bulletin.guest")}</Eyebrow>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim }}>{idx + 1} / {queue.length}</span>
        </div>

        <BulletinCard q={q} t={t} />

        <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 12, lineHeight: 1.4 }}>{promptText}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options.map((o) => {
            let bd = C.line, bg = C.panel;
            if (revealed && o.key === q.answer) { bd = C.good; bg = "rgba(63,163,114,0.16)"; }
            else if (revealed && o.key === pick_) { bd = C.bad; bg = "rgba(214,72,59,0.14)"; }
            return (
              <button key={o.key} onClick={() => answer(o.key)} disabled={revealed}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, background: bg,
                  border: `1.5px solid ${bd}`, color: C.snow, cursor: revealed ? "default" : "pointer", fontSize: 14, lineHeight: 1.4 }}>
                {t(o.labelKey)}
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{ marginTop: 14, background: C.slate2, border: `1px solid ${isCorrect ? C.good : C.bad}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: isCorrect ? C.good : C.bad }}>{isCorrect ? t("bulletin.reveal.correct") : t("bulletin.reveal.miss")}</span>
              {!isCorrect && <span style={{ fontSize: 13, color: C.textDim }}>{t("bulletin.reveal.itWas")} <b style={{ color: C.snow }}>{answerLabel}</b></span>}
            </div>
            {settings.feedback === "full" && (
              <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: "8px 0 0" }}>{explainText}</p>
            )}
            <div style={{ fontSize: 11, color: C.textMute, marginTop: 8, lineHeight: 1.45 }}>
              <span style={{ color: C.textDim, fontWeight: 700 }}>{t("bulletin.reveal.reference")}</span>{t("bulletin.ref")}
            </div>
          </div>
        )}

        {revealed && <button style={primaryBtn} onClick={next}>{idx + 1 < queue.length ? t("bulletin.next.next") : t("bulletin.next.results")}</button>}
      </div></div>
    );
  }

  // ---------- RESULTS ----------
  const correct = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((100 * correct) / answers.length) : 0;
  const verdictKey = pct >= 90 ? "bulletin.verdict.sharp" : pct >= 70 ? "bulletin.verdict.solid" : pct >= 50 ? "bulletin.verdict.getting" : "bulletin.verdict.reps";
  const insights = buildInsights(answers, t);
  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>{t("bulletin.results.eyebrow")}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, lineHeight: 1, color: pct >= 80 ? C.good : pct >= 50 ? C.warn : C.bad }}>{pct}%</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t(verdictKey)}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{t("bulletin.results.correctOf", { correct, total: answers.length })}</div>
        </div>
      </div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("bulletin.results.guestNote")}</div>}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, marginBottom: 0, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: TONE[ins.tone], marginBottom: 3 }}>{t(ins.titleKey)}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(ins.bodyKey, ins.vars)}</p>
          </div>
        ))}
      </div>

      <button style={primaryBtn} onClick={() => setPhase("setup")}>{t("bulletin.results.newSet")}</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>{t("nav.allTools")}</button>}
    </div></div>
  );
}

// ---- Normalizer for the Performance dashboard --------------------------
export function normalizeBulletin(doc) {
  const attempts = (doc && doc.attempts) || [];
  const SK = { ratings: "Danger scale", problemId: "Problem ID", problemTypes: "Problem types", management: "Management" };
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  return attempts.map((a) => ({
    ts: a.ts || 0, correct: !!a.correct,
    dims: { Skill: SK[a.skill] || "Bulletin", Difficulty: a.difficulty ? cap(a.difficulty) : "Moderate" },
  }));
}
