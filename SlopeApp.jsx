import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { loadDoc, saveDoc } from "./storage";

/* ------------------------------------------------------------------ *
 * Avalanche Slope-Angle Trainer
 * Judge >30° vs <30° — the standard avalanche threshold.
 * Slopes are drawn at a known angle so grading is exact.
 * Setup screen controls difficulty, view, set length, and feedback.
 * ------------------------------------------------------------------ */

// ---- Avalanche slope-shading bands (real convention) ----------------
import { useLang } from "./i18n.jsx";

const BANDS = [
  { max: 27, color: "#3FA372", key: "low", name: "Low angle", note: "Slab avalanches uncommon" },
  { max: 30, color: "#E0B93C", key: "approaching", name: "Approaching", note: "Just under the threshold" },
  { max: 35, color: "#F0812C", key: "terrain", name: "Avalanche terrain", note: "30°+ — be on alert" },
  { max: 46, color: "#D6483B", key: "prime", name: "Prime avalanche terrain", note: "35–45° — most slides release here" },
  { max: 51, color: "#9E2B22", key: "steep", name: "Very steep", note: "Frequent sluffing" },
  { max: 91, color: "#7A4FB0", key: "extreme", name: "Extreme", note: "Snow often sheds continuously" },
];
const bandFor = (a) => BANDS.find((b) => a < b.max) || BANDS[BANDS.length - 1];

// ---- Palette --------------------------------------------------------
const C = {
  slate: "#0E1621", slate2: "#16232F", panel: "#1B2A38", line: "#2C3E4E",
  snow: "#EAF0F4", ice: "#5FB8C9", threshold: "#F0812C",
  textDim: "#8AA0B0", textMute: "#5E7789",
};

