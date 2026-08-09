import React, { useState, useMemo, useEffect } from "react";
import { loadDoc, saveDoc } from "./storage";
import { ax, useAcronyms } from "./glossary.jsx";

/* ------------------------------------------------------------------ *
 * BCA Crystal Card Trainer
 * Two field skills, drawn on a to-scale grid so grading is exact:
 *   · Size  — read average grain size in mm off the 2 mm grid.
 *   · Grain — classify the grain type (PP / RG / FC / DH / SH / MF).
 * Crystals are drawn at a known size on a known grid, so every
 * question has an exact ground truth. Setup controls difficulty,
 * mode, set length, feedback, and card style.
 * ------------------------------------------------------------------ */

// ---- Palette: the card is a dark, translucent-blue field ------------
const C = {
  slate: "#0E1621", slate2: "#16232F", panel: "#1B2A38", line: "#2C3E4E",
  snow: "#EAF0F4", ice: "#5AD1CF", aqua: "#5AD1CF", threshold: "#F0812C",
  field: "#0A1A2A", fieldEdge: "#0E2740", grid: "#2E6C7E", gridMaj: "#4FB6C4",
  crystal: "#E6F1F7", textDim: "#8AA0B0", textMute: "#5E7789",
  good: "#3FA372", warn: "#F0812C", bad: "#D6483B",
};
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";
const reduceMotion =
  typeof window !== "undefined" && window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- Deterministic per-question RNG --------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Grain taxonomy -------------------------------------------------
// size = [min, max] mm of the measured grain; persist = weak-layer risk.
const GRAINS = {
  PP: { code: "PP", label: "New snow", sub: "Precipitation particles", size: [1.0, 4.0],
        persist: "new", teach: "Fresh stellars and dendrites. Bond fast once they settle; the concern is loading and storm-slab instability, not persistence." },
  DF: { code: "DF", label: "Decomposing", sub: "Fragmented precip", size: [0.5, 2.0],
        persist: "new", teach: "Broken-down new snow, rounding as it settles. Generally strengthening — the crystal is losing its branches." },
  RG: { code: "RG", label: "Rounded grains", sub: "Well-sintered", size: [0.25, 1.0],
        persist: "low", teach: "Small, smooth, well-bonded grains. This is strong, cohesive snow — necks between grains carry load. Low persistent-weak-layer concern." },
  FC: { code: "FC", label: "Faceted", sub: "Angular, flat faces", size: [0.5, 2.5],
        persist: "high", teach: "Angular grains with flat faces and sharp corners — sugary and poorly bonded. A classic persistent weak layer; buried facets can stay reactive for weeks." },
  DH: { code: "DH", label: "Depth hoar", sub: "Striated cups / columns", size: [2.0, 8.0],
        persist: "high", teach: "Large striated cups and columns at the base — advanced faceting. Weak, unsupportive, and stubbornly persistent. A serious structural red flag." },
  SH: { code: "SH", label: "Surface hoar", sub: "Feathery, striated", size: [2.0, 12.0],
        persist: "high", teach: "Feathery frost grown on the surface on clear, calm nights. Once buried it makes a smooth, widespread, and long-lived weak layer — handle gently, it shatters when you size it." },
  MF: { code: "MF", label: "Melt-freeze", sub: "Wet / rounded clusters", size: [1.0, 3.0],
        persist: "wet", teach: "Rounded polycrystal clusters from melt-freeze. Strong when frozen solid; the concern is loss of strength when it thaws and free water appears." },
};
const ORDER = ["PP", "DF", "RG", "FC", "DH", "SH", "MF"];
// Difficulty controls which grains appear and how many answer options.
const POOL = {
  easy:     ["PP", "RG", "FC", "DH", "SH"],
  moderate: ["PP", "DF", "RG", "FC", "DH", "SH", "MF"],
  hard:     ["PP", "DF", "RG", "FC", "DH", "SH", "MF"],
};
const N_OPTIONS = { easy: 4, moderate: 5, hard: 7 };
const SIZE_TOL = { easy: 1.0, moderate: 0.6, hard: 0.4 }; // ± mm counted correct
// Commonly-confused pairs, so hard sets surface a real distractor.
const CONFUSERS = { PP: "DF", DF: "PP", RG: "MF", FC: "DH", DH: "FC", SH: "PP", MF: "RG" };

const round4 = (x) => Math.round(x * 4) / 4;

function makeQuestion(settings, seed) {
  const rng = mulberry32(seed);
  const mode = settings.mode === "mix" ? (rng() < 0.5 ? "size" : "type") : settings.mode;
  const pool = POOL[settings.difficulty] || POOL.moderate;
  const code = pool[Math.floor(rng() * pool.length)];
  const g = GRAINS[code];
  const size = round4(g.size[0] + rng() * (g.size[1] - g.size[0]));

  let options = null;
  if (mode === "type") {
    const n = N_OPTIONS[settings.difficulty] || 5;
    const set = new Set([code]);
    const conf = CONFUSERS[code];
    if (conf && GRAINS[conf]) set.add(conf);
    const rest = ORDER.filter((c) => !set.has(c));
    for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
    for (const c of rest) { if (set.size >= n) break; set.add(c); }
    options = [...set];
    for (let i = options.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [options[i], options[j]] = [options[j], options[i]]; }
  }
  return { seed, mode, code, size, options };
}

