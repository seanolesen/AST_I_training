import React from "react";

/* ------------------------------------------------------------------ *
 * Acronym glossary + global "expand acronyms" preference.
 * When expansion is on, the FIRST use of a known acronym in any block
 * of text gets its definition appended in parentheses — unless the
 * text already spells the definition out nearby.
 * The toggle lives in the top bar, so it is available on every page.
 * ------------------------------------------------------------------ */

// Definitions (key exactly as it appears in text -> plain-language meaning)
export const GLOSSARY = {
  "ALP TRUTh": "Avalanche, Loading, Path, Terrain trap, Rating, Unstable snow, Thaw — a red-flag checklist",
  "ATES": "Avalanche Terrain Exposure Scale",
  "CMAH": "Conceptual Model of Avalanche Hazard",
  "ECTP": "Extended Column Test — propagation",
  "ECTN": "Extended Column Test — no propagation",
  "ECT": "Extended Column Test",
  "CT": "Compression Test",
  "RB": "Rutschblock test",
  "PST": "Propagation Saw Test",
  "DT": "Deep Tap test",
  "AST": "Avalanche Skills Training",
  "MIN": "Mountain Information Network",
  "SPAW": "Special Public Avalanche Warning",
  "CAA": "Canadian Avalanche Association",
  "BCA": "Backcountry Access",
  "GPS": "Global Positioning System",
  // Grain types (international classification codes)
  "MFcr": "melt-freeze crust",
  "PP": "precipitation particles — new snow",
  "DF": "decomposing & fragmented precipitation particles",
  "RG": "rounded grains",
  "FC": "faceted crystals",
  "DH": "depth hoar",
  "SH": "surface hoar",
  "MF": "melt-freeze grains",
};

// Longest keys first so e.g. ECTP is matched before ECT, MFcr before MF.
const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pure transform: append "(definition)" after the first use of each acronym.
export function ax(text, on) {
  if (!on || typeof text !== "string" || !text) return text;
  let out = text;
  for (const key of KEYS) {
    const def = GLOSSARY[key];
    if (!def) continue;
    // Already spelled out in this block? leave it alone.
    if (out.toLowerCase().indexOf(def.toLowerCase()) !== -1) continue;
    // Match a standalone token: not preceded/followed by another letter.
    const re = new RegExp("(^|[^A-Za-z])(" + esc(key) + ")(?![A-Za-z])");
    out = out.replace(re, (m, pre, k) => pre + k + " (" + def + ")");
  }
  return out;
}

// ---- Global preference (localStorage + live cross-component sync) ----
const KEY = "avy:expandAcronyms";
const EVT = "avy:expandAcronyms";

export function getExpand() {
  try { return JSON.parse(localStorage.getItem(KEY)) === true; } catch { return false; }
}
export function setExpand(v) {
  try { localStorage.setItem(KEY, JSON.stringify(!!v)); } catch (e) { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: !!v })); } catch (e) { /* ignore */ }
}

// Subscribe so every mounted tool re-renders the moment the toggle flips.
export function useAcronyms() {
  const [on, setOn] = React.useState(getExpand());
  React.useEffect(() => {
    const h = () => setOn(getExpand());
    window.addEventListener(EVT, h);
    window.addEventListener("storage", h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener("storage", h); };
  }, []);
  return on;
}

// ---- The top-bar control -------------------------------------------
export function ExpandToggle({ compact = false }) {
  const on = useAcronyms();
  const base = {
    padding: "7px 11px", borderRadius: 9, cursor: "pointer",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 7,
    border: `1px solid ${on ? "#7cc4ff" : "rgba(255,255,255,0.12)"}`,
    background: on ? "rgba(124,196,255,0.14)" : "#141c26",
    color: on ? "#7cc4ff" : "#9fb0c0",
  };
  return (
    <button
      onClick={() => setExpand(!on)}
      title="Show the meaning of acronyms in parentheses throughout the app"
      aria-pressed={on}
      style={base}
    >
      <span style={{ fontWeight: 800, letterSpacing: "-0.5px" }}>Aa</span>
      {!compact && <span>Acronyms</span>}
      <span style={{ fontWeight: 700, color: on ? "#7cc4ff" : "#5E7789" }}>{on ? "On" : "Off"}</span>
    </button>
  );
}

export default { GLOSSARY, ax, useAcronyms, ExpandToggle, getExpand, setExpand };