const reduceMotion =
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Angle generation by difficulty --------------------------------
const DIFF = {
  easy:     [[12, 24, 3], [25, 28, 1], [32, 35, 1], [36, 48, 3]],
  standard: [[15, 24, 2], [25, 29, 3], [31, 35, 3], [36, 46, 2]],
  hard:     [[22, 24, 1], [25, 29, 4], [31, 35, 4], [36, 39, 1]],
};
function randomAngle(diff) {
  const buckets = DIFF[diff] || DIFF.standard;
  const total = buckets.reduce((s, b) => s + b[2], 0);
  let r = Math.random() * total, pick = buckets[0];
  for (const b of buckets) { if (r < b[2]) { pick = b; break; } r -= b[2]; }
  const [lo, hi] = pick;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function makeQuestion(settings) {
  const angle = randomAngle(settings.difficulty);
  const view = settings.mode === "mix" ? (Math.random() < 0.5 ? "field" : "profile") : settings.mode;
  const q = { angle, view };
  if (view === "field") {
    const n = 4 + Math.floor(Math.random() * 4);
    q.trees = Array.from({ length: n }, () => ({
      s: 9 + Math.random() * 39, u: Math.random() * 44 - 22, h: 3 + Math.random() * 2.2,
    })).sort((a, b) => b.s - a.s);
  } else {
    q.facing = Math.random() < 0.5 ? 1 : -1;
    q.py = 168 + (Math.random() * 44 - 22);
    const nT = 2 + Math.floor(Math.random() * 3), used = [];
    q.trees = [];
    for (let i = 0; i < nT; i++) {
      let x, tr = 0;
      do { x = 120 + Math.random() * 240; tr++; }
      while (used.some((u) => Math.abs(u - x) < 46) && tr < 8);
      used.push(x);
      q.trees.push({ x, h: 15 + Math.random() * 9 });
    }
    q.rocks = Array.from({ length: Math.floor(Math.random() * 3) },
      () => ({ x: 90 + Math.random() * 300, r: 3 + Math.random() * 4 }));
  }
  return q;
}
const newSet = (settings) => Array.from({ length: settings.count }, () => makeQuestion(settings));

// ---- Profile scene (side view) -------------------------------------
const PX = 240;
function ProfileScene({ q, revealed, realistic }) {
  const { t: tr } = useLang();
  const rad = (q.angle * Math.PI) / 180, rad30 = (30 * Math.PI) / 180;
  const t = Math.tan(rad);
  const surfaceY = (x) => q.py - q.facing * t * (x - PX);
  const ref30Y = (x) => q.py - q.facing * Math.tan(rad30) * (x - PX);
  const y0 = surfaceY(0), yW = surfaceY(480);
  const mountain = `0,${y0} 480,${yW} 480,320 0,320`;
  const seed = Math.floor(q.angle * 3 + q.py) % 100;
  const extraRocks = realistic ? [0, 1, 2, 3, 4].map((k) => ({ x: 50 + ((Math.floor(q.angle) * 37 + k * 83) % 380), r: 2.5 + ((Math.floor(q.angle) + k) % 4) })) : [];

  const Tree = ({ x, h }) => {
    const by = surfaceY(x);
    if (by < 30 || by > 306) return null;
    const w = h * 0.5;
    return (
      <g>
        {realistic && <ellipse cx={x + w * 0.2} cy={by} rx={w * 0.6} ry={h * 0.08} fill="#26333f" opacity="0.22" />}
        <rect x={x - 0.9} y={by - h * 0.16} width="1.8" height={h * 0.16} fill="#5b4636" />
        {realistic && <polygon points={`${x},${by - h * 1.03} ${x - w * 0.62},${by - h * 0.42} ${x + w * 0.62},${by - h * 0.42}`} fill="#22432f" />}
        <polygon points={`${x},${by - h} ${x - w * 0.55},${by - h * 0.45} ${x + w * 0.55},${by - h * 0.45}`} fill="#2f5d3f" />
        <polygon points={`${x},${by - h * 0.7} ${x - w * 0.65},${by - h * 0.16} ${x + w * 0.65},${by - h * 0.16}`} fill="#356a47" />
        {realistic && <polygon points={`${x - w * 0.12},${by - h * 0.9} ${x - w * 0.4},${by - h * 0.5} ${x + w * 0.05},${by - h * 0.5}`} fill="#3f7a52" opacity="0.7" />}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 480 320" width="100%" style={{ display: "block", borderRadius: 12 }} role="img"
      aria-label={tr("slope.aria.profile")}>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          {realistic
            ? (<><stop offset="0" stopColor="#20384A" /><stop offset="0.5" stopColor="#5B7A8D" /><stop offset="1" stopColor="#B9CBD6" /></>)
            : (<><stop offset="0" stopColor="#2A4356" /><stop offset="0.55" stopColor="#4A6478" /><stop offset="1" stopColor="#8AA6B6" /></>)}
        </linearGradient>
        <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
          {realistic
            ? (<><stop offset="0" stopColor="#FBFDFE" /><stop offset="0.5" stopColor="#E4EDF3" /><stop offset="1" stopColor="#B7C8D6" /></>)
            : (<><stop offset="0" stopColor="#F4F8FB" /><stop offset="1" stopColor="#C4D4DF" /></>)}
        </linearGradient>
        <linearGradient id="atmo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E1621" stopOpacity="0.28" /><stop offset="0.25" stopColor="#0E1621" stopOpacity="0" />
        </linearGradient>
        {realistic && (
          <>
            <radialGradient id="psun" cx="0.8" cy="0.12" r="0.5">
              <stop offset="0" stopColor="#FFF6E2" stopOpacity="0.85" /><stop offset="1" stopColor="#FFF6E2" stopOpacity="0" />
            </radialGradient>
            <clipPath id="pclip"><polygon points={mountain} /></clipPath>
            <filter id="pgrain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.024" numOctaves="3" seed={seed} result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0" />
            </filter>
            <radialGradient id="pvig" cx="0.5" cy="0.5" r="0.75">
              <stop offset="0.6" stopColor="#0E1621" stopOpacity="0" /><stop offset="1" stopColor="#0E1621" stopOpacity="0.3" />
            </radialGradient>
          </>
        )}
      </defs>
      <rect x="0" y="0" width="480" height="320" fill="url(#sky)" />
      {realistic && <rect x="0" y="0" width="480" height="200" fill="url(#psun)" />}
      {realistic ? (
        <>
          <polygon points={`0,${Math.min(y0, yW) - 18} 150,${Math.min(y0, yW) - 66} 320,${Math.min(y0, yW) - 30} 480,${Math.min(y0, yW) - 58} 480,320 0,320`} fill="#8AA3B4" opacity="0.45" />
          <polygon points={`0,${Math.min(y0, yW) - 8} 220,${Math.min(y0, yW) - 44} 480,${Math.min(y0, yW) - 16} 480,320 0,320`} fill="#A6BCC9" opacity="0.4" />
        </>
      ) : (
        <polygon points={`0,${Math.min(y0, yW) - 26} 200,${Math.min(y0, yW) - 60} 480,${Math.min(y0, yW) - 20} 480,320 0,320`} fill="#6E8698" opacity="0.5" />
      )}
      <polygon points={mountain} fill="url(#snow)" />
      {realistic && <rect x="0" y="0" width="480" height="320" fill="#3a5064" filter="url(#pgrain)" clipPath="url(#pclip)" opacity="0.16" style={{ mixBlendMode: "multiply" }} />}
      <line x1="0" y1={y0} x2="480" y2={yW} stroke={realistic ? "#8FA7B6" : "#9DB4C2"} strokeWidth={realistic ? 1.4 : 2} strokeLinecap="round" />
      <polygon points={`0,${y0} 480,${yW} 480,${yW + 16} 0,${y0 + 16}`} fill="#B8CAD6" opacity={realistic ? 0.35 : 0.55} />
      {extraRocks.map((r, i) => {
        const ry = surfaceY(r.x);
        if (ry < 30 || ry > 308) return null;
        return <g key={"e" + i}><ellipse cx={r.x + 1} cy={ry - r.r * 0.2} rx={r.r * 1.1} ry={r.r * 0.5} fill="#26333f" opacity="0.2" /><ellipse cx={r.x} cy={ry - r.r * 0.45} rx={r.r} ry={r.r * 0.72} fill="#586773" /><ellipse cx={r.x - r.r * 0.3} cy={ry - r.r * 0.6} rx={r.r * 0.5} ry={r.r * 0.4} fill="#6f7e8a" /></g>;
      })}
      {q.rocks.map((r, i) => {
        const ry = surfaceY(r.x);
        if (ry < 30 || ry > 308) return null;
        return <ellipse key={i} cx={r.x} cy={ry - r.r * 0.4} rx={r.r} ry={r.r * 0.7} fill="#6b7883" />;
      })}
      {q.trees.map((tr, i) => <Tree key={i} {...tr} />)}
      <rect x="0" y="0" width="480" height="320" fill="url(#atmo)" pointerEvents="none" />
      {realistic && <rect x="0" y="0" width="480" height="320" fill="url(#pvig)" pointerEvents="none" />}
      {revealed && (
        <g>
          <line x1={PX - 120} y1={ref30Y(PX - 120)} x2={PX + 150} y2={ref30Y(PX + 150)}
            stroke={C.threshold} strokeWidth="2" strokeDasharray="7 5" opacity="0.95" />
          <g transform={`translate(${q.facing === 1 ? PX + 150 : PX - 120}, ${q.facing === 1 ? ref30Y(PX + 150) : ref30Y(PX - 120)})`}>
            <rect x="-16" y="-11" width="34" height="17" rx="4" fill={C.threshold} />
            <text x="1" y="1" fontSize="11" fontFamily="ui-monospace, Menlo, monospace" fontWeight="700" fill="#3A1E00" textAnchor="middle" dominantBaseline="middle">30°</text>
          </g>
        </g>
      )}
    </svg>
  );
}

// ---- Field scene (first-person, foreshortened) ---------------------
function FieldScene({ q, revealed, realistic }) {
  const { t: tr } = useLang();
  const th = (q.angle * Math.PI) / 180;
  const focal = 250, eye = 1.7, horizonY = 252, cx = 240;
  const cosT = Math.cos(th);
  const yOf = (s) => horizonY - focal * (s * Math.sin(th) - eye) / (s * cosT);
  const xOf = (s, u) => cx + (focal * u) / (s * cosT);
  const ridgeY = horizonY - focal * Math.tan(th);
  const y30 = horizonY - focal * Math.tan((30 * Math.PI) / 180);
  const seed = Math.floor(q.angle * 5) % 100;
  const snowPoly = `0,${ridgeY} 200,${ridgeY - 4} 480,${ridgeY} 480,320 0,320`;
  const contours = [6, 9, 13, 19, 28, 42, 66, 110].map((s) => yOf(s)).filter((y) => y > ridgeY + 3 && y < 322);

  const Tree = ({ s, u, h }) => {
    const by = yOf(s);
    if (by < ridgeY + 3 || by > 318) return null;
    let hpx = (focal * h) / (s * cosT);
    hpx = Math.min(hpx, 150);
    const bx = xOf(s, u);
    if (bx < -20 || bx > 500) return null;
    const w = hpx * 0.42;
    return (
      <g>
        {realistic && <ellipse cx={bx + w * 0.25} cy={by} rx={w * 0.6} ry={hpx * 0.05} fill="#243039" opacity="0.25" />}
        <rect x={bx - w * 0.09} y={by - hpx * 0.18} width={w * 0.18} height={hpx * 0.18} fill="#4d3a2c" />
        {realistic && <polygon points={`${bx},${by - hpx * 1.03} ${bx - w * 0.56},${by - hpx * 0.4} ${bx + w * 0.56},${by - hpx * 0.4}`} fill="#1f3e2c" />}
        <polygon points={`${bx},${by - hpx} ${bx - w * 0.5},${by - hpx * 0.42} ${bx + w * 0.5},${by - hpx * 0.42}`} fill="#2b543a" />
        <polygon points={`${bx},${by - hpx * 0.66} ${bx - w * 0.6},${by - hpx * 0.16} ${bx + w * 0.6},${by - hpx * 0.16}`} fill="#316245" />
        {realistic && <polygon points={`${bx - w * 0.1},${by - hpx * 0.88} ${bx - w * 0.36},${by - hpx * 0.48} ${bx + w * 0.04},${by - hpx * 0.48}`} fill="#3f7a52" opacity="0.7" />}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 480 320" width="100%" style={{ display: "block", borderRadius: 12 }} role="img"
      aria-label={tr("slope.aria.field")}>
      <defs>
        <linearGradient id="fsky" x1="0" y1="0" x2="0" y2="1">
          {realistic
            ? (<><stop offset="0" stopColor="#20384A" /><stop offset="1" stopColor="#A9C0CE" /></>)
            : (<><stop offset="0" stopColor="#2A4356" /><stop offset="1" stopColor="#7C99AB" /></>)}
        </linearGradient>
        <linearGradient id="fsnow" x1="0" y1="0" x2="0" y2="1">
          {realistic
            ? (<><stop offset="0" stopColor="#D2DFE8" /><stop offset="1" stopColor="#FBFDFE" /></>)
            : (<><stop offset="0" stopColor="#DCE7EE" /><stop offset="1" stopColor="#F6FAFC" /></>)}
        </linearGradient>
        <linearGradient id="fatmo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0E1621" stopOpacity="0.22" /><stop offset="0.3" stopColor="#0E1621" stopOpacity="0" />
        </linearGradient>
        {realistic && (
          <>
            <radialGradient id="fsun" cx="0.75" cy="0.15" r="0.5">
              <stop offset="0" stopColor="#FFF6E2" stopOpacity="0.8" /><stop offset="1" stopColor="#FFF6E2" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="fhaze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#DCE8EF" stopOpacity="0.9" /><stop offset="1" stopColor="#DCE8EF" stopOpacity="0" />
            </linearGradient>
            <clipPath id="fclip"><polygon points={snowPoly} /></clipPath>
            <filter id="fgrain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.014 0.03" numOctaves="3" seed={seed} result="n" />
              <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0" />
            </filter>
          </>
        )}
      </defs>
      <rect x="0" y="0" width="480" height="320" fill="url(#fsky)" />
      {realistic && <rect x="0" y="0" width="480" height={Math.max(60, ridgeY)} fill="url(#fsun)" />}
      <polygon points={snowPoly} fill="url(#fsnow)" />
      {realistic && <rect x="0" y="0" width="480" height="320" fill="#3a5064" filter="url(#fgrain)" clipPath="url(#fclip)" opacity="0.14" style={{ mixBlendMode: "multiply" }} />}
      {realistic && <rect x="0" y={ridgeY - 2} width="480" height="46" fill="url(#fhaze)" />}
      <line x1="0" y1={ridgeY} x2="200" y2={ridgeY - 4} stroke="#B7C8D4" strokeWidth="2" />
      <line x1="200" y1={ridgeY - 4} x2="480" y2={ridgeY} stroke="#B7C8D4" strokeWidth="2" />
      {[110, 200, 280, 370].map((x0, i) => (
        <line key={i} x1={x0} y1="320" x2={cx + (x0 - cx) * 0.12} y2={ridgeY + 6} stroke="#AFC2CE" strokeWidth="1" opacity={realistic ? 0.25 : 0.4} />
      ))}
      {contours.map((y, i) => (
        <line key={i} x1="0" y1={y} x2="480" y2={y} stroke="#9DB4C2" strokeWidth="1" opacity={(realistic ? 0.09 : 0.14) + i * 0.05} />
      ))}
      {q.trees.map((tr, i) => <Tree key={i} {...tr} />)}
      <rect x="0" y="0" width="480" height="320" fill="url(#fatmo)" pointerEvents="none" />
      {revealed && (
        <g>
          <line x1="0" y1={y30} x2="480" y2={y30} stroke={C.threshold} strokeWidth="2" strokeDasharray="7 5" opacity="0.9" />
          <g transform={`translate(444, ${y30 + (y30 < ridgeY + 12 ? 12 : -11)})`}>
            <rect x="-30" y="-9" width="64" height="17" rx="4" fill={C.threshold} />
            <text x="2" y="1" fontSize="9.5" fontFamily="ui-monospace, Menlo, monospace" fontWeight="700" fill="#3A1E00" textAnchor="middle" dominantBaseline="middle">30° ridge</text>
          </g>
        </g>
      )}
    </svg>
  );
}

const Scene = ({ q, revealed, mode, realistic }) =>
  mode === "field" ? <FieldScene q={q} revealed={revealed} realistic={realistic} /> : <ProfileScene q={q} revealed={revealed} realistic={realistic} />;


// ---- Inclinometer gauge --------------------------------------------
function Gauge({ angle }) {
  const band = bandFor(angle);
  const shown = Math.min(angle, 50);
  const cx = 26, cy = 96, L = 96;
  const needle = (d) => { const r = (d * Math.PI) / 180; return { x: cx + L * Math.cos(r), y: cy - L * Math.sin(r) }; };
  const tip = needle(shown), t30 = needle(30);
  return (
    <svg viewBox="0 0 150 110" width="150" height="110" aria-hidden="true">
      <path d={`M ${cx + L} ${cy} A ${L} ${L} 0 0 0 ${needle(50).x} ${needle(50).y}`} fill="none" stroke={C.line} strokeWidth="2" />
      {[0, 10, 20, 30, 40, 50].map((tk) => {
        const p1 = needle(tk);
        const inner = { x: cx + (L - 8) * Math.cos((tk * Math.PI) / 180), y: cy - (L - 8) * Math.sin((tk * Math.PI) / 180) };
        const lab = { x: cx + (L + 9) * Math.cos((tk * Math.PI) / 180), y: cy - (L + 9) * Math.sin((tk * Math.PI) / 180) };
        const is30 = tk === 30;
        return (
          <g key={tk}>
            <line x1={inner.x} y1={inner.y} x2={p1.x} y2={p1.y} stroke={is30 ? C.threshold : C.textMute} strokeWidth={is30 ? 2.5 : 1.5} />
            <text x={lab.x} y={lab.y} fontSize="8" fill={is30 ? C.threshold : C.textDim} fontFamily="ui-monospace, Menlo, monospace" textAnchor="middle" dominantBaseline="middle">{tk}</text>
          </g>
        );
      })}
      <line x1={cx} y1={cy} x2={t30.x} y2={t30.y} stroke={C.threshold} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
      <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke={band.color} strokeWidth="3.5" strokeLinecap="round"
        style={{ transition: reduceMotion ? "none" : "all 700ms cubic-bezier(.2,.9,.2,1)" }} />
      <circle cx={cx} cy={cy} r="4" fill={band.color} />
    </svg>
  );
}

// ---- UI primitives --------------------------------------------------
function Eyebrow({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: "1.4px", textTransform: "uppercase", color: C.ice, fontWeight: 700 }}>{children}</div>;
}
const primaryBtn = { width: "100%", marginTop: 16, padding: "15px", borderRadius: 14, border: "none", background: C.ice, color: C.slate, fontWeight: 700, fontSize: 15, cursor: "pointer", letterSpacing: "0.2px" };
const ghostBtn = { ...primaryBtn, background: "transparent", color: C.textDim, border: `1.5px solid ${C.line}` };

function TrendTile({ label, v, warn }) {
  return (
    <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "7px 9px" }}>
      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 16, fontWeight: 700, color: v == null ? C.textMute : warn ? "#F0812C" : C.snow }}>{v == null ? "—" : v + "%"}</div>
      <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function DiffChips({ byDiff }) {
  const { t } = useLang();
  if (!byDiff || byDiff.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 10.5, color: C.textMute, letterSpacing: "0.4px" }}>{t("slope.byDifficulty")}</span>
      {byDiff.map((d) => (
        <span key={d.k} style={{ fontSize: 12, color: C.textDim }}>
          {t("slope.diff." + d.k)}{" "}
          <b style={{ fontFamily: "ui-monospace, Menlo, monospace", color: d.acc != null && d.acc < 60 ? "#F0812C" : C.snow }}>{d.acc == null ? "—" : d.acc + "%"}</b>
        </span>
      ))}
    </div>
  );
}

