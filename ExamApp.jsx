import React, { useState, useMemo, useCallback, useEffect } from "react";

const ExamCfg = React.createContext(null);
const useCfg = () => React.useContext(ExamCfg);
import { supabase } from "./supabaseClient";
import { loadRuns, saveRun, loadRecordPref, saveRecordPref } from "./storage";
import { ax, useAcronyms } from "./glossary.jsx";

/* ------------------------------------------------------------------ *
 * AST 1 Written-Exam Practice Trainer  (Avalanche Skills Training 1)
 *
 * Original study questions authored to cover the AST 1 curriculum's
 * learning outcomes — NOT official Avalanche Canada exam content.
 * AST 1 certification comes from course participation, not a written
 * test; the score benchmark here is a self-study target only.
 *
 * Companion to the Slope-Angle Trainer: same instrument shell,
 * same settings model (pinned record/guest switch, difficulty,
 * count in increments of 5, feedback detail, cross-session history).
 * ------------------------------------------------------------------ */

// ---- Palette (shared with the slope trainer) ------------------------
const C = {
  slate: "#0E1621", slate2: "#16232F", panel: "#1B2A38", panel2: "#213443",
  line: "#2C3E4E", snow: "#EAF0F4", ice: "#5FB8C9", threshold: "#F0812C",
  good: "#3FA372", bad: "#D6483B", warn: "#E0B93C",
  textDim: "#8AA0B0", textMute: "#5E7789",
};

const reduceMotion =
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Topics ---------------------------------------------------------
const DIFF_WEIGHTS = {
  easy:     { easy: 3.0, moderate: 1.0, hard: 0.3 },
  moderate: { easy: 1.0, moderate: 2.0, hard: 1.0 },
  hard:     { easy: 0.3, moderate: 1.0, hard: 3.0 },
};

// ---- Sampling -------------------------------------------------------
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function poolFor(topic, bank) {
  return topic === "all" ? bank : bank.filter((q) => q.topic === topic);
}

// ---- Adaptive selection: step difficulty with performance ------------
const LV = { easy: 0, moderate: 1, hard: 2 };
const LNAME = ["easy", "moderate", "hard"];
function prep(q) { return q && q.type === "match" ? { ...q, _rights: shuffle(q.pairs.map((p) => p.r)) } : q; }
function pickAdaptive(pool, level, used) {
  const avail = pool.filter((x) => !used.has(x.id));
  if (avail.length === 0) return null;
  for (const L of [level, level - 1, level + 1, level - 2, level + 2]) {
    const name = LNAME[L];
    if (!name) continue;
    const band = avail.filter((x) => x.diff === name);
    if (band.length) return prep(band[Math.floor(Math.random() * band.length)]);
  }
  return prep(avail[Math.floor(Math.random() * avail.length)]);
}

function weightedSample(pool, n, diff) {
  const w = DIFF_WEIGHTS[diff] || DIFF_WEIGHTS.moderate;
  const picked = [];
  const remaining = pool.map((q) => ({ q, wt: (w[q.diff] || 1) * (0.6 + Math.random() * 0.8) }));
  const count = Math.min(n, remaining.length);
  for (let k = 0; k < count; k++) {
    const total = remaining.reduce((s, e) => s + e.wt, 0);
    let r = Math.random() * total, idx = 0;
    for (let i = 0; i < remaining.length; i++) { if (r < remaining[i].wt) { idx = i; break; } r -= remaining[i].wt; }
    picked.push(remaining[idx].q);
    remaining.splice(idx, 1);
  }
  // Prepare per-question display state (shuffled match options)
  return picked.map((q) => {
    if (q.type === "match") {
      return { ...q, _rights: shuffle(q.pairs.map((p) => p.r)) };
    }
    return q;
  });
}

// ---- Persistence via ./storage (Supabase when signed in, else localStorage)
const HALF_LIFE = 8; // runs