// ---- Drawing the crystal (in field px; caller supplies pxPerMm) -----
function drawGrain(code, sizeMm, pxPerMm, cx, cy, rng, jitter) {
  const d = sizeMm * pxPerMm;              // characteristic diameter, px
  const j = (m) => (rng() - 0.5) * 2 * m * jitter;
  const stroke = C.crystal, fillSoft = "rgba(230,241,247,0.16)";
  const els = [];
  const key = (n) => code + "-" + n;

  if (code === "PP" || code === "DF") {
    const arms = code === "PP" ? 6 : (4 + Math.floor(rng() * 2));
    const R = d / 2;
    const branch = code === "PP" ? 0.42 : 0.24;
    for (let a = 0; a < arms; a++) {
      const ang = (a / arms) * Math.PI * 2 + j(0.25);
      const ex = cx + Math.cos(ang) * R, ey = cy + Math.sin(ang) * R;
      els.push(<line key={key("a" + a)} x1={cx} y1={cy} x2={ex} y2={ey} stroke={stroke} strokeWidth={1.4} strokeLinecap="round" />);
      // side branches
      for (const t of [0.5, 0.72]) {
        const bx = cx + Math.cos(ang) * R * t, by = cy + Math.sin(ang) * R * t;
        const bl = R * branch * (1 - t + 0.4);
        for (const s of [1, -1]) {
          const ba = ang + s * (Math.PI / 3);
          els.push(<line key={key("b" + a + t + s)} x1={bx} y1={by} x2={bx + Math.cos(ba) * bl} y2={by + Math.sin(ba) * bl} stroke={stroke} strokeWidth={1} strokeLinecap="round" />);
        }
      }
    }
    els.push(<circle key={key("hub")} cx={cx} cy={cy} r={Math.max(1.5, d * 0.05)} fill={stroke} />);
    return els;
  }

  if (code === "RG" || code === "MF") {
    // A representative grain at sizeMm, plus context neighbours.
    const r = d / 2;
    const wet = code === "MF";
    const neigh = wet ? 5 : 4;
    const pts = [[cx, cy, r]];
    for (let i = 0; i < neigh; i++) {
      const ang = (i / neigh) * Math.PI * 2 + j(0.4);
      const rr = r * (wet ? (0.7 + rng() * 0.5) : (0.55 + rng() * 0.4));
      const dist = r + rr - (wet ? rr * 0.55 : rr * 0.25); // wet grains fuse/overlap
      pts.push([cx + Math.cos(ang) * dist, cy + Math.sin(ang) * dist, rr]);
    }
    pts.forEach((p, i) => {
      els.push(<circle key={key("g" + i)} cx={p[0]} cy={p[1]} r={p[2]} fill={fillSoft} stroke={stroke} strokeWidth={wet ? 1.6 : 1.3} />);
      if (wet) els.push(<circle key={key("h" + i)} cx={p[0] - p[2] * 0.3} cy={p[1] - p[2] * 0.3} r={p[2] * 0.22} fill="rgba(255,255,255,0.55)" />);
    });
    // sintering necks for rounds
    if (!wet) for (let i = 1; i < pts.length; i++)
      els.push(<line key={key("n" + i)} x1={cx} y1={cy} x2={pts[i][0]} y2={pts[i][1]} stroke={stroke} strokeWidth={0.9} opacity={0.5} />);
    return els;
  }

  if (code === "FC") {
    // Angular flat-faced grains: irregular hexagons with sharp corners.
    const drawFacet = (ox, oy, rad, kk) => {
      const nSides = 6, ang0 = j(0.4);
      const poly = [];
      for (let i = 0; i < nSides; i++) {
        const ang = ang0 + (i / nSides) * Math.PI * 2;
        const rr = rad * (0.78 + rng() * 0.32);
        poly.push([ox + Math.cos(ang) * rr, oy + Math.sin(ang) * rr]);
      }
      els.push(<polygon key={key("f" + kk)} points={poly.map((p) => p.join(",")).join(" ")} fill={fillSoft} stroke={stroke} strokeWidth={1.5} strokeLinejoin="miter" />);
      // one interior facet edge to read as flat-faced
      els.push(<line key={key("fe" + kk)} x1={poly[0][0]} y1={poly[0][1]} x2={poly[3][0]} y2={poly[3][1]} stroke={stroke} strokeWidth={0.8} opacity={0.55} />);
    };
    const r = d / 2;
    drawFacet(cx, cy, r, 0);
    drawFacet(cx + r * 1.3, cy + r * 0.5, r * 0.72, 1);
    drawFacet(cx - r * 1.1, cy + r * 0.7, r * 0.6, 2);
    return els;
  }

  if (code === "DH") {
    // Striated cup: partial hexagonal goblet with horizontal steps.
    const w = d, h = d * 0.95;
    const left = cx - w / 2, right = cx + w / 2, topY = cy - h / 2, botY = cy + h / 2;
    const cup = [
      [left, topY], [right, topY],
      [right - w * 0.14, botY], [left + w * 0.14, botY],
    ];
    els.push(<polygon key={key("cup")} points={cup.map((p) => p.join(",")).join(" ")} fill={fillSoft} stroke={stroke} strokeWidth={1.6} strokeLinejoin="round" />);
    // hollow scoop at top
    els.push(<path key={key("scoop")} d={`M ${left + w * 0.06} ${topY + h * 0.06} Q ${cx} ${topY + h * 0.42} ${right - w * 0.06} ${topY + h * 0.06}`} fill="none" stroke={stroke} strokeWidth={1.1} opacity={0.8} />);
    // striations / steps
    for (let i = 1; i <= 3; i++) {
      const yy = topY + (h * i) / 4;
      const inset = w * 0.035 * i;
      els.push(<line key={key("s" + i)} x1={left + inset} y1={yy} x2={right - inset} y2={yy} stroke={stroke} strokeWidth={0.9} opacity={0.55} />);
    }
    return els;
  }

  if (code === "SH") {
    // Feathery, striated wedge crystals fanning from a spine.
    const feather = (ox, oy, len, ang, kk) => {
      const ex = ox + Math.cos(ang) * len, ey = oy + Math.sin(ang) * len;
      els.push(<line key={key("sp" + kk)} x1={ox} y1={oy} x2={ex} y2={ey} stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />);
      const ribs = Math.max(4, Math.round(len / (pxPerMm * 0.6)));
      for (let i = 1; i <= ribs; i++) {
        const t = i / (ribs + 1);
        const px = ox + Math.cos(ang) * len * t, py = oy + Math.sin(ang) * len * t;
        const rl = len * 0.34 * (1 - t * 0.5);
        for (const s of [1, -1]) {
          const ra = ang + s * (Math.PI / 2.6);
          els.push(<line key={key("r" + kk + i + s)} x1={px} y1={py} x2={px + Math.cos(ra) * rl} y2={py + Math.sin(ra) * rl} stroke={stroke} strokeWidth={0.85} strokeLinecap="round" opacity={0.9} />);
        }
      }
    };
    const len = d;
    const baseAng = -Math.PI / 2 + j(0.5);
    feather(cx, cy + len * 0.35, len, baseAng, 0);
    if (rng() < 0.6) feather(cx + len * 0.28, cy + len * 0.4, len * 0.7, baseAng + 0.5, 1);
    return els;
  }
  return els;
}