function Segmented({ label, hint, options, value, onChange }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        {hint && <span style={{ fontSize: 11.5, color: C.textMute }}>{hint}</span>}
      </div>
      <div style={{ display: "flex", gap: 6, background: C.slate2, padding: 4, borderRadius: 12, border: `1px solid ${C.line}` }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button key={String(o.value)} onClick={() => onChange(o.value)}
              style={{ flex: 1, padding: "9px 6px", borderRadius: 9, border: "none", cursor: "pointer",
                background: on ? C.ice : "transparent", color: on ? C.slate : C.textDim,
                fontWeight: on ? 700 : 500, fontSize: 13, transition: "all 120ms ease" }}>
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Choice button --------------------------------------------------
function Slider({ label, hint, value, min, max, step, onChange, readout }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12.5, color: C.ice, fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700 }}>{readout}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.ice, cursor: "pointer" }} />
      {hint ? <div style={{ fontSize: 11, color: C.textMute, marginTop: 4, lineHeight: 1.4 }}>{hint}</div> : null}
    </div>
  );
}

function ChoiceButton({ label, sub, onClick, disabled, state }) {
  let bg = C.panel, border = C.line, fg = C.snow, subc = C.textDim;
  if (state === "right") { bg = "rgba(63,163,114,0.18)"; border = "#3FA372"; }
  if (state === "wrong") { bg = "rgba(214,72,59,0.16)"; border = "#D6483B"; }
  if (state === "dim") { fg = C.textMute; subc = C.textMute; bg = C.slate2; }
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ flex: 1, padding: "18px 12px", borderRadius: 14, background: bg, border: `1.5px solid ${border}`,
        color: fg, cursor: disabled ? "default" : "pointer", transition: "all 140ms ease", textAlign: "center" }}>
      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px" }}>{label}</div>
      <div style={{ fontSize: 11.5, color: subc, marginTop: 3, letterSpacing: "0.2px" }}>{sub}</div>
    </button>
  );
}