function analyzeRuns(runs) {
  if (!runs || runs.length === 0) return null;
  const recent = runs.slice(-40);
  let wsum = 0, wtot = 0;
  for (let i = 0; i < recent.length; i++) {
    const age = recent.length - 1 - i; // 0 = latest
    const wt = Math.pow(0.5, age / HALF_LIFE);
    wsum += wt * (recent[i].correct / recent[i].total);
    wtot += wt;
  }
  const weighted = wtot > 0 ? wsum / wtot : null;
  // topic aggregate (unweighted) across recorded runs
  const topic = {};
  for (const run of runs) {
    if (!run.byTopic) continue;
    for (const [k, v] of Object.entries(run.byTopic)) {
      if (!topic[k]) topic[k] = { c: 0, n: 0 };
      topic[k].c += v.c; topic[k].n += v.n;
    }
  }
  const weak = Object.entries(topic)
    .filter(([, v]) => v.n >= 3)
    .map(([k, v]) => ({ topic: k, acc: v.c / v.n, n: v.n }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 3);
  return { weighted, runsCount: runs.length, weak };
}

// Curriculum reference for a question: per-question override, else per-topic, else default.
function sourceFor(q, cfg) {
  if (!q) return null;
  if (q.source) return q.source;
  if (cfg && cfg.sources && cfg.sources[q.topic]) return cfg.sources[q.topic];
  return (cfg && cfg.sourceDefault) || null;
}

// Build a "recommended next session" from run history: target the weakest topic.
function recommendFrom(runs, cfg) {
  const a = analyzeRuns(runs);
  if (!a || !a.weak || a.weak.length === 0) return null;
  const weak = a.weak.filter((w) => cfg.topics[w.topic]);
  if (weak.length === 0) return null;
  const w = weak[0];
  const difficulty = w.acc < 0.6 ? "moderate" : "hard";
  const mode = w.acc < 0.6 ? "study" : "test";
  return { topic: w.topic, acc: w.acc, n: w.n, difficulty, mode, count: 15, label: cfg.topics[w.topic] };
}

// ==================== UI PRIMITIVES ==================================
function Eyebrow({ children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: "2.5px", textTransform: "uppercase",
      color: C.ice, fontWeight: 700, marginBottom: 4 }}>{children}</div>
  );
}

function Segmented({ label, sub, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: C.snow, marginBottom: 2 }}>{label}</div>}
      {sub && <div style={{ fontSize: 11.5, color: C.textMute, marginBottom: 8, lineHeight: 1.4 }}>{sub}</div>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, background: C.slate2,
        border: `1px solid ${C.line}`, borderRadius: 12, padding: 5 }}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button key={o.value} onClick={() => onChange(o.value)}
              style={{ flex: "1 0 auto", padding: "9px 12px", borderRadius: 9, border: "none",
                cursor: "pointer", background: on ? C.ice : "transparent",
                color: on ? C.slate : C.textDim, fontWeight: on ? 700 : 500, fontSize: 13,
                transition: reduceMotion ? "none" : "all 120ms ease", whiteSpace: "nowrap" }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ==================== SETUP SCREEN ===================================
const DEFAULTS = { difficulty: "moderate", topic: "all", count: 25, feedback: "immediate", mode: "test", adaptive: false };

function RecordSwitch({ recording, onToggle }) {
  return (
    <button onClick={onToggle}
      style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", borderRadius: 14, cursor: "pointer", textAlign: "left",
        background: recording ? "rgba(63,163,114,0.12)" : "rgba(240,129,44,0.14)",
        border: `1.5px solid ${recording ? C.good : C.threshold}`,
        transition: reduceMotion ? "none" : "all 140ms ease", marginBottom: 22 }}>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: recording ? C.good : C.threshold }}>
          {recording ? "Recording this run" : "Guest run — not recorded"}
        </div>
        <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 2 }}>
          {recording ? "Results will count toward your history and trend." : "Let someone else practice without affecting your stats."}
        </div>
      </div>
      <div style={{ position: "relative", width: 46, height: 26, borderRadius: 20, flexShrink: 0,
        background: recording ? C.good : C.threshold, transition: reduceMotion ? "none" : "all 140ms ease" }}>
        <div style={{ position: "absolute", top: 3, left: recording ? 23 : 3, width: 20, height: 20,
          borderRadius: "50%", background: C.snow, transition: reduceMotion ? "none" : "all 140ms ease" }} />
      </div>
    </button>
  );
}

