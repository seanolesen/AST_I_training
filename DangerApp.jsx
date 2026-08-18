import React, { useState, useEffect } from "react";
import { loadDoc, saveDoc } from "./storage";
import { useLang } from "./i18n.jsx";

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";

// North American public avalanche danger scale (rating, official color).
const RATINGS = [
  { n: 1, key: "low", color: "#53a551", text: "#0c1218" },
  { n: 2, key: "moderate", color: "#fff835", text: "#0c1218" },
  { n: 3, key: "considerable", color: "#ef8b2b", text: "#0c1218" },
  { n: 4, key: "high", color: "#ef2b2d", text: "#ffffff" },
  { n: 5, key: "extreme", color: "#231f20", text: "#ef2b2d" },
];
const RAT = (n) => RATINGS[n - 1];
const BANDS = ["alp", "tl", "btl"]; // Alpine, Treeline, Below treeline (high -> low)

// Procedurally build a plausible 3-band danger rose. Danger usually eases with
// descent, so bands trend non-increasing downward; harder sets allow inversions
// and tighter spreads.
function makeRose(difficulty) {
  const r = () => Math.random();
  let alp;
  if (difficulty === "easy") alp = 2 + Math.floor(r() * 4); // 2..5
  else alp = 1 + Math.floor(r() * 5); // 1..5
  let tl = alp - (r() < (difficulty === "easy" ? 0.7 : 0.5) ? Math.floor(r() * 2) : 0);
  let btl = tl - (r() < (difficulty === "easy" ? 0.7 : 0.5) ? Math.floor(r() * 2) : 0);
  // Hard: occasional wet/low-elevation inversion.
  if (difficulty === "hard" && r() < 0.22) btl = Math.min(5, tl + 1);
  const clamp = (x) => Math.max(1, Math.min(5, x));
  const rose = { alp: clamp(alp), tl: clamp(tl), btl: clamp(btl) };
  // Easy: guarantee the queried band differs from its neighbours for a cleaner read.
  const ask = BANDS[Math.floor(r() * 3)];
  return { rose, ask };
}