// ---- End-of-session analysis ---------------------------------------
const listAngles = (arr, n = 3) => arr.map((a) => a.angle + "°").slice(0, n).join(", ") + (arr.length > n ? "…" : "");

function buildInsights(answers) {
  const out = [];
  const misses = answers.filter((a) => !a.correct);
  if (misses.length === 0) {
    out.push({ tone: "good", titleKey: "slope.ins.clean.title", bodyKey: "slope.ins.clean.body", vars: {} });
    return out;
  }
  const under = misses.filter((a) => a.angle > 30 && !a.guessOver);
  const over = misses.filter((a) => a.angle < 30 && a.guessOver);
  const near = answers.filter((a) => Math.abs(a.angle - 30) <= 5);
  const nearMiss = near.filter((a) => !a.correct);
  const gross = misses.filter((a) => Math.abs(a.angle - 30) >= 8);
  const pAns = answers.filter((a) => a.view === "profile");
  const fAns = answers.filter((a) => a.view === "field");
  const pMiss = pAns.filter((a) => !a.correct).length;
  const fMiss = fAns.filter((a) => !a.correct).length;
  const bothViews = pAns.length && fAns.length;

  if (under.length >= 2 && under.length > over.length) {
    out.push({ tone: "warn", titleKey: "slope.ins.under.title", bodyKey: "slope.ins.under.body", vars: { n: under.length, list: listAngles(under) } });
  } else if (over.length >= 2 && over.length > under.length) {
    out.push({ tone: "info", titleKey: "slope.ins.over.title", bodyKey: "slope.ins.over.body", vars: { n: over.length, list: listAngles(over) } });
  }

  if (bothViews && fMiss > pMiss) {
    out.push({ tone: "info", titleKey: "slope.ins.field.title", bodyKey: "slope.ins.field.body", vars: { fMiss, fTot: fAns.length, pMiss, pTot: pAns.length } });
  } else if (bothViews && pMiss > fMiss + 1) {
    out.push({ tone: "info", titleKey: "slope.ins.profile.title", bodyKey: "slope.ins.profile.body", vars: { pMiss, pTot: pAns.length, fMiss, fTot: fAns.length } });
  }

  if (nearMiss.length === misses.length) {
    out.push({ tone: "good", titleKey: "slope.ins.close.title", bodyKey: "slope.ins.close.body", vars: { list: listAngles(nearMiss, 5) } });
  } else if (gross.length) {
    out.push({ tone: "warn", titleKey: "slope.ins.gross.title", bodyKey: "slope.ins.gross.body", vars: { list: listAngles(gross, 5) } });
  }

  return out.slice(0, 3);
}

