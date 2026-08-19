import React, { useState } from "react";
import { useLang } from "./i18n.jsx";

/*
 * Trip Planner (#16). A faithful Avaluator Trip Planner utility: choose today's
 * avalanche danger and the terrain (ATES class), and get the Avaluator's
 * recommendation — Normal caution / Extra caution / Not recommended — with the
 * standard guidance, the full colour matrix, and the auxiliary danger-rating
 * rule. A planning aid (not scored), so it doesn't feed the Performance board.
 *
 * Matrix verified against Avalanche Canada (Avaluator 2.0; Haegeli, Statham et al.).
 */

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

const DANGERS = [
  { key: "low", n: 1, color: "#53a551", text: "#0c1218" },
  { key: "moderate", n: 2, color: "#fff835", text: "#0c1218" },
  { key: "considerable", n: 3, color: "#ef8b2b", text: "#0c1218" },
  { key: "high", n: 4, color: "#ef2b2d", text: "#ffffff" },
  { key: "extreme", n: 5, color: "#231f20", text: "#ef2b2d" },
];
const TERRAINS = ["simple", "challenging", "complex"];

// Avaluator Trip Planner recommendation matrix (danger × terrain).
const MATRIX = {
  low: { simple: "normal", challenging: "normal", complex: "extra" },
  moderate: { simple: "normal", challenging: "normal", complex: "extra" },
  considerable: { simple: "normal", challenging: "extra", complex: "notrec" },
  high: { simple: "extra", challenging: "notrec", complex: "notrec" },
  extreme: { simple: "notrec", challenging: "notrec", complex: "notrec" },
};
const REC = {
  normal: { color: "#53a551", cell: "rgba(83,165,81,0.85)", cellText: "#0c1218" },
  extra: { color: "#e6a417", cell: "rgba(230,164,23,0.85)", cellText: "#0c1218" },
  notrec: { color: "#D6483B", cell: "rgba(214,72,59,0.9)", cellText: "#ffffff" },
};

function Eyebrow({ children }) {
  return <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: C.textDim }}>{children}</div>;
}

export function TripApp({ onHome }) {
  const { t } = useLang();
  const [terrain, setTerrain] = useState("simple");
  const [danger, setDanger] = useState("moderate");

  const rec = MATRIX[danger][terrain];
  const recC = REC[rec];

  const wrap = { minHeight: "calc(100vh - 44px)", background: C.slate, color: C.snow, fontFamily: FONT, padding: "22px 16px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 540, margin: "0 auto" };
  const panel = { background: C.slate2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 16 };
  const segRow = { display: "flex", gap: 6, flexWrap: "wrap" };

  return (
    <div style={wrap}><div style={inner}>
      {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: C.ice, cursor: "pointer", fontSize: 13, padding: "2px 0 10px", fontWeight: 700 }}>← {t("nav.allTools")}</button>}
      <Eyebrow>{t("trip.eyebrow")}</Eyebrow>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("trip.title")}</h1>
      <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("trip.intro")}</p>

      {/* selectors */}
      <div style={panel}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("trip.terrain.label")}</div>
        <div style={{ ...segRow, marginBottom: 16 }}>
          {TERRAINS.map((tk) => {
            const on = terrain === tk;
            return (
              <button key={tk} onClick={() => setTerrain(tk)}
                style={{ padding: "9px 14px", borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: 700,
                  border: `1px solid ${on ? C.ice : C.line}`, background: on ? "rgba(124,196,255,0.14)" : "transparent",
                  color: on ? C.ice : C.textDim }}>{t("trip.class." + tk)}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: C.textMute, lineHeight: 1.4, marginBottom: 16 }}>{t("trip.classDef." + terrain)}</div>

        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("trip.danger.label")}</div>
        <div style={segRow}>
          {DANGERS.map((d) => {
            const on = danger === d.key;
            return (
              <button key={d.key} onClick={() => setDanger(d.key)}
                style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700,
                  border: `1px solid ${on ? C.ice : C.line}`, background: on ? "rgba(124,196,255,0.14)" : "transparent", color: on ? C.snow : C.textDim }}>
                <span style={{ width: 18, height: 18, borderRadius: 4, background: d.color, color: d.text, fontSize: 11, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{d.n}</span>
                {t("trip.rating." + d.key)}
              </button>
            );
          })}
        </div>
      </div>

      {/* recommendation */}
      <div style={{ ...panel, borderColor: recC.color, borderWidth: 2 }}>
        <div style={{ fontSize: 11.5, letterSpacing: "1px", textTransform: "uppercase", color: C.textMute, marginBottom: 4 }}>{t("trip.result.label")}</div>
        <div className="trip-rec" style={{ fontSize: 22, fontWeight: 800, color: recC.color, marginBottom: 8 }}>{t("trip.rec." + rec)}</div>
        <p style={{ fontSize: 13, color: C.textDim, lineHeight: 1.55, margin: 0 }}>{t("trip.guide." + rec)}</p>
      </div>

      {/* matrix */}
      <div style={panel}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.textDim, marginBottom: 10 }}>{t("trip.matrix.title")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "84px 1fr 1fr 1fr", gap: 4 }}>
          <div />
          {TERRAINS.map((tk) => (
            <div key={tk} style={{ fontSize: 10.5, fontWeight: 700, textAlign: "center", color: C.textDim, paddingBottom: 2 }}>{t("trip.class." + tk)}</div>
          ))}
          {DANGERS.map((d) => (
            <React.Fragment key={d.key}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.textDim }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: d.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600 }}>{t("trip.rating." + d.key)}</span>
              </div>
              {TERRAINS.map((tk) => {
                const cr = MATRIX[d.key][tk];
                const sel = d.key === danger && tk === terrain;
                return (
                  <div key={tk} className={"trip-cell" + (sel ? " sel" : "")}
                    style={{ background: REC[cr].cell, color: REC[cr].cellText, borderRadius: 6, minHeight: 30,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, textAlign: "center", padding: "3px 2px",
                      outline: sel ? `2px solid ${C.snow}` : "none", outlineOffset: sel ? "1px" : 0, boxShadow: sel ? "0 0 0 1px rgba(0,0,0,0.4)" : "none" }}>
                    {t("trip.recShort." + cr)}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: 11, color: C.textMute, marginTop: 12, lineHeight: 1.5 }}>{t("trip.rule")}</div>
      </div>

      <div style={{ fontSize: 11, color: C.textMute, lineHeight: 1.5 }}>
        <span style={{ color: C.textDim, fontWeight: 700 }}>{t("trip.reference")}</span>{t("trip.ref")}
      </div>
      <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 10 }}>{t("trip.disclaimer")}</p>
    </div></div>
  );
}