function Setup({ settings, setSettings, recording, setRecording, onStart, maxCount, onHome, recommendation, onUseRecommendation }) {
  const cfg = useCfg();
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const shell = { minHeight: "100%", background: C.slate, color: C.snow,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: "18px 14px 32px", boxSizing: "border-box" };
  const card = { maxWidth: 540, margin: "0 auto" };

  const countStops = [];
  for (let n = 5; n <= maxCount; n += 5) countStops.push(n);
  const atMax = settings.count >= maxCount;

  return (
    <div style={shell}>
      <div style={card}>
        {onHome && (
          <button onClick={onHome} style={{ background: "transparent", border: "none", color: C.textDim, cursor: "pointer", fontSize: 13, padding: "2px 0 10px", fontWeight: 600 }}>← All tools</button>
        )}
        <Eyebrow>{cfg.eyebrow}</Eyebrow>
        <h1 style={{ fontSize: 23, fontWeight: 700, margin: "6px 0 4px", letterSpacing: "-0.3px" }}>Set up your exam</h1>
        <p style={{ color: C.textDim, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 20px" }}>
          {cfg.intro}
        </p>

        <RecordSwitch recording={recording} onToggle={() => setRecording((r) => !r)} />

        {recommendation && (
          <button onClick={onUseRecommendation}
            style={{ width: "100%", textAlign: "left", cursor: "pointer", marginBottom: 18,
              padding: "13px 15px", borderRadius: 12, background: C.slate2,
              border: `1px solid ${C.ice}`, borderLeft: `4px solid ${C.ice}`, color: C.snow }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: C.ice, marginBottom: 4 }}>
              Recommended next session
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: C.snow }}>
              Focus on <b>{recommendation.label}</b> — your weakest area at {Math.round(recommendation.acc * 100)}% over {recommendation.n} seen.
            </div>
            <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 4 }}>
              Tap to load: {recommendation.label} · {recommendation.difficulty} · {recommendation.mode} · {recommendation.count} questions →
            </div>
          </button>
        )}

        <Segmented label="Session type"
          sub="Study shows the explanation after every question and drops the pass/fail framing. Test grades you against the study target."
          value={settings.mode} onChange={(v) => set("mode", v)}
          options={[{ value: "test", label: "Test" }, { value: "study", label: "Study" }]} />

        <Segmented label="Difficulty"
          sub="Scales both recall depth and scenario complexity — Easy leans on definitions, Hard on multi-factor judgment calls."
          value={settings.difficulty} onChange={(v) => set("difficulty", v)}
          options={[{ value: "easy", label: "Easy" }, { value: "moderate", label: "Moderate" }, { value: "hard", label: "Hard" }]} />

        <Segmented label="Question selection"
          sub="Adaptive starts at your chosen difficulty, then steps harder after a correct answer and easier after a miss — the set tracks your level as you go. Fixed keeps the difficulty mix constant."
          value={settings.adaptive ? "adaptive" : "fixed"} onChange={(v) => set("adaptive", v === "adaptive")}
          options={[{ value: "fixed", label: "Fixed" }, { value: "adaptive", label: "Adaptive" }]} />

        {/* Count slider */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 2 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.snow }}>Number of questions</div>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 18, fontWeight: 700, color: C.ice }}>
              {settings.count}{atMax ? " (all)" : ""}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginBottom: 10, lineHeight: 1.4 }}>
            In steps of 5, up to {maxCount} available under the current topic filter.
          </div>
          <input type="range" min={5} max={maxCount} step={5} value={Math.min(settings.count, maxCount)}
            onChange={(e) => set("count", parseInt(e.target.value, 10))}
            style={{ width: "100%", accentColor: C.ice }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.textMute, marginTop: 2 }}>
            <span>5</span><span>{maxCount}</span>
          </div>
        </div>

        {/* Topic focus */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.snow, marginBottom: 2 }}>Topic focus</div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginBottom: 8 }}>Drill one area, or keep the whole curriculum in play.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {[{ value: "all", label: "All topics" }, ...Object.entries(cfg.topics).map(([k, v]) => ({ value: k, label: v }))].map((o) => {
              const on = settings.topic === o.value;
              return (
                <button key={o.value} onClick={() => set("topic", o.value)}
                  style={{ padding: "8px 12px", borderRadius: 999, cursor: "pointer", fontSize: 12.5,
                    fontWeight: on ? 700 : 500, background: on ? C.ice : C.slate2,
                    color: on ? C.slate : C.textDim, border: `1px solid ${on ? C.ice : C.line}`,
                    transition: reduceMotion ? "none" : "all 120ms ease" }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {settings.mode !== "study" && (
          <Segmented label="Feedback"
            sub="Immediate grades each question as you answer it. At end hides results until the review screen — closer to a real sitting."
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ value: "immediate", label: "Immediate" }, { value: "end", label: "At end" }]} />
        )}

        <button onClick={onStart}
          style={{ width: "100%", padding: "16px", borderRadius: 14, border: "none", cursor: "pointer",
            background: C.ice, color: C.slate, fontSize: 16, fontWeight: 800, letterSpacing: "0.2px",
            marginTop: 6 }}>
          {settings.mode === "study" ? "Start study set →" : "Start exam →"}
        </button>

        <p style={{ color: C.textMute, fontSize: 11, lineHeight: 1.5, margin: "18px 0 0", textAlign: "center" }}>
          Original study questions covering the AST 1 learning outcomes — not official Avalanche Canada exam content.
          AST 1 certification comes from course participation, not a written test; the benchmark here is a self-study target only.
        </p>
      </div>
    </div>
  );
}