// ---- Elevation-band danger graphic (avalanche.ca-style pyramid) ------
function DangerRose({ rose, ask, revealed }) {
  const W = 240, H = 168;
  // Three stacked trapezoids: Alpine (narrow top) -> Below treeline (wide base).
  const seg = [
    { key: "alp", yTop: 8, yBot: 58, wTop: 34, wBot: 96 },
    { key: "tl", yTop: 58, yBot: 108, wTop: 96, wBot: 158 },
    { key: "btl", yTop: 108, yBot: 158, wTop: 158, wBot: 220 },
  ];
  const cx = W / 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 300, display: "block", margin: "0 auto" }}
      role="img" aria-label="Avalanche danger by elevation band">
      {seg.map((s) => {
        const rat = RAT(rose[s.key]);
        const highlight = s.key === ask;
        const pts = [
          [cx - s.wTop / 2, s.yTop], [cx + s.wTop / 2, s.yTop],
          [cx + s.wBot / 2, s.yBot], [cx - s.wBot / 2, s.yBot],
        ].map((p) => p.join(",")).join(" ");
        const show = revealed || !highlight; // hide the queried band's colour until reveal
        return (
          <g key={s.key}>
            <polygon points={pts}
              fill={show ? rat.color : "#1b2430"}
              stroke={highlight ? C.ice : "rgba(0,0,0,0.35)"}
              strokeWidth={highlight ? 2.5 : 1} />
            {show && (
              <text x={cx} y={(s.yTop + s.yBot) / 2 + 5} textAnchor="middle"
                fontFamily={MONO} fontWeight="800" fontSize="16" fill={rat.text}>{rose[s.key]}</text>
            )}
            {highlight && !revealed && (
              <text x={cx} y={(s.yTop + s.yBot) / 2 + 6} textAnchor="middle"
                fontFamily={MONO} fontWeight="800" fontSize="18" fill={C.ice}>?</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function buildInsights(answers) {
  const out = [];
  const misses = answers.filter((a) => !a.correct);
  if (!misses.length) { out.push({ tone: "good", titleKey: "danger.ins.clean.title", bodyKey: "danger.ins.clean.body", vars: {} }); return out; }
  const under = misses.filter((a) => a.guess < a.rating);
  const over = misses.filter((a) => a.guess > a.rating);
  if (under.length >= 2 && under.length >= over.length) out.push({ tone: "warn", titleKey: "danger.ins.under.title", bodyKey: "danger.ins.under.body", vars: { n: under.length } });
  else if (over.length >= 2) out.push({ tone: "info", titleKey: "danger.ins.over.title", bodyKey: "danger.ins.over.body", vars: { n: over.length } });
  const byBand = {};
  for (const a of misses) byBand[a.band] = (byBand[a.band] || 0) + 1;
  const worst = Object.entries(byBand).sort((x, y) => y[1] - x[1])[0];
  if (worst && worst[1] >= 2) out.push({ tone: "info", titleKey: "danger.ins.band.title", bodyKey: "danger.ins.band.body", vars: { band: worst[0], n: worst[1] } });
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
        return (
          <button key={String(o.value)} onClick={() => onChange(o.value)}
            style={{ flex: 1, padding: "9px", borderRadius: 10, cursor: "pointer", fontSize: 13,
              fontWeight: on ? 700 : 500, background: on ? C.ice : C.slate2,
              color: on ? C.slate : C.textDim, border: `1px solid ${on ? C.ice : C.line}` }}>{o.label}</button>
        );
      })}
    </div>
  </div>
);

const Eyebrow = ({ children }) => <div style={{ fontSize: 12, letterSpacing: "1.4px", textTransform: "uppercase", color: C.textDim }}>{children}</div>;

export function DangerApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup"); // setup | play | results
  const [settings, setSettings] = useState(DEFAULTS);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [history, setHistory] = useState(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("danger", { attempts: [] }); if (alive) setHistory(d && d.attempts ? d : { attempts: [] }); })(); return () => { alive = false; }; }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const bandName = (b) => t("danger.band." + b);

  const begin = () => {
    const qs = [];
    for (let i = 0; i < settings.count; i++) qs.push(makeRose(settings.difficulty));
    setQueue(qs); setIdx(0); setPick(null); setAnswers([]); setPhase("play");
  };

  const answer = (n) => {
    if (pick !== null) return;
    const q = queue[idx];
    const rating = q.rose[q.ask];
    setPick(n);
    const rec = { band: q.ask, rating, guess: n, correct: n === rating, difficulty: settings.difficulty, ts: Date.now() };
    setAnswers((prev) => [...prev, rec]);
    if (settings.record && history) setHistory((prev) => { const h = prev || { attempts: [] }; const up = { ...h, attempts: [...(h.attempts || []), rec] }; saveDoc("danger", up); return up; });
  };

  const next = async () => {
    if (idx + 1 < queue.length) { setIdx(idx + 1); setPick(null); return; }
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
        <Eyebrow>{t("danger.setup.eyebrow")}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("danger.setup.title")}</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("danger.setup.intro")}</p>

        <div style={panel}>
          <Seg label={t("danger.seg.difficulty")} value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: t("danger.diff.easy"), value: "easy" }, { label: t("danger.diff.moderate"), value: "moderate" }, { label: t("danger.diff.hard"), value: "hard" }]} />
          <Seg label={t("danger.seg.setLength")} value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "15", value: 15 }]} />
          <Seg label={t("danger.seg.feedback")} hint={settings.feedback === "full" ? t("danger.fbHint.full") : t("danger.fbHint.minimal")}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: t("danger.fb.full"), value: "full" }, { label: t("danger.fb.minimal"), value: "minimal" }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t("danger.record.label")}</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(124,196,255,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? t("danger.record.on") : t("danger.record.off")}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>
            {settings.record ? t("danger.record.onSub") : t("danger.record.offSub")}
          </div>
        </div>

        <button style={primaryBtn} onClick={begin}>{t("danger.start", { count: settings.count })}</button>
        <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 14 }}>{t("danger.setup.footer")}</p>
      </div></div>
    );
  }

  // ---------- PLAY ----------
  if (phase === "play" && queue[idx]) {
    const q = queue[idx];
    const rating = q.rose[q.ask];
    const revealed = pick !== null;
    const rat = RAT(rating);
    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Eyebrow>{settings.record ? t("danger.setup.eyebrow") : t("danger.guest")}</Eyebrow>
          <span style={{ fontFamily: MONO, fontSize: 13, color: C.textDim }}>{idx + 1} / {queue.length}</span>
        </div>

        <div style={{ ...panel, padding: "14px 12px" }}><DangerRose rose={q.rose} ask={q.ask} revealed={revealed} /></div>

        <div style={{ textAlign: "center", fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
          {t("danger.prompt", { band: bandName(q.ask) })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {RATINGS.map((r) => {
            let bd = C.line, bg = C.panel;
            if (revealed && r.n === rating) { bd = C.good; bg = "rgba(63,163,114,0.16)"; }
            else if (revealed && r.n === pick) { bd = C.bad; bg = "rgba(214,72,59,0.14)"; }
            return (
              <button key={r.n} onClick={() => answer(r.n)} disabled={revealed}
                style={{ display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "12px 14px",
                  borderRadius: 12, background: bg, border: `1.5px solid ${bd}`, color: C.snow, cursor: revealed ? "default" : "pointer" }}>
                <span style={{ width: 26, height: 26, borderRadius: 6, background: r.color, color: r.text, fontFamily: MONO, fontWeight: 800, fontSize: 15, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{r.n}</span>
                <span style={{ fontWeight: 700, fontSize: 14.5 }}>{t("danger.rating." + r.key)}</span>
              </button>
            );
          })}
        </div>

        {revealed && (
          <div style={{ marginTop: 14, background: C.slate2, border: `1px solid ${pick === rating ? C.good : C.bad}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: pick === rating ? C.good : C.bad }}>{pick === rating ? t("danger.reveal.correct") : t("danger.reveal.miss")}</span>
              <span style={{ fontSize: 13, color: C.textDim }}>{t("danger.reveal.itWas")} <b style={{ color: rat.color }}>{rating} · {t("danger.rating." + rat.key)}</b></span>
            </div>
            {settings.feedback === "full" && (
              <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: "8px 0 0" }}>{t("danger.advice." + rat.key)}</p>
            )}
          </div>
        )}

        {revealed && <button style={primaryBtn} onClick={next}>{idx + 1 < queue.length ? t("danger.next.next") : t("danger.next.results")}</button>}
      </div></div>
    );
  }

  // ---------- RESULTS ----------
  const correct = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((100 * correct) / answers.length) : 0;
  const verdictKey = pct >= 90 ? "danger.verdict.sharp" : pct >= 70 ? "danger.verdict.solid" : pct >= 50 ? "danger.verdict.getting" : "danger.verdict.reps";
  const insights = buildInsights(answers);
  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>{t("danger.results.eyebrow")}</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 48, fontWeight: 800, lineHeight: 1, color: pct >= 80 ? C.good : pct >= 50 ? C.warn : C.bad }}>{pct}%</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{t(verdictKey)}</div>
          <div style={{ fontSize: 13, color: C.textDim }}>{t("danger.results.correctOf", { correct, total: answers.length })}</div>
        </div>
      </div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>{t("danger.results.guestNote")}</div>}

      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, marginBottom: 0, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: TONE[ins.tone], marginBottom: 3 }}>{t(ins.titleKey)}</div>
            <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: 0 }}>{t(ins.bodyKey, ins.vars)}</p>
          </div>
        ))}
      </div>

      <button style={primaryBtn} onClick={() => setPhase("setup")}>{t("danger.results.newSet")}</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>{t("nav.allTools")}</button>}
    </div></div>
  );
}

// ---- Normalizer for the Performance dashboard --------------------------
export function normalizeDanger(doc) {
  const attempts = (doc && doc.attempts) || [];
  return attempts.map((a) => ({
    ts: a.ts || 0, correct: !!a.correct,
    dims: {
      Band: a.band === "alp" ? "Alpine" : a.band === "tl" ? "Treeline" : "Below treeline",
      Difficulty: a.difficulty ? a.difficulty[0].toUpperCase() + a.difficulty.slice(1) : "Moderate",
    },
  }));
}