// ---- The card instrument (SVG) -------------------------------------
function CrystalCard({ q, pxPerMm = 15, style = "poly", showMeasure = false, loupe = false }) {
  const fieldW_mm = 20, fieldH_mm = 13;
  const fw = fieldW_mm * pxPerMm, fh = fieldH_mm * pxPerMm;
  const padL = 30, padT = 16, padR = 16, padB = 26;
  const W = fw + padL + padR, H = fh + padT + padB;
  const rng = useMemo(() => mulberry32(q.seed ^ 0x9e3779b9), [q.seed]);
  const jitter = 1;
  const cx = padL + fw / 2, cy = padT + fh / 2;

  // grid lines
  const grid = [];
  const majEvery = style === "alu" ? 3 : 2;     // major grid spacing in mm
  const minEvery = style === "alu" ? 1 : 2;     // minor grid spacing in mm
  for (let mm = 0; mm <= fieldW_mm + 0.001; mm += minEvery) {
    const x = padL + mm * pxPerMm, maj = Math.abs(mm % majEvery) < 0.001;
    grid.push(<line key={"vx" + mm} x1={x} y1={padT} x2={x} y2={padT + fh} stroke={maj ? C.gridMaj : C.grid} strokeWidth={maj ? 1 : 0.5} opacity={maj ? 0.7 : 0.4} />);
  }
  for (let mm = 0; mm <= fieldH_mm + 0.001; mm += minEvery) {
    const y = padT + mm * pxPerMm, maj = Math.abs(mm % majEvery) < 0.001;
    grid.push(<line key={"hz" + mm} x1={padL} y1={y} x2={padL + fw} y2={y} stroke={maj ? C.gridMaj : C.grid} strokeWidth={maj ? 1 : 0.5} opacity={maj ? 0.7 : 0.4} />);
  }
  // ruler ticks + mm labels along the left edge
  const ruler = [];
  for (let mm = 0; mm <= fieldH_mm + 0.001; mm += 2) {
    const y = padT + mm * pxPerMm;
    ruler.push(<line key={"tick" + mm} x1={padL - 6} y1={y} x2={padL} y2={y} stroke={C.gridMaj} strokeWidth={1} />);
    ruler.push(<text key={"tl" + mm} x={padL - 8} y={y + 3} fontSize="7.5" fill={C.textMute} fontFamily={MONO} textAnchor="end">{mm}</text>);
  }

  const grainEls = drawGrain(q.code, q.size, pxPerMm, cx, cy, rng, jitter);

  // reveal caliper: bracket the measured span across the grid
  const measure = [];
  if (showMeasure) {
    const half = (q.size * pxPerMm) / 2, my = padT + fh - 10;
    measure.push(<line key="m0" x1={cx - half} y1={my} x2={cx + half} y2={my} stroke={C.threshold} strokeWidth={1.6} />);
    for (const s of [-1, 1]) measure.push(<line key={"mc" + s} x1={cx + s * half} y1={my - 4} x2={cx + s * half} y2={my + 4} stroke={C.threshold} strokeWidth={1.6} />);
    measure.push(<text key="mt" x={cx} y={my - 6} fontSize="9" fontWeight="700" fill={C.threshold} fontFamily={MONO} textAnchor="middle">{q.size.toFixed(2)} mm</text>);
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", maxHeight: 300 }} role="img"
      aria-label="Snow crystal on a to-scale grid card">
      <defs>
        <radialGradient id="cardfield" cx="50%" cy="42%" r="75%">
          <stop offset="0%" stopColor={C.fieldEdge} />
          <stop offset="100%" stopColor={C.field} />
        </radialGradient>
        {loupe && (
          <radialGradient id="loupe" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="rgba(255,255,255,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.45)" />
          </radialGradient>
        )}
      </defs>
      {/* bezel */}
      <rect x="1.5" y="1.5" width={W - 3} height={H - 3} rx="12" fill={C.slate2} stroke={C.line} strokeWidth="2" />
      {/* field */}
      <rect x={padL} y={padT} width={fw} height={fh} rx="3" fill="url(#cardfield)" stroke={C.fieldEdge} />
      <g>{grid}</g>
      {ruler}
      <g>{grainEls}</g>
      {loupe && <rect x={padL} y={padT} width={fw} height={fh} fill="url(#loupe)" pointerEvents="none" />}
      {measure}
      {/* labels */}
      <text x={padL} y={H - 8} fontSize="8.5" fill={C.textMute} fontFamily={MONO}>BCA crystal card</text>
      <text x={W - padR} y={H - 8} fontSize="8.5" fill={C.gridMaj} fontFamily={MONO} textAnchor="end">
        {style === "alu" ? "1 & 3 mm grid" : "2 mm grid"}
      </text>
    </svg>
  );
}