const TONE = { warn: "#F0812C", info: C.ice, good: "#3FA372" };

function MissMap({ answers }) {
  const angles = answers.map((a) => a.angle);
  const amin = Math.min(15, Math.min(...angles) - 2);
  const amax = Math.max(46, Math.max(...angles) + 2);
  const W = 460, padL = 16, padR = 16, top = 14, bot = 60;
  const x = (a) => padL + ((a - amin) / (amax - amin)) * (W - padL - padR);
  const x30 = x(30);
  return (
    <svg viewBox="0 0 460 92" width="100%" height="92" role="img" aria-label="Every slope plotted by angle against the 30 degree line, colored by hit or miss.">
      {/* threshold */}
      <line x1={x30} y1={top - 4} x2={x30} y2={bot + 4} stroke={C.threshold} strokeWidth="2" strokeDasharray="4 4" />
      <text x={x30} y={top - 6} fontSize="9" fill={C.threshold} fontFamily="ui-monospace, Menlo, monospace" fontWeight="700" textAnchor="middle">30°</text>
      {/* baseline + end labels */}
      <line x1={padL} y1={bot + 4} x2={W - padR} y2={bot + 4} stroke={C.line} strokeWidth="1" />
      <text x={padL} y={bot + 18} fontSize="9" fill={C.textMute} fontFamily="ui-monospace, Menlo, monospace">{Math.round(amin)}°</text>
      <text x={W - padR} y={bot + 18} fontSize="9" fill={C.textMute} fontFamily="ui-monospace, Menlo, monospace" textAnchor="end">{Math.round(amax)}°</text>
      {answers.map((a, i) => {
        const cx = x(a.angle);
        const cy = top + ((i * 37) % (bot - top));
        const col = a.correct ? "#3FA372" : "#D6483B";
        return a.view === "field" ? (
          <polygon key={i} points={`${cx},${cy - 4} ${cx - 4},${cy + 3.5} ${cx + 4},${cy + 3.5}`} fill={col}
            stroke={a.correct ? "none" : "#fff"} strokeWidth="0.6" opacity="0.95" />
        ) : (
          <circle key={i} cx={cx} cy={cy} r="4" fill={col} stroke={a.correct ? "none" : "#fff"} strokeWidth="0.6" opacity="0.95" />
        );
      })}
    </svg>
  );
}

// ---- Cross-session tracking (persistent, recency-weighted) ---------
const HALFLIFE = 40; // slopes; recent attempts dominate
const DIFF_WEIGHT = { easy: 0.6, standard: 1.0, hard: 1.6 }; // hard calls count more
const DIFF_LABEL = { easy: "Easy", standard: "Standard", hard: "Hard" };
const EMPTY_HISTORY = { version: 1, nextSid: 1, attempts: [] };

async function loadHistory() { return await loadDoc("slope", EMPTY_HISTORY); }
async function saveHistory(data) { await saveDoc("slope", data); }
async function clearHistory() { await saveDoc("slope", EMPTY_HISTORY); }

function computeTrends(attempts, easyW = 0.5) {
  const total = attempts.length;
  if (!total) return { n: 0, sessions: [], byDiff: [] };
  const DW = { easy: easyW, standard: 1.0, hard: 2.0 - easyW }; // standard pinned; hard mirrors easy about 2.0
  let W = 0, Wc = 0, nW = 0, nWc = 0, pW = 0, pWc = 0, fW = 0, fWc = 0, under = 0, over = 0;
  const dW = {}, dC = {}; // per-difficulty, recency-weighted only (for the breakdown)
  attempts.forEach((a, i) => {
    const rw = Math.pow(0.5, (total - 1 - i) / HALFLIFE); // newest = 1
    const dk = a.diff || "standard";
    const w = rw * (DW[dk] ?? 1.0); // headline metrics: recency × difficulty
    W += w; if (a.correct) Wc += w;
    if (Math.abs(a.angle - 30) <= 5) { nW += w; if (a.correct) nWc += w; }
    if (a.view === "profile") { pW += w; if (a.correct) pWc += w; }
    if (a.view === "field") { fW += w; if (a.correct) fWc += w; }
    if (!a.correct) { if (a.angle > 30 && !a.over) under += w; else if (a.angle < 30 && a.over) over += w; }
    dW[dk] = (dW[dk] || 0) + rw; if (a.correct) dC[dk] = (dC[dk] || 0) + rw;
  });
  const pct = (c, t) => (t > 0 ? Math.round((c / t) * 100) : null);
  const bySid = new Map();
  attempts.forEach((a) => { const o = bySid.get(a.sid) || { c: 0, n: 0, sid: a.sid }; o.n++; if (a.correct) o.c++; bySid.set(a.sid, o); });
  const sessions = [...bySid.values()].sort((x, y) => x.sid - y.sid).map((o) => ({ sid: o.sid, acc: Math.round((o.c / o.n) * 100), n: o.n }));
  const byDiff = ["easy", "standard", "hard"]
    .filter((k) => dW[k] > 0)
    .map((k) => ({ k, label: DIFF_LABEL[k], acc: pct(dC[k], dW[k]) }));
  return {
    n: total, sessions, byDiff, acc: pct(Wc, W), near: pct(nWc, nW),
    profile: pct(pWc, pW), field: pct(fWc, fW), under, over, hasBoth: pW > 0 && fW > 0,
  };
}

function Sparkline({ sessions }) {
  const d = sessions.slice(-12);
  if (d.length < 2) return null;
  const W = 200, H = 40, pad = 4;
  const x = (i) => pad + (i / (d.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  const pts = d.map((s, i) => `${x(i)},${y(s.acc)}`).join(" ");
  const last = d[d.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
      <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={C.line} strokeWidth="1" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={C.ice} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {d.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.acc)} r={i === d.length - 1 ? 3.5 : 2} fill={i === d.length - 1 ? C.ice : C.textMute} />)}
      <text x={W - pad} y={y(last.acc) - 6} fontSize="9" fill={C.ice} fontFamily="ui-monospace, Menlo, monospace" fontWeight="700" textAnchor="end">{last.acc}%</text>
    </svg>
  );
}

