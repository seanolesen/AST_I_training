import React from "react";

// Six-arm crystal built from plain lines (no <defs>/<use>, so any number of
// LogoMarks can render without id collisions).
function crystal(cx, cy, s, color, sw) {
  const arms = [];
  for (let i = 0; i < 6; i++) {
    arms.push(
      <g key={i} transform={`rotate(${i * 60} ${cx} ${cy})`}>
        <line x1={cx} y1={cy} x2={cx} y2={cy - 120 * s} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <line x1={cx} y1={cy - 82 * s} x2={cx - 28 * s} y2={cy - 108 * s} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <line x1={cx} y1={cy - 82 * s} x2={cx + 28 * s} y2={cy - 108 * s} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      </g>
    );
  }
  return arms;
}

// The mountain-and-flake mark, transparent background so it composes on the
// app's slate surfaces. Edge-aligned geometry matches the app icon.
export function LogoMark({ size = 28, title = "AST Prep" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" role="img" aria-label={title}
      style={{ display: "block", flexShrink: 0 }}>
      <polygon points="512,436 766,800 258,800" fill="#25374a" />
      <polygon points="336,688 688,688 766,800 258,800" fill="#e8863a" />
      <polygon points="512,436 603,566 421,566" fill="#e8eef4" />
      <line x1="421" y1="566" x2="603" y2="566" stroke="#bcd0e2" strokeWidth="5" opacity="0.7" />
      {crystal(430, 742, 0.15, "#ffd89a", 4)}
      {crystal(566, 736, 0.13, "#ffd89a", 3.6)}
      {crystal(494, 776, 0.11, "#ffd89a", 3.2)}
      <path d="M258 800 L512 436 L766 800" fill="none" stroke="#7cc4ff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      {crystal(512, 300, 0.78, "#7cc4ff", 17)}
    </svg>
  );
}

// Standalone six-arm snowflake, for subtle brand motifs.
export function Snowflake({ size = 24, color = "#7cc4ff", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" aria-hidden="true" style={style}>
      {crystal(128, 128, 0.95, color, 11)}
    </svg>
  );
}