// ---- UI primitives (mirrors the slope trainer) ----------------------
function Eyebrow({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: "1.4px", textTransform: "uppercase", color: C.ice, fontWeight: 700 }}>{children}</div>;
}
const primaryBtn = { width: "100%", marginTop: 16, padding: "15px", borderRadius: 14, border: "none", background: C.ice, color: C.slate, fontWeight: 700, fontSize: 15, cursor: "pointer", letterSpacing: "0.2px" };
const ghostBtn = { ...primaryBtn, background: "transparent", color: C.textDim, border: `1.5px solid ${C.line}` };

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

function TrendTile({ label, v, warn }) {
  return (
    <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "7px 9px" }}>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: v == null ? C.textMute : warn ? C.warn : C.snow }}>{v == null ? "—" : v + "%"}</div>
      <div style={{ fontSize: 10, color: C.textDim, marginTop: 1 }}>{label}</div>
    </div>
  );
}
function DiffChips({ byDiff }) {
  if (!byDiff || byDiff.length < 2) return null;
  return (
    <div style={{ display: "flex", gap: 14, marginTop: 10, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 10.5, color: C.textMute, letterSpacing: "0.4px" }}>BY DIFFICULTY</span>
      {byDiff.map((d) => (
        <span key={d.k} style={{ fontSize: 12, color: C.textDim }}>
          {d.label}{" "}
          <b style={{ fontFamily: MONO, color: d.acc != null && d.acc < 60 ? C.warn : C.snow }}>{d.acc == null ? "—" : d.acc + "%"}</b>
        </span>
      ))}
    </div>
  );
}
function Sparkline({ sessions }) {
  const d = sessions.slice(-12);
  if (d.length < 2) return null;
  const W = 240, H = 44, pad = 4;
  const x = (i) => pad + (i / (d.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  const pts = d.map((s, i) => `${x(i)},${y(s.acc)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden="true">
      <line x1={pad} y1={y(50)} x2={W - pad} y2={y(50)} stroke={C.line} strokeWidth="1" strokeDasharray="3 3" />
      <polyline points={pts} fill="none" stroke={C.ice} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {d.map((s, i) => <circle key={i} cx={x(i)} cy={y(s.acc)} r={i === d.length - 1 ? 3.2 : 2} fill={i === d.length - 1 ? C.ice : C.textDim} />)}
    </svg>
  );
}

// ---- Cross-session tracking (recency + difficulty weighted) ---------
const EMPTY_HISTORY = { version: 1, nextSid: 1, attempts: [] };
async function loadHistory() { return await loadDoc("card", EMPTY_HISTORY); }
async function saveHistory(data) { await saveDoc("card", data); }
async function clearHistory() { await saveDoc("card", EMPTY_HISTORY); }

const HALFLIFE = 40;
const DIFF_LABEL = { easy: "Easy", moderate: "Moderate", hard: "Hard" };
const DIFF_WEIGHT = { easy: 0.6, moderate: 1.0, hard: 1.6 };

function computeTrends(attempts) {
  const total = attempts.length;
  if (!total) return { n: 0, sessions: [], byDiff: [] };
  const pct = (c, w) => (w > 0 ? Math.round((c / w) * 100) : null);
  let W = 0, Wc = 0, sizeW = 0, sizeWc = 0, typeW = 0, typeWc = 0;
  const perDiff = {};
  attempts.forEach((a, i) => {
    const age = total - 1 - i;
    const recency = Math.pow(0.5, age / HALFLIFE);
    const dk = a.diff || "moderate";
    const w = recency * (DIFF_WEIGHT[dk] || 1);
    W += w; if (a.correct) Wc += w;
    if (a.mode === "size") { sizeW += w; if (a.correct) sizeWc += w; }
    else { typeW += w; if (a.correct) typeWc += w; }
    const pd = (perDiff[dk] = perDiff[dk] || { c: 0, n: 0 });
    pd.n++; if (a.correct) pd.c++;
  });
  const bySid = new Map();
  for (const a of attempts) {
    const o = bySid.get(a.sid) || { sid: a.sid, c: 0, n: 0 };
    o.n++; if (a.correct) o.c++; bySid.set(a.sid, o);
  }
  const sessions = [...bySid.values()].sort((x, y) => x.sid - y.sid).map((o) => ({ sid: o.sid, acc: Math.round((o.c / o.n) * 100), n: o.n }));
  const byDiff = ["easy", "moderate", "hard"]
    .filter((k) => perDiff[k])
    .map((k) => ({ k, label: DIFF_LABEL[k], acc: perDiff[k].n ? Math.round((perDiff[k].c / perDiff[k].n) * 100) : null }));
  return { n: total, sessions, byDiff, acc: pct(Wc, W), size: pct(sizeWc, sizeW), type: pct(typeWc, typeW) };
}

// ---- End-of-session coaching ---------------------------------------
const TONE = { warn: C.warn, info: C.ice, good: C.good };
function buildInsights(answers) {
  const out = [];
  const misses = answers.filter((a) => !a.correct);
  if (!misses.length) {
    out.push({ tone: "good", title: "Clean sweep", body: "No misses. Push it: Hard difficulty widens the grain set to all seven types and tightens the size tolerance to ±0.4 mm." });
    return out;
  }
  // Size-mode bias — undersizing persistent grains is the dangerous error.
  const sizeA = answers.filter((a) => a.mode === "size");
  if (sizeA.length >= 3) {
    const errs = sizeA.map((a) => a.guess - a.size);
    const mean = errs.reduce((s, e) => s + e, 0) / errs.length;
    const persistUnder = sizeA.filter((a) => (GRAINS[a.code].persist === "high") && (a.guess - a.size) <= -0.5);
    if (mean <= -0.4) out.push({ tone: "warn", title: "You size low", body: `On average you called grains ${Math.abs(mean).toFixed(1)} mm smaller than they were. Undersizing hides depth hoar and surface hoar — the grains that matter most. Count grid squares before committing; each square is ${answers.some((a)=>a.style==="alu") ? "1 mm" : "2 mm"}.` });
    else if (mean >= 0.5) out.push({ tone: "info", title: "You size high", body: `You ran about ${mean.toFixed(1)} mm large on average. Less dangerous than undersizing, but it can over-flag weak layers. Anchor to the grid rather than eyeballing.` });
    if (persistUnder.length >= 2) out.push({ tone: "warn", title: "Persistent grains slipped past", body: `You undersized ${persistUnder.length} facet/depth-hoar/surface-hoar grains. Those are exactly the large, weak crystals a snowpit is looking for — size them generously, not conservatively.` });
  }
  // Type-mode confusions.
  const typeMiss = answers.filter((a) => a.mode === "type" && !a.correct);
  if (typeMiss.length) {
    const byGrain = {};
    for (const a of typeMiss) byGrain[a.code] = (byGrain[a.code] || 0) + 1;
    const worst = Object.entries(byGrain).sort((x, y) => y[1] - x[1])[0];
    if (worst) {
      const g = GRAINS[worst[0]];
      out.push({ tone: "info", title: `${g.label} is tripping you up`, body: `Missed ${worst[1]}× on ${g.label} (${g.sub}). ${g.teach}` });
    }
  }
  return out.slice(0, 3);
}

function GrainMissMap({ answers }) {
  const codes = [...new Set(answers.map((a) => a.code))].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const stat = {};
  for (const a of answers) { const s = (stat[a.code] = stat[a.code] || { n: 0, c: 0 }); s.n++; if (a.correct) s.c++; }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
      {codes.map((c) => {
        const s = stat[c], p = Math.round((s.c / s.n) * 100);
        const col = p >= 80 ? C.good : p >= 50 ? C.warn : C.bad;
        return (
          <div key={c} title={GRAINS[c].label} style={{ padding: "5px 9px", borderRadius: 9, border: `1px solid ${col}`,
            background: "rgba(255,255,255,0.03)", fontSize: 12, color: C.snow }}>
            {GRAINS[c].label} <b style={{ fontFamily: MONO, color: col }}>{p}%</b>
            <span style={{ color: C.textMute }}> · {s.c}/{s.n}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- Size answer control -------------------------------------------
function SizeInput({ value, onChange, disabled }) {
  const nudge = (d) => onChange(Math.min(12, Math.max(0.25, round4(value + d))));
  const btn = { width: 44, height: 44, borderRadius: 11, border: `1.5px solid ${C.line}`, background: C.panel, color: C.snow, fontSize: 20, cursor: disabled ? "default" : "pointer" };
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center", marginBottom: 8 }}>
        <button onClick={() => nudge(-0.25)} disabled={disabled} style={btn}>−</button>
        <div style={{ minWidth: 120, textAlign: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, color: C.ice, lineHeight: 1 }}>{value.toFixed(2)}</div>
          <div style={{ fontSize: 11, color: C.textDim }}>mm · average grain</div>
        </div>
        <button onClick={() => nudge(0.25)} disabled={disabled} style={btn}>+</button>
      </div>
      <input type="range" min={0.25} max={12} step={0.25} value={value} disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: C.ice, cursor: disabled ? "default" : "pointer" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: C.textMute, fontFamily: MONO, marginTop: 2 }}>
        <span>0.25</span><span>fine</span><span>coarse</span><span>12</span>
      </div>
    </div>
  );
}

const SIZE_CLASS = (mm) =>
  mm < 0.5 ? "very fine" : mm < 1 ? "fine" : mm < 2 ? "medium" : mm < 5 ? "coarse" : "very coarse";

// ---- Main app -------------------------------------------------------
const DEFAULTS = { record: true, difficulty: "moderate", mode: "mix", count: 10, feedback: "full", style: "poly", loupe: true };

export function CardApp({ onHome }) {
  const [phase, setPhase] = useState("setup"); // setup | play | summary
  const [settings, setSettings] = useState(DEFAULTS);
  const [history, setHistory] = useState(null);
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [sizeGuess, setSizeGuess] = useState(2);
  const [locked, setLocked] = useState(null); // {correct, ...} once submitted

  useEffect(() => { let ok = true; (async () => { const h = await loadHistory(); if (ok) setHistory(h); })(); return () => { ok = false; }; }, []);

  const trends = useMemo(() => (history ? computeTrends(history.attempts) : null), [history]);
  const on = useAcronyms();
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));

  const start = () => {
    const base = (Date.now() ^ (Math.random() * 1e9)) | 0;
    const qs = Array.from({ length: settings.count }, (_, i) => makeQuestion(settings, (base + i * 2654435761) | 0));
    setQueue(qs); setIdx(0); setAnswers([]); setLocked(null);
    setSizeGuess(2); setPhase("play");
  };

  const q = queue[idx];

  const submitSize = () => {
    if (locked) return;
    const tol = SIZE_TOL[settings.difficulty] || 0.6;
    const correct = Math.abs(sizeGuess - q.size) <= tol + 1e-9;
    setLocked({ correct, guess: sizeGuess });
  };
  const submitType = (code) => {
    if (locked) return;
    setLocked({ correct: code === q.code, pick: code });
  };

  const next = async () => {
    const rec = {
      sid: history ? history.nextSid : 1, ts: Date.now(),
      mode: q.mode, diff: settings.difficulty, code: q.code, size: q.size,
      correct: locked.correct, guess: q.mode === "size" ? locked.guess : null,
      pick: q.mode === "type" ? locked.pick : null, style: settings.style,
    };
    const nextAnswers = [...answers, rec];
    setAnswers(nextAnswers);
    if (idx + 1 < queue.length) {
      setIdx(idx + 1); setLocked(null); setSizeGuess(2);
    } else {
      if (settings.record) {
        const h = history || EMPTY_HISTORY;
        const stamped = nextAnswers.map((a) => ({ ...a, sid: h.nextSid }));
        const updated = { ...h, nextSid: h.nextSid + 1, attempts: [...h.attempts, ...stamped].slice(-1200) };
        setHistory(updated); saveHistory(updated);
      }
      setPhase("summary");
    }
  };

  const resetAll = async () => { await clearHistory(); setHistory(EMPTY_HISTORY); };

  const wrap = { minHeight: "calc(100vh - 44px)", background: C.slate, color: C.snow, fontFamily: FONT, padding: "22px 16px 48px", boxSizing: "border-box" };
  const inner = { maxWidth: 540, margin: "0 auto" };
  const panel = { background: C.slate2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 16 };

  // ---------- SETUP ----------
  if (phase === "setup") {
    return (
      <div style={wrap}><div style={inner}>
        <Eyebrow>{ax("BCA Crystal Card · field practice", on)}</Eyebrow>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>Read the card</h1>
        <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>
          Crystals are drawn to scale on the grid. Size them against the squares, or classify the grain type — then check yourself against ground truth.
        </p>

        {trends && trends.n > 0 ? (
          <div style={panel}>
            <div style={{ fontSize: 11, letterSpacing: "0.6px", textTransform: "uppercase", color: C.textDim }}>Your trend · recent + difficulty weighted</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
              <div>
                <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, lineHeight: 1, color: C.ice }}>{trends.acc == null ? "—" : trends.acc + "%"}</div>
                <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 3 }}>{trends.sessions.length} sessions · {trends.n} cards</div>
              </div>
              <div style={{ flex: 1 }}><Sparkline sessions={trends.sessions} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <TrendTile label="Sizing" v={trends.size} />
              <TrendTile label="Grain ID" v={trends.type} />
            </div>
            <DiffChips byDiff={trends.byDiff} />
          </div>
        ) : (
          <p style={{ color: C.textMute, fontSize: 12, margin: "-4px 0 18px" }}>No history yet — finish a set to start tracking. Recent sessions count most.</p>
        )}

        <div style={panel}>
          <Segmented label="Difficulty" hint={SIZE_TOL[settings.difficulty] + " mm tolerance"}
            value={settings.difficulty} onChange={(v) => set("difficulty", v)}
            options={[{ label: "Easy", value: "easy" }, { label: "Moderate", value: "moderate" }, { label: "Hard", value: "hard" }]} />
          <Segmented label="Mode" hint="what you practice"
            value={settings.mode} onChange={(v) => set("mode", v)}
            options={[{ label: "Size", value: "size" }, { label: "Grain type", value: "type" }, { label: "Mix", value: "mix" }]} />
          <Segmented label="Set length" value={settings.count} onChange={(v) => set("count", v)}
            options={[{ label: "5", value: 5 }, { label: "10", value: 10 }, { label: "15", value: 15 }, { label: "20", value: 20 }]} />
          <Segmented label="Feedback" hint={settings.feedback === "full" ? "explain each" : "score only"}
            value={settings.feedback} onChange={(v) => set("feedback", v)}
            options={[{ label: "Full", value: "full" }, { label: "Minimal", value: "minimal" }]} />
          <Segmented label="Card style" hint={settings.style === "alu" ? "1 & 3 mm grid" : "2 mm grid"}
            value={settings.style} onChange={(v) => set("style", v)}
            options={[{ label: "Polycarbonate", value: "poly" }, { label: "Aluminum", value: "alu" }]} />
          <Segmented label="Loupe vignette" value={settings.loupe} onChange={(v) => set("loupe", v)}
            options={[{ label: "On", value: true }, { label: "Off", value: false }]} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Record this session</span>
            <button onClick={() => set("record", !settings.record)}
              style={{ padding: "7px 14px", borderRadius: 9, border: `1px solid ${settings.record ? C.ice : C.line}`,
                background: settings.record ? "rgba(90,209,207,0.14)" : "transparent", color: settings.record ? C.ice : C.textDim, cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
              {settings.record ? "On" : "Off"}
            </button>
          </div>
          <div style={{ fontSize: 11.5, color: C.textMute, marginTop: 6, lineHeight: 1.4 }}>
            {settings.record ? "Counts toward your trend." : "Practice freely — this set won't affect your data."}
          </div>
        </div>

        <button style={primaryBtn} onClick={start}>Start set · {settings.count} cards</button>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {onHome && <button style={{ ...ghostBtn, marginTop: 0 }} onClick={onHome}>← All tools</button>}
          {trends && trends.n > 0 && <button style={{ ...ghostBtn, marginTop: 0 }} onClick={resetAll}>Reset history</button>}
        </div>
      </div></div>
    );
  }

  // ---------- PLAY ----------
  if (phase === "play" && q) {
    const revealed = !!locked;
    const g = GRAINS[q.code];
    return (
      <div style={wrap}><div style={inner}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: C.textDim, fontFamily: MONO }}>Card {idx + 1} / {queue.length}</span>
          <span style={{ fontSize: 12, color: C.textDim }}>{q.mode === "size" ? "Size the grain" : "Name the grain"}</span>
        </div>
        <div style={{ height: 4, background: C.slate2, borderRadius: 3, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ height: "100%", width: `${(idx / queue.length) * 100}%`, background: C.ice, transition: reduceMotion ? "none" : "width 200ms ease" }} />
        </div>

        <div style={{ ...panel, marginBottom: 14, padding: 10 }}>
          <CrystalCard q={q} style={settings.style} loupe={settings.loupe && !revealed} showMeasure={revealed && q.mode === "size"} />
        </div>

        {q.mode === "size" ? (
          <React.Fragment>
            {!revealed && <div style={{ fontSize: 13, color: C.textDim, textAlign: "center" }}>Count squares — each is <b style={{ color: C.snow }}>{settings.style === "alu" ? "1 mm" : "2 mm"}</b> across.</div>}
            <SizeInput value={sizeGuess} onChange={setSizeGuess} disabled={revealed} />
            {!revealed
              ? <button style={primaryBtn} onClick={submitSize}>Check</button>
              : null}
          </React.Fragment>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((code) => {
              const gg = GRAINS[code];
              let bg = C.panel, border = C.line, fg = C.snow;
              if (revealed && code === q.code) { bg = "rgba(63,163,114,0.18)"; border = C.good; }
              else if (revealed && locked.pick === code) { bg = "rgba(214,72,59,0.16)"; border = C.bad; }
              else if (revealed) { fg = C.textMute; }
              return (
                <button key={code} onClick={() => submitType(code)} disabled={revealed}
                  style={{ textAlign: "left", padding: "13px 14px", borderRadius: 12, background: bg, border: `1.5px solid ${border}`,
                    color: fg, cursor: revealed ? "default" : "pointer", transition: "all 130ms ease" }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{gg.label}</span>
                  <span style={{ fontSize: 12, color: C.textDim }}> · {gg.sub}</span>
                </button>
              );
            })}
          </div>
        )}

        {revealed && (
          <div style={{ marginTop: 14, background: C.slate2, border: `1px solid ${locked.correct ? C.good : C.bad}`, borderRadius: 14, padding: 14 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: locked.correct ? C.good : C.bad }}>{locked.correct ? "Correct" : "Miss"}</span>
              {q.mode === "size"
                ? <span style={{ fontSize: 13, color: C.textDim }}>Actual <b style={{ color: C.snow, fontFamily: MONO }}>{q.size.toFixed(2)} mm</b> ({SIZE_CLASS(q.size)}) · you said {locked.guess.toFixed(2)}</span>
                : <span style={{ fontSize: 13, color: C.textDim }}>It's <b style={{ color: C.snow }}>{g.label}</b> — {g.sub}</span>}
            </div>
            {settings.feedback === "full" && (
              <p style={{ fontSize: 12.5, color: C.textDim, lineHeight: 1.5, margin: "8px 0 0" }}>
                {ax(q.mode === "size"
                  ? `${g.label}: typically ${g.size[0]}–${g.size[1]} mm. ${g.teach}`
                  : g.teach, on)}
              </p>
            )}
            <button style={{ ...primaryBtn, marginTop: 12 }} onClick={next}>{idx + 1 < queue.length ? "Next card" : "See results"}</button>
          </div>
        )}
      </div></div>
    );
  }

  // ---------- SUMMARY ----------
  const correct = answers.filter((a) => a.correct).length;
  const pct = answers.length ? Math.round((correct / answers.length) * 100) : 0;
  const insights = buildInsights(answers);
  const postTrends = history ? computeTrends(history.attempts) : null;
  let trendNote = null;
  if (settings.record && postTrends && postTrends.n >= 8 && postTrends.acc != null) {
    const diff = pct - postTrends.acc;
    if (diff >= 8) trendNote = `This set (${pct}%) beat your recent-weighted average of ${postTrends.acc}% — trending up.`;
    else if (diff <= -8) trendNote = `This set (${pct}%) fell below your recent average of ${postTrends.acc}%. Could be a hard draw or fatigue — watch the next run.`;
    else trendNote = `Right around your recent-weighted average of ${postTrends.acc}%.`;
  }

  return (
    <div style={wrap}><div style={inner}>
      <Eyebrow>Set complete</Eyebrow>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "8px 0 4px" }}>
        <div style={{ fontFamily: MONO, fontSize: 46, fontWeight: 800, lineHeight: 1, color: pct >= 80 ? C.good : pct >= 50 ? C.warn : C.bad }}>{pct}%</div>
        <div style={{ fontSize: 14, color: C.textDim }}>{correct} / {answers.length} correct</div>
      </div>
      {!settings.record && <div style={{ fontSize: 12, color: C.textMute, marginBottom: 8 }}>Practice set — not recorded.</div>}

      <div style={{ ...panel, marginTop: 12 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.8px", textTransform: "uppercase", color: C.textDim, marginBottom: 4 }}>By grain type</div>
        <GrainMissMap answers={answers} />
      </div>

      {insights.map((ins, i) => (
        <div key={i} style={{ ...panel, borderLeft: `4px solid ${TONE[ins.tone]}` }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 4, color: TONE[ins.tone] }}>{ins.title}</div>
          <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.55, margin: 0 }}>{ins.body}</p>
        </div>
      ))}

      {trendNote && (
        <div style={{ ...panel }}>
          <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.55, margin: 0 }}>{trendNote}</p>
          {postTrends && postTrends.sessions.length > 1 && <div style={{ marginTop: 8 }}><Sparkline sessions={postTrends.sessions} /></div>}
        </div>
      )}

      <button style={primaryBtn} onClick={() => setPhase("setup")}>New set</button>
      {onHome && <button style={ghostBtn} onClick={onHome}>← All tools</button>}

      <p style={{ fontSize: 11, color: C.textMute, lineHeight: 1.5, marginTop: 18 }}>
        A study aid, not a substitute for a field course. Real crystals are messier than these drawings — pair the card with a loupe and a proper snowpit.
      </p>
    </div></div>
  );
}

export default CardApp;