// ---- Main -----------------------------------------------------------
const DEFAULTS = { record: true, difficulty: "standard", mode: "mix", count: 10, feedback: "full", easyWeight: 0.5, render: "standard" };

export function SlopeApp({ onHome }) {
  const { t } = useLang();
  const [phase, setPhase] = useState("setup"); // setup | quiz | done
  const [settings, setSettings] = useState(DEFAULTS);
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [pick, setPick] = useState(null);
  const [history, setHistory] = useState(null); // null until loaded
  const [resetArmed, setResetArmed] = useState(false);
  const savedRef = useRef(false);

  useEffect(() => { loadHistory().then(setHistory); }, []);

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const setRecord = (v) => set("record", v); // holds within this sitting; resets to record on reload
  const begin = useCallback(() => {
    savedRef.current = false; setResetArmed(false);
    setQuestions(newSet(settings)); setAnswers([]); setIdx(0); setPick(null); setPhase("quiz");
  }, [settings]);

  const done = idx >= questions.length && phase === "quiz";

  // Persist a completed session once, then fold into history.
  useEffect(() => {
    if (!done || savedRef.current || !history || answers.length === 0) return;
    savedRef.current = true;
    if (!settings.record) return; // guest run — do not touch history
    const sid = history.nextSid, ts = Date.now();
    const recs = answers.map((a) => ({ sid, ts, angle: a.angle, correct: a.correct, view: a.view, over: a.guessOver, diff: settings.difficulty }));
    const data = { version: 1, nextSid: sid + 1, attempts: [...history.attempts, ...recs].slice(-500) };
    setHistory(data); saveHistory(data);
  }, [done, history, answers, settings.record]);

  const trends = useMemo(() => (history ? computeTrends(history.attempts, settings.easyWeight) : null), [history, settings.easyWeight]);
  const resetStats = () => {
    if (!resetArmed) { setResetArmed(true); return; }
    clearHistory(); setHistory({ version: 1, nextSid: 1, attempts: [] }); setResetArmed(false);
  };

  const shell = { minHeight: "100%", background: C.slate, color: C.snow,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: "18px 14px 28px", boxSizing: "border-box" };
  const card = { maxWidth: 520, margin: "0 auto" };

  // ---------- SETUP ----------
  if (phase === "setup") {
    return (
      <div style={shell}>
        <div style={card}>
          {onHome && (
            <button onClick={onHome} style={{ background: "transparent", border: "none", color: C.textDim, cursor: "pointer", fontSize: 13, padding: "0 0 10px", fontWeight: 600 }}>← All tools</button>
          )}
          <Eyebrow>{t("slope.setup.eyebrow")}</Eyebrow>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: "6px 0 14px" }}>{t("slope.setup.title")}</h1>

          <button onClick={() => setRecord(!settings.record)}
            style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
              padding: "13px 15px", borderRadius: 14, cursor: "pointer", marginBottom: 18,
              border: `2px solid ${settings.record ? C.line : "#F0812C"}`,
              background: settings.record ? C.slate2 : "rgba(240,129,44,0.14)" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: settings.record ? C.snow : "#F0812C" }}>
                {settings.record ? t("slope.record.on") : t("slope.record.off")}
              </div>
              <div style={{ fontSize: 11.5, color: C.textDim, marginTop: 3, lineHeight: 1.4 }}>
                {settings.record ? t("slope.record.onSub") : t("slope.record.offSub")}
              </div>
            </div>
            <div style={{ width: 46, height: 27, borderRadius: 14, flexShrink: 0, position: "relative", transition: "background 140ms",
              background: settings.record ? C.ice : "#7A5230" }}>
              <div style={{ position: "absolute", top: 3, left: settings.record ? 22 : 3, width: 21, height: 21, borderRadius: "50%", background: "#fff", transition: "left 140ms" }} />
            </div>
          </button>

          <p style={{ color: C.textDim, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 22px" }}>
            Call each slope <b style={{ color: C.snow }}>steeper</b> or <b style={{ color: C.snow }}>shallower</b> than 30° — the avalanche threshold. Every slope is drawn at a known angle, so grading is exact.
          </p>

          {trends && trends.n > 0 ? (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.slate2, padding: "12px 14px", marginBottom: 22 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontSize: 11, letterSpacing: "0.6px", textTransform: "uppercase", color: C.textDim }}>Your trend · recent + difficulty weighted</div>
                <button onClick={resetStats} style={{ background: "none", border: "none", color: resetArmed ? "#D6483B" : C.textMute, fontSize: 11, cursor: "pointer", padding: 0 }}>{resetArmed ? "Tap to erase" : "Reset"}</button>
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 8 }}>
                <div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 34, fontWeight: 700, lineHeight: 1, color: C.ice }}>{trends.acc == null ? "—" : trends.acc + "%"}</div>
                  <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 3 }}>{t("slope.results.sessionsSlopes", { sessions: trends.sessions.length, n: trends.n })}</div>
                </div>
                <div style={{ flex: 1 }}><Sparkline sessions={trends.sessions} /></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <TrendTile label={t("slope.trend.near")} v={trends.near} />
                {trends.hasBoth ? <TrendTile label={t("slope.trend.profile")} v={trends.profile} /> : null}
                {trends.hasBoth ? <TrendTile label={t("slope.trend.field")} v={trends.field} warn={trends.field < trends.profile} /> : null}
              </div>
              <DiffChips byDiff={trends.byDiff} />
            </div>
          ) : (
            <p style={{ color: C.textMute, fontSize: 12, margin: "-8px 0 22px" }}>{t("slope.setup.noHistory")}</p>
          )}

          <Slider label={t("slope.slider.diffWeight")}
            value={settings.easyWeight} min={0} max={1} step={0.1}
            onChange={(v) => set("easyWeight", Math.round(v * 10) / 10)}
            readout={`${settings.easyWeight.toFixed(1)} · 1.0 · ${(2 - settings.easyWeight).toFixed(1)}`}
            hint={t("slope.slider.diffWeightHint")} />

          <Segmented label={t("slope.seg.difficulty")} hint={t("slope.seg.difficultyHint")}
            value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: t("slope.diff.easy"), value: "easy" }, { label: t("slope.diff.standard"), value: "standard" }, { label: t("slope.diff.hard"), value: "hard" }]} />

          <Segmented label={t("slope.seg.imageStyle")} hint={settings.render === "realistic" ? t("slope.seg.imageHintRealistic") : t("slope.seg.imageHintStandard")}
            value={settings.render} onChange={(v) => set("render", v)}
            options={[{ label: t("slope.img.standard"), value: "standard" }, { label: t("slope.img.realistic"), value: "realistic" }]} />

          <Segmented label={t("slope.seg.view")}
            hint={settings.mode === "field" ? t("slope.viewHint.field") : settings.mode === "mix" ? t("slope.viewHint.mix") : t("slope.viewHint.profile")}
            value={settings.mode} onChange={(v) => set("mode", v)}
            options={[{ label: t("slope.view.profile"), value: "profile" }, { label: t("slope.view.mix"), value: "mix" }, { label: t("slope.view.field"), value: "field" }]} />

          <Segmented label={t("slope.seg.perSet")}
            value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "15", value: 15 }, { label: "20", value: 20 }]} />

          <Segmented label={t("slope.seg.feedback")} hint={settings.feedback === "full" ? t("slope.fbHint.full") : t("slope.fbHint.minimal")}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: t("slope.fb.minimal"), value: "minimal" }, { label: t("slope.fb.full"), value: "full" }]} />

          <button onClick={begin} style={primaryBtn}>{t("slope.start", { count: settings.count })}</button>
          <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 16 }}>
            {t("slope.setup.footer")}
          </p>
        </div>
      </div>
    );
  }

  const q = questions[idx];
  const score = answers.filter((a) => a.correct).length;

  // ---------- DONE ----------
  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    const verdict = pct >= 90 ? t("slope.verdict.sharp") : pct >= 70 ? t("slope.verdict.solid") : pct >= 50 ? t("slope.verdict.getting") : t("slope.verdict.reps");
    const insights = buildInsights(answers);
    const accOf = (arr) => (arr.length ? Math.round((arr.filter((a) => a.correct).length / arr.length) * 100) : null);
    const nearZone = answers.filter((a) => Math.abs(a.angle - 30) <= 5);
    const nearAcc = accOf(nearZone);
    const pAns = answers.filter((a) => a.view === "profile");
    const fAns = answers.filter((a) => a.view === "field");
    const bothViews = pAns.length && fAns.length;
    let trendNote = null;
    if (trends && trends.n >= 8 && trends.acc != null) {
      const diff = pct - trends.acc;
      if (diff >= 8) trendNote = t("slope.trendNote.up", { pct, acc: trends.acc });
      else if (diff <= -8) trendNote = t("slope.trendNote.down", { pct, acc: trends.acc });
      else trendNote = t("slope.trendNote.around", { acc: trends.acc });
      if (trends.hasBoth && trends.field != null && trends.profile != null && trends.field <= trends.profile - 10)
        trendNote += t("slope.trendNote.fieldWeak", { field: trends.field, profile: trends.profile });
      const hardD = trends.byDiff.find((d) => d.k === "hard");
      const easyD = trends.byDiff.find((d) => d.k === "easy");
      if (hardD && easyD && hardD.acc != null && easyD.acc != null && hardD.acc <= easyD.acc - 12)
        trendNote += t("slope.trendNote.hardTrail", { hard: hardD.acc, easy: easyD.acc });
    }
    const Tile = ({ label, value, accent }) => (
      <div style={{ flex: 1, background: C.slate2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px" }}>
        <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 22, fontWeight: 700, color: accent || C.snow }}>{value == null ? "—" : value + "%"}</div>
        <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 2, letterSpacing: "0.3px" }}>{label}</div>
      </div>
    );
    return (
      <div style={shell}>
        <div style={card}>
          <Eyebrow>{t("slope.results.eyebrow")}</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 6 }}>
            <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 56, fontWeight: 700, lineHeight: 1 }}>
              {score}<span style={{ color: C.textMute, fontSize: 30 }}>/{questions.length}</span>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{verdict}</div>
              <div style={{ color: C.textDim, fontSize: 13 }}>{t("slope.results.calledCorrectly", { pct })}</div>
            </div>
          </div>
          {!settings.record && (
            <div style={{ marginTop: 12, border: "1px solid #F0812C", background: "rgba(240,129,44,0.12)", borderRadius: 12, padding: "10px 14px", fontSize: 12.5, color: "#F0812C", fontWeight: 600 }}>
              {t("slope.results.guestNote")}
            </div>
          )}
          <div style={{ fontSize: 12, letterSpacing: "0.6px", textTransform: "uppercase", color: C.textDim, margin: "22px 0 8px" }}>{t("slope.results.whereLanded")}</div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.slate2, padding: "12px 14px 14px" }}>
            <MissMap answers={answers} />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 11, color: C.textDim, marginTop: 2 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#3FA372", display: "inline-block" }} />{t("slope.legend.hit")}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 9, height: 9, borderRadius: "50%", background: "#D6483B", display: "inline-block" }} />{t("slope.legend.miss")}</span>
              <span style={{ color: C.textMute }}>{t("slope.legend.shapes")}</span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <Tile label={t("slope.tile.near")} value={nearAcc} accent={nearAcc != null && nearAcc < 60 ? "#F0812C" : "#3FA372"} />
              {bothViews ? <Tile label={t("slope.tile.profileCalls")} value={accOf(pAns)} /> : null}
              {bothViews ? <Tile label={t("slope.tile.fieldCalls")} value={accOf(fAns)} accent={accOf(fAns) < accOf(pAns) ? "#F0812C" : undefined} /> : null}
            </div>
          </div>

          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ borderLeft: `3px solid ${TONE[ins.tone]}`, background: C.slate2, borderRadius: "0 12px 12px 0", padding: "11px 14px" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: TONE[ins.tone] }}>{t(ins.titleKey)}</div>
                <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, marginTop: 3 }}>{t(ins.bodyKey, ins.vars)}</div>
              </div>
            ))}
          </div>

          {trends && trends.n > 0 ? (
            <>
              <div style={{ fontSize: 12, letterSpacing: "0.6px", textTransform: "uppercase", color: C.textDim, margin: "22px 0 8px" }}>{t("slope.results.acrossSessions")}</div>
              <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.slate2, padding: "12px 14px" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 30, fontWeight: 700, color: C.ice, lineHeight: 1 }}>{trends.acc == null ? "—" : trends.acc + "%"}</div>
                    <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 3 }}>{t("slope.results.sessionsSlopes", { sessions: trends.sessions.length, n: trends.n })}</div>
                  </div>
                  <div style={{ flex: 1 }}><Sparkline sessions={trends.sessions} /></div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <TrendTile label={t("slope.trend.near")} v={trends.near} />
                  {trends.hasBoth ? <TrendTile label={t("slope.trend.profile")} v={trends.profile} /> : null}
                  {trends.hasBoth ? <TrendTile label={t("slope.trend.field")} v={trends.field} warn={trends.field < trends.profile} /> : null}
                </div>
                <DiffChips byDiff={trends.byDiff} />
                {trendNote ? <div style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, marginTop: 10 }}>{trendNote}</div> : null}
              </div>
            </>
          ) : null}

          <div style={{ fontSize: 12, letterSpacing: "0.6px", textTransform: "uppercase", color: C.textDim, margin: "22px 0 8px" }}>{t("slope.results.slopeBySlope")}</div>
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "flex", padding: "9px 14px", background: C.slate2, fontSize: 11, color: C.textDim, letterSpacing: "0.6px", textTransform: "uppercase" }}>
              <div style={{ width: 34 }}>#</div><div style={{ flex: 1 }}>{t("slope.table.yourCall")}</div>
              <div style={{ width: 78, textAlign: "right" }}>{t("slope.table.actual")}</div><div style={{ width: 30 }} />
            </div>
            {answers.map((a, i) => {
              const b = bandFor(a.angle);
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "9px 14px", borderTop: `1px solid ${C.line}`, fontSize: 13.5 }}>
                  <div style={{ width: 34, color: C.textMute, fontFamily: "ui-monospace, Menlo, monospace" }}>{i + 1}</div>
                  <div style={{ flex: 1, fontFamily: "ui-monospace, Menlo, monospace" }}>{a.guessOver ? "> 30°" : "< 30°"}</div>
                  <div style={{ width: 78, textAlign: "right", fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 700, color: b.color }}>{a.angle}°</div>
                  <div style={{ width: 30, textAlign: "right", fontWeight: 700, color: a.correct ? "#3FA372" : "#D6483B" }}>{a.correct ? "✓" : "✗"}</div>
                </div>
              );
            })}
          </div>
          <button onClick={begin} style={primaryBtn}>{t("slope.results.runMore", { n: questions.length })}</button>
          <button onClick={() => setPhase("setup")} style={ghostBtn}>{t("slope.results.changeSettings")}</button>
          {onHome && <button onClick={onHome} style={ghostBtn}>{t("slope.results.back")}</button>}
        </div>
      </div>
    );
  }

  // ---------- QUIZ ----------
  const isOver = q.angle > 30;
  const band = bandFor(q.angle);
  const close = Math.abs(q.angle - 30) <= 2;
  const answer = (guessOver) => {
    if (pick !== null) return;
    setPick(guessOver);
    setAnswers((prev) => [...prev, { angle: q.angle, guessOver, correct: guessOver === isOver, view: q.view }]);
  };
  const next = () => { setPick(null); setIdx((i) => i + 1); };

  return (
    <div style={shell}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Eyebrow>{settings.mode === "mix" ? t("slope.quiz.mixPrefix") : ""}{q.view === "field" ? t("slope.quiz.fieldView") : t("slope.quiz.profile")} · {t("slope.diff." + settings.difficulty)}</Eyebrow>
            {!settings.record && <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.6px", color: "#F0812C", border: "1px solid #F0812C", borderRadius: 5, padding: "1px 5px" }}>{t("slope.guest")}</span>}
          </div>
          <div style={{ display: "flex", gap: 16, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13 }}>
            <span style={{ color: C.textDim }}>{t("slope.q.qLabel")} <span style={{ color: C.snow }}>{idx + 1}</span>/{questions.length}</span>
            <span style={{ color: C.textDim }}>{t("slope.q.score")} <span style={{ color: C.ice }}>{score}</span></span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
          {questions.map((_, i) => {
            const a = answers[i];
            const c = a ? (a.correct ? "#3FA372" : "#D6483B") : i === idx ? C.ice : C.line;
            return <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: c }} />;
          })}
        </div>

        <Scene q={q} revealed={pick !== null} mode={q.view} realistic={settings.render === "realistic"} />

        <div style={{ marginTop: 6, color: C.textDim, fontSize: 12.5, textAlign: "center", minHeight: 18 }}>
          {pick === null && (q.view === "field" ? t("slope.prompt.field") : t("slope.prompt.profile"))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <ChoiceButton label="< 30°" sub={t("slope.choice.underSub")} onClick={() => answer(false)} disabled={pick !== null}
            state={pick === null ? null : !isOver ? "right" : pick === false ? "wrong" : "dim"} />
          <ChoiceButton label="> 30°" sub={t("slope.choice.overSub")} onClick={() => answer(true)} disabled={pick !== null}
            state={pick === null ? null : isOver ? "right" : pick === true ? "wrong" : "dim"} />
        </div>

        {pick !== null && settings.feedback === "full" && (
          <div style={{ marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 16, background: C.slate2, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
            <Gauge angle={q.angle} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 40, fontWeight: 700, color: band.color, lineHeight: 1 }}>{q.angle}°</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: pick === isOver ? "#3FA372" : "#D6483B" }}>{pick === isOver ? t("slope.reveal.correct") : t("slope.reveal.missed")}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: band.color, marginTop: 5 }}>{t("slope.band." + band.key + ".name")}</div>
              <div style={{ fontSize: 12.5, color: C.textDim, marginTop: 2, lineHeight: 1.45 }}>{close ? t("slope.reveal.close") : ""}{t("slope.band." + band.key + ".note")}</div>
            </div>
          </div>
        )}

        {pick !== null && settings.feedback === "minimal" && (
          <div style={{ marginTop: 16, border: `1px solid ${pick === isOver ? "#3FA372" : "#D6483B"}`, borderRadius: 14,
            background: pick === isOver ? "rgba(63,163,114,0.12)" : "rgba(214,72,59,0.10)", padding: "13px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: pick === isOver ? "#3FA372" : "#D6483B" }}>
              {pick === isOver ? t("slope.reveal.correct") : t("slope.reveal.missed")}
            </span>
            <span style={{ fontSize: 13, color: C.textDim }}>{isOver ? t("slope.reveal.wasOver") : t("slope.reveal.wasUnder")}</span>
          </div>
        )}

        {pick !== null && (
          <button onClick={next} style={primaryBtn}>{idx === questions.length - 1 ? t("slope.next.score") : t("slope.next.slope")}</button>
        )}
      </div>
    </div>
  );
}