// ==================== QUIZ SCREEN ====================================
function ChoiceBtn({ children, onClick, disabled, state }) {
  let bg = C.panel, border = C.line, fg = C.snow;
  if (state === "right") { bg = "rgba(63,163,114,0.18)"; border = C.good; }
  else if (state === "wrong") { bg = "rgba(214,72,59,0.16)"; border = C.bad; }
  else if (state === "dim") { bg = C.slate2; fg = C.textMute; }
  else if (state === "picked") { border = C.ice; bg = C.panel2; }
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "block", width: "100%", textAlign: "left", padding: "14px 15px", borderRadius: 12,
        background: bg, border: `1.5px solid ${border}`, color: fg, cursor: disabled ? "default" : "pointer",
        fontSize: 14.5, lineHeight: 1.4, marginBottom: 9, transition: reduceMotion ? "none" : "all 120ms ease" }}>
      {children}
    </button>
  );
}

function Quiz({ questions, settings, recording, onFinish, pool, targetCount }) {
  const cfg = useCfg();
  const on = useAcronyms();
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});   // id -> user answer
  const [revealed, setRevealed] = useState({}); // id -> bool (immediate mode)
  const [conf, setConf] = useState({});           // id -> "low"|"med"|"high"
  const adaptive = !!(settings.adaptive && Array.isArray(pool));
  const usedRef = React.useRef(new Set());
  const levelRef = React.useRef(LV[settings.difficulty] ?? 1);
  const [served, setServed] = useState(() => {
    if (!adaptive) return null;
    const first = pickAdaptive(pool, levelRef.current, usedRef.current);
    if (first) usedRef.current.add(first.id);
    return first ? [first] : [];
  });
  const seq = adaptive ? (served || []) : questions;
  const total = adaptive ? targetCount : questions.length;
  const q = seq[idx];
  const study = settings.mode === "study";
  const immediate = study || settings.feedback === "immediate";
  const isRevealed = immediate && q && revealed[q.id];

  const shell = { minHeight: "100%", background: C.slate, color: C.snow,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: "16px 14px 28px", boxSizing: "border-box" };
  const card = { maxWidth: 540, margin: "0 auto" };

  const grade = useCallback((question, ans) => {
    if (ans == null) return false;
    if (question.type === "mc") return ans === question.answer;
    if (question.type === "tf") return ans === question.answer;
    if (question.type === "match") return question.pairs.every((p) => ans[p.l] === p.r);
    return false;
  }, []);

  if (!q) return null;

  const setAns = (val) => setAnswers((a) => ({ ...a, [q.id]: val }));
  const answered = answers[q.id] != null &&
    (q.type !== "match" || Object.keys(answers[q.id] || {}).length === q.pairs.length);

  const reveal = () => setRevealed((r) => ({ ...r, [q.id]: true }));

  const finalize = (list) => {
    const graded = list.map((question) => ({
      question, ans: answers[question.id] ?? null, correct: grade(question, answers[question.id]),
      conf: conf[question.id] ?? null,
    }));
    onFinish(graded);
  };
  const next = () => {
    if (adaptive) {
      const wasCorrect = grade(q, answers[q.id]);
      levelRef.current = Math.max(0, Math.min(2, levelRef.current + (wasCorrect ? 1 : -1)));
      if (served.length < total) {
        const nx = pickAdaptive(pool, levelRef.current, usedRef.current);
        if (nx) { usedRef.current.add(nx.id); setServed((s) => [...s, nx]); setIdx(idx + 1); return; }
      }
      finalize(served);
      return;
    }
    if (idx + 1 < questions.length) { setIdx(idx + 1); }
    else { finalize(questions); }
  };

  const progress = total ? idx / total : 0;
  const topicLabel = cfg.topics[q.topic];

  return (
    <div style={shell}>
      <div style={card}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Eyebrow>{topicLabel}</Eyebrow>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!recording && (
              <span style={{ fontSize: 10.5, fontWeight: 700, color: C.threshold, letterSpacing: "0.5px",
                border: `1px solid ${C.threshold}`, borderRadius: 6, padding: "2px 6px" }}>GUEST</span>
            )}
            <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: C.textDim }}>
              {idx + 1} / {total}
            </span>
          </div>
        </div>
        <div style={{ height: 4, background: C.slate2, borderRadius: 4, overflow: "hidden", marginBottom: 20 }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, background: C.ice,
            transition: reduceMotion ? "none" : "width 200ms ease" }} />
        </div>

        {/* difficulty dot + type tag */}
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <Tag>{q.type === "mc" ? "Multiple choice" : q.type === "tf" ? "True / False" : "Matching"}</Tag>
          <Tag>{q.diff}</Tag>
        </div>

        <div style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, marginBottom: 14 }}>{ax(q.q, on)}</div>

        {/* confidence (optional; feeds calibration later) */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: C.textMute }}>Confidence</span>
          {[["low", "Low"], ["med", "Med"], ["high", "High"]].map(([v, l]) => {
            const on = conf[q.id] === v;
            return (
              <button key={v} onClick={() => setConf((c) => ({ ...c, [q.id]: on ? null : v }))}
                style={{ fontSize: 12, fontWeight: 700, cursor: "pointer", borderRadius: 20, padding: "4px 11px",
                  border: `1px solid ${on ? C.ice : C.line}`, background: on ? "rgba(124,196,255,0.14)" : "transparent",
                  color: on ? C.ice : C.textDim }}>{l}</button>
            );
          })}
        </div>

        {/* body by type */}
        {q.type === "mc" && q.options.map((opt, i) => {
          let state = null;
          if (isRevealed) {
            if (i === q.answer) state = "right";
            else if (answers[q.id] === i) state = "wrong";
            else state = "dim";
          } else if (answers[q.id] === i) state = "picked";
          return (
            <ChoiceBtn key={i} state={state} disabled={isRevealed}
              onClick={() => { if (!isRevealed) { setAns(i); if (immediate) setRevealed((r) => ({ ...r, [q.id]: true })); } }}>
              <b style={{ color: C.textDim, marginRight: 8 }}>{String.fromCharCode(65 + i)}</b>{ax(opt, on)}
            </ChoiceBtn>
          );
        })}

        {q.type === "tf" && [{ v: true, l: "True" }, { v: false, l: "False" }].map((o) => {
          let state = null;
          if (isRevealed) {
            if (o.v === q.answer) state = "right";
            else if (answers[q.id] === o.v) state = "wrong";
            else state = "dim";
          } else if (answers[q.id] === o.v) state = "picked";
          return (
            <ChoiceBtn key={o.l} state={state} disabled={isRevealed}
              onClick={() => { if (!isRevealed) { setAns(o.v); if (immediate) setRevealed((r) => ({ ...r, [q.id]: true })); } }}>
              {o.l}
            </ChoiceBtn>
          );
        })}

        {q.type === "match" && (
          <MatchBody q={q} value={answers[q.id] || {}} revealed={isRevealed}
            onChange={(l, r) => setAns({ ...(answers[q.id] || {}), [l]: r })} />
        )}

        {/* explanation on reveal */}
        {isRevealed && (
          <div style={{ marginTop: 14, padding: "13px 15px", borderRadius: 12, background: C.slate2,
            border: `1px solid ${C.line}` }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
              color: grade(q, answers[q.id]) ? C.good : C.bad, marginBottom: 5 }}>
              {grade(q, answers[q.id]) ? "Correct" : "Not quite"}
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.5, color: C.snow }}>{ax(q.explain, on)}</div>
            {sourceFor(q, cfg) && (
              <div style={{ fontSize: 11, color: C.textMute, marginTop: 8, lineHeight: 1.45 }}>
                <span style={{ color: C.textDim, fontWeight: 700 }}>Reference · </span>{ax(sourceFor(q, cfg), on)}
              </div>
            )}
          </div>
        )}

        {/* controls */}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          {immediate && !isRevealed && q.type === "match" && (
            <button onClick={reveal} disabled={!answered}
              style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none",
                background: answered ? C.ice : C.slate2, color: answered ? C.slate : C.textMute,
                fontWeight: 700, fontSize: 15, cursor: answered ? "pointer" : "default" }}>
              Check answer
            </button>
          )}
          {(!immediate || isRevealed || (immediate && q.type !== "match" && answered)) && (
            <button onClick={next} disabled={!answered && !isRevealed}
              style={{ flex: 1, padding: "14px", borderRadius: 12, border: "none",
                background: (answered || isRevealed) ? C.ice : C.slate2,
                color: (answered || isRevealed) ? C.slate : C.textMute,
                fontWeight: 800, fontSize: 15, cursor: (answered || isRevealed) ? "pointer" : "default" }}>
              {(adaptive ? idx + 1 < total : idx + 1 < questions.length) ? "Next →" : "Finish exam"}
            </button>
          )}
          {!immediate && !answered && q.type === "match" && (
            <div style={{ flex: 1, textAlign: "center", alignSelf: "center", fontSize: 12, color: C.textMute }}>
              Match all rows to continue
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Tag({ children }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, color: C.textDim, background: C.slate2,
      border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 8px", textTransform: "capitalize" }}>
      {children}
    </span>
  );
}

function MatchBody({ q, value, revealed, onChange }) {
  const on = useAcronyms();
  return (
    <div>
      {q.pairs.map((p) => {
        const chosen = value[p.l];
        const correct = chosen === p.r;
        let border = C.line;
        if (revealed) border = correct ? C.good : C.bad;
        else if (chosen) border = C.ice;
        return (
          <div key={p.l} style={{ marginBottom: 10, padding: "11px 13px", borderRadius: 12,
            background: C.panel, border: `1.5px solid ${border}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.snow, marginBottom: 7 }}>{ax(p.l, on)}</div>
            <select value={chosen || ""} disabled={revealed}
              onChange={(e) => onChange(p.l, e.target.value)}
              style={{ width: "100%", padding: "9px 10px", borderRadius: 9, fontSize: 13,
                background: C.slate2, color: C.snow, border: `1px solid ${C.line}` }}>
              <option value="" disabled>Choose a match…</option>
              {q._rights.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {revealed && !correct && (
              <div style={{ fontSize: 12, color: C.good, marginTop: 6 }}>Correct: {ax(p.r, on)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== RESULTS SCREEN =================================

function Results({ graded, settings, recording, onRetry, onNew, onHome, onRecommended }) {
  const cfg = useCfg();
  const study = settings.mode === "study";
  const [history, setHistory] = useState(undefined); // undefined = loading
  const [openReview, setOpenReview] = useState(false);
  const correct = graded.filter((g) => g.correct).length;
  const total = graded.length;
  const pct = total ? correct / total : 0;

  // per-topic this run
  const byTopic = {};
  for (const g of graded) {
    const t = g.question.topic;
    if (!byTopic[t]) byTopic[t] = { c: 0, n: 0 };
    byTopic[t].n += 1; if (g.correct) byTopic[t].c += 1;
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      if (recording) {
        await saveRun({ ts: Date.now(), app: cfg.appKey, mode: settings.mode, difficulty: settings.difficulty, topic: settings.topic, adaptive: !!settings.adaptive,
          correct, total, byTopic,
          questions: graded.map((g) => ({ topic: g.question.topic, type: g.question.type, diff: g.question.diff, correct: !!g.correct, conf: g.conf ?? null })) });
      }
      const runs = await loadRuns(cfg.appKey);
      if (alive) setHistory(runs);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line
  }, []);

  const analysis = history && history.length ? analyzeRuns(history) : null;
  const recTopic = analysis && analysis.weak ? analysis.weak.filter((w) => cfg.topics[w.topic])[0] : null;
  const startWeakSpots = () => {
    if (!recTopic || !onRecommended) return;
    onRecommended({
      topic: recTopic.topic,
      difficulty: recTopic.acc < 0.6 ? "moderate" : "hard",
      mode: recTopic.acc < 0.6 ? "study" : "test",
      count: 15,
    });
  };

  const shell = { minHeight: "100%", background: C.slate, color: C.snow,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: "20px 14px 34px", boxSizing: "border-box" };
  const card = { maxWidth: 540, margin: "0 auto" };
  const hitTarget = pct >= cfg.benchmark;

  return (
    <div style={shell}>
      <div style={card}>
        <Eyebrow>Results</Eyebrow>
        {/* Score */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
          <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 52, fontWeight: 800,
            color: study ? C.ice : hitTarget ? C.good : C.threshold, lineHeight: 1 }}>{Math.round(pct * 100)}%</div>
          <div style={{ fontSize: 18, color: C.textDim, fontWeight: 600 }}>{correct} / {total}</div>
        </div>
        <div style={{ fontSize: 12.5, color: C.textMute, marginBottom: 4 }}>
          {settings.difficulty} difficulty · {settings.topic === "all" ? "all topics" : cfg.topics[settings.topic]}
          {!recording && " · guest run (not saved)"}
        </div>

        {/* Practice-target / study line */}
        {study ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 10,
            background: C.slate2, border: `1px solid ${C.line}`, marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: C.ice }}>Study session</span>
            <span style={{ fontSize: 11, color: C.textMute }}>· explanations shown per question; no pass/fail</span>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 13px", borderRadius: 10,
            background: C.slate2, border: `1px solid ${C.line}`, marginBottom: 20 }}>
            <span style={{ fontSize: 13, color: hitTarget ? C.good : C.textDim }}>
              {hitTarget ? "Above" : "Below"} the 80% self-study target
            </span>
            <span style={{ fontSize: 11, color: C.textMute }}>· a study benchmark, not an official AST pass mark</span>
          </div>
        )}

        {/* By-topic this run */}
        <div style={{ fontSize: 13, fontWeight: 700, color: C.snow, marginBottom: 10 }}>This run, by topic</div>
        <div style={{ marginBottom: 22 }}>
          {Object.entries(byTopic).sort((a, b) => (a[1].c / a[1].n) - (b[1].c / b[1].n)).map(([t, v]) => {
            const a = v.c / v.n;
            const col = a >= 0.8 ? C.good : a >= 0.5 ? C.warn : C.bad;
            return (
              <div key={t} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: C.textDim }}>{cfg.topics[t]}</span>
                  <span style={{ color: col, fontWeight: 600 }}>{v.c}/{v.n}</span>
                </div>
                <div style={{ height: 6, background: C.slate2, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${a * 100}%`, background: col }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Trend */}
        {history === undefined && (
          <div style={{ fontSize: 12.5, color: C.textMute, marginBottom: 20 }}>Loading your history…</div>
        )}
        {history !== undefined && analysis && analysis.runsCount > 0 && (
          <div style={{ padding: "14px 15px", borderRadius: 12, background: C.slate2, border: `1px solid ${C.line}`, marginBottom: 22 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: C.snow, marginBottom: 8 }}>
              Trend over {analysis.runsCount} recorded run{analysis.runsCount === 1 ? "" : "s"}
            </div>
            {analysis.weighted != null && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 26, fontWeight: 700, color: C.ice }}>
                  {Math.round(analysis.weighted * 100)}%
                </span>
                <span style={{ fontSize: 11.5, color: C.textMute }}>recency-weighted accuracy (recent runs count more)</span>
              </div>
            )}
            {analysis.weak && analysis.weak.length > 0 && (
              <div>
                <div style={{ fontSize: 11.5, color: C.textDim, marginBottom: 5 }}>Weakest topics so far:</div>
                {analysis.weak.map((w) => (
                  <div key={w.topic} style={{ fontSize: 12.5, color: C.snow, marginBottom: 2 }}>
                    · {cfg.topics[w.topic]} — {Math.round(w.acc * 100)}% <span style={{ color: C.textMute }}>({w.n} seen)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {history !== undefined && (!analysis || analysis.runsCount === 0) && recording && (
          <div style={{ fontSize: 12, color: C.textMute, marginBottom: 20 }}>
            This is your first recorded run — trends appear once you have a couple saved.
          </div>
        )}

        {/* Review toggle */}
        <button onClick={() => setOpenReview((o) => !o)}
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: `1px solid ${C.line}`,
            background: C.panel, color: C.snow, fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>
          {openReview ? "Hide" : "Review"} all {total} questions
        </button>
        {openReview && (
          <div style={{ marginBottom: 14 }}>
            {graded.map((g, i) => (
              <ReviewItem key={g.question.id} n={i + 1} g={g} />
            ))}
          </div>
        )}

        {/* Recommended next: drill weakest topic */}
        {recTopic && onRecommended && (
          <button onClick={startWeakSpots}
            style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
              background: C.threshold, color: C.slate, fontWeight: 800, fontSize: 15, marginBottom: 10 }}>
            Drill my weak spot: {cfg.topics[recTopic.topic]} ({Math.round(recTopic.acc * 100)}%) →
          </button>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onRetry}
            style={{ flex: 1, padding: "15px", borderRadius: 12, border: `1px solid ${C.ice}`,
              background: "transparent", color: C.ice, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            Retry these settings
          </button>
          <button onClick={onNew}
            style={{ flex: 1, padding: "15px", borderRadius: 12, border: "none",
              background: C.ice, color: C.slate, fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
            New setup
          </button>
        </div>
        {onHome && (
          <button onClick={onHome} style={{ width: "100%", marginTop: 10, padding: "13px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.14)", background: "transparent", color: C.textDim, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>← Back to all tools</button>
        )}
      </div>
    </div>
  );
}

function ReviewItem({ n, g }) {
  const cfg = useCfg();
  const on = useAcronyms();
  const q = g.question;
  const yourAns = () => {
    if (g.ans == null) return "— (skipped)";
    if (q.type === "mc") return q.options[g.ans];
    if (q.type === "tf") return g.ans ? "True" : "False";
    if (q.type === "match") return "see rows below";
    return "";
  };
  return (
    <div style={{ padding: "12px 14px", borderRadius: 12, background: C.slate2,
      border: `1px solid ${g.correct ? "rgba(63,163,114,0.4)" : "rgba(214,72,59,0.4)"}`, marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: g.correct ? C.good : C.bad }}>
          {n}. {g.correct ? "✓" : "✗"}
        </span>
        <Tag>{cfg.topics[q.topic]}</Tag>
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.snow, marginBottom: 6, lineHeight: 1.4 }}>{ax(q.q, on)}</div>
      {q.type !== "match" && (
        <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 2 }}>
          Your answer: <span style={{ color: g.correct ? C.good : C.bad }}>{ax(yourAns(), on)}</span>
        </div>
      )}
      {q.type === "mc" && !g.correct && (
        <div style={{ fontSize: 12.5, color: C.good, marginBottom: 4 }}>Correct: {ax(q.options[q.answer], on)}</div>
      )}
      {q.type === "tf" && !g.correct && (
        <div style={{ fontSize: 12.5, color: C.good, marginBottom: 4 }}>Correct: {q.answer ? "True" : "False"}</div>
      )}
      {q.type === "match" && (
        <div style={{ margin: "4px 0 6px" }}>
          {q.pairs.map((p) => {
            const chosen = g.ans ? g.ans[p.l] : null;
            const ok = chosen === p.r;
            return (
              <div key={p.l} style={{ fontSize: 12.5, marginBottom: 2 }}>
                <span style={{ color: C.snow, fontWeight: 600 }}>{p.l}</span>
                <span style={{ color: ok ? C.good : C.bad }}> → {chosen || "—"}</span>
                {!ok && <span style={{ color: C.good }}> (should be: {ax(p.r, on)})</span>}
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, marginTop: 4,
        paddingTop: 6, borderTop: `1px solid ${C.line}` }}>{ax(q.explain, on)}</div>
      {sourceFor(q, cfg) && (
        <div style={{ fontSize: 10.5, color: C.textMute, lineHeight: 1.45, marginTop: 5 }}>
          <span style={{ color: C.textDim, fontWeight: 700 }}>Reference · </span>{ax(sourceFor(q, cfg), on)}
        </div>
      )}
    </div>
  );
}

// ==================== ROOT ==========================================
export function ExamApp({ onHome, config }) {
  const [phase, setPhase] = useState("setup"); // setup | quiz | results
  const [settings, setSettings] = useState(DEFAULTS);
  const [recording, setRecording] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [graded, setGraded] = useState([]);
  const [hist, setHist] = useState([]);
  const [adaptiveSet, setAdaptiveSet] = useState(null); // { pool, targetCount } when adaptive

  // load persisted record/guest preference
  useEffect(() => {
    let alive = true;
    (async () => { const p = await loadRecordPref(); if (alive) setRecording(p); })();
    return () => { alive = false; };
  }, []);
  useEffect(() => { saveRecordPref(recording); }, [recording]);

  // History for the "recommended next session" surface; refreshes when we land on setup.
  useEffect(() => {
    let alive = true;
    (async () => { const r = await loadRuns(config.appKey); if (alive) setHist(r || []); })();
    return () => { alive = false; };
  }, [config.appKey, phase]);
  const recommendation = React.useMemo(() => recommendFrom(hist, config), [hist, config]);

  const pool = poolFor(settings.topic, config.bank);
  const maxCount = Math.max(5, Math.floor(pool.length / 5) * 5);

  // keep count within bounds when topic changes
  useEffect(() => {
    setSettings((s) => (s.count > maxCount ? { ...s, count: maxCount } : s));
    // eslint-disable-next-line
  }, [settings.topic]);

  const buildAndStart = useCallback((override) => {
    const eff = override ? { ...settings, ...override } : settings;
    if (override) setSettings(eff);
    if (eff.adaptive) {
      const full = shuffle(poolFor(eff.topic, config.bank));
      setAdaptiveSet({ pool: full, targetCount: Math.min(eff.count, full.length) });
      setQuestions([]);
    } else {
      const qs = weightedSample(poolFor(eff.topic, config.bank), eff.count, eff.difficulty);
      setAdaptiveSet(null);
      setQuestions(qs);
    }
    setPhase("quiz");
  }, [settings, config.bank]);
  const start = useCallback(() => buildAndStart(null), [buildAndStart]);
  const useRecommendation = useCallback(() => {
    if (!recommendation) return;
    setSettings((s) => ({ ...s, topic: recommendation.topic, difficulty: recommendation.difficulty,
      count: recommendation.count, mode: recommendation.mode }));
  }, [recommendation]);

  const finish = useCallback((g) => { setGraded(g); setPhase("results"); }, []);

  let screen;
  if (phase === "setup") {
    screen = <Setup settings={settings} setSettings={setSettings}
      recording={recording} setRecording={setRecording} onStart={start} maxCount={maxCount} onHome={onHome}
      recommendation={recommendation} onUseRecommendation={useRecommendation} />;
  } else if (phase === "quiz") {
    screen = <Quiz questions={questions} settings={settings} recording={recording} onFinish={finish}
      pool={adaptiveSet ? adaptiveSet.pool : null} targetCount={adaptiveSet ? adaptiveSet.targetCount : 0} />;
  } else {
    screen = <Results graded={graded} settings={settings} recording={recording}
      onRetry={start} onNew={() => setPhase("setup")} onHome={onHome} onRecommended={buildAndStart} />;
  }
  return <ExamCfg.Provider value={config}>{screen}</ExamCfg.Provider>;
}
