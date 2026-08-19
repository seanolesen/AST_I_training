import React, { useState, useEffect, useMemo, useRef } from "react";
import { loadDoc, saveDoc } from "./storage";
import { useLang } from "./i18n.jsx";

/*
 * Trip & Field Checklists (#18). A practical utility: curated best-practice
 * checklists (trip planning, pre-departure, in the field, debrief) the user
 * works through, checking items off and adding their own. A Trip name and an
 * Export-PDF action produce a printable trip sheet (via the device print dialog
 * -> Save as PDF). State persists to the "checklist" doc (Supabase when signed
 * in; localStorage otherwise). Not scored, so it doesn't feed Performance.
 */

const C = { slate: "#0f1720", slate2: "#141c26", panel: "#111823", snow: "#e8eef4",
  textDim: "#9fb0c0", textMute: "#6b7c8c", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)",
  good: "#3FA372", bad: "#D6483B", warn: "#F0812C" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

const LISTS = [
  { key: "plan", items: ["plan1", "plan2", "plan3", "plan4", "plan5", "plan6", "plan7", "plan8", "plan9", "plan10"] },
  { key: "predep", items: ["predep1", "predep2", "predep3", "predep4", "predep5", "predep6"] },
  { key: "field", items: ["field1", "field2", "field3", "field4", "field5", "field6", "field7", "field8"] },
  { key: "debrief", items: ["debrief1", "debrief2", "debrief3", "debrief4"] },
];
const EMPTY = { v: 1, tripName: "", checked: {}, custom: {} };

// Print-only styles: hide the app and show just the trip sheet when printing.
const PRINT_CSS = `
.chk-print-sheet { display: none; }
@media print {
  @page { margin: 14mm; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .chk-print-sheet, .chk-print-sheet * { visibility: visible !important; }
  .chk-print-sheet { display: block !important; position: absolute; left: 0; top: 0; width: 100%;
    color: #000; background: #fff; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  .cps-head { border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 14px; }
  .cps-title { font-size: 22px; font-weight: 800; }
  .cps-sub { font-size: 12px; color: #333; margin-top: 3px; }
  .cps-sec { margin-bottom: 14px; break-inside: avoid; }
  .cps-h2 { font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: .5px;
    border-bottom: 1px solid #999; padding-bottom: 3px; margin-bottom: 6px; }
  .cps-row { display: flex; gap: 8px; align-items: flex-start; padding: 3px 0; font-size: 12.5px; line-height: 1.35; }
  .cps-box { flex: 0 0 auto; width: 13px; height: 13px; border: 1.4px solid #000; display: inline-block;
    text-align: center; line-height: 12px; font-size: 11px; font-weight: 900; }
  .cps-foot { margin-top: 18px; padding-top: 8px; border-top: 1px solid #999; font-size: 10px; color: #444; }
}
`;

function Eyebrow({ children }) {
  return <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: C.textDim }}>{children}</div>;
}

export function ChecklistApp({ onHome }) {
  const { t } = useLang();
  const [doc, setDoc] = useState(null);
  const [active, setActive] = useState("plan");
  const [draft, setDraft] = useState("");
  const saveTimer = useRef(null);

  useEffect(() => { let alive = true; (async () => { const d = await loadDoc("checklist", EMPTY); if (alive) setDoc(d && d.checked ? { ...EMPTY, ...d } : { ...EMPTY }); })(); return () => { alive = false; }; }, []);

  // Inject print styles while this tool is mounted; remove on unmount so other
  // screens print normally.
  useEffect(() => {
    const el = document.createElement("style"); el.id = "chk-print-style"; el.textContent = PRINT_CSS;
    document.head.appendChild(el);
    return () => { try { document.head.removeChild(el); } catch (e) {} };
  }, []);

  const persist = (next) => { setDoc(next); saveDoc("checklist", next); };

  const onTripName = (v) => {
    setDoc((d) => {
      const next = { ...(d || EMPTY), tripName: v };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => saveDoc("checklist", next), 500);
      return next;
    });
  };

  const list = LISTS.find((l) => l.key === active);
  const customItems = (doc && doc.custom && doc.custom[active]) || [];

  const rows = useMemo(() => {
    const def = list.items.map((id) => ({ fullId: active + ":" + id, text: t("chk.item." + id), custom: false }));
    const cust = customItems.map((c) => ({ fullId: active + ":c:" + c.id, text: c.text, custom: true, cid: c.id }));
    return [...def, ...cust];
  }, [active, doc, t]);

  const done = doc ? rows.filter((r) => doc.checked[r.fullId]).length : 0;
  const total = rows.length;
  const complete = total > 0 && done === total;

  const toggle = (fullId) => {
    if (!doc) return;
    const checked = { ...doc.checked };
    if (checked[fullId]) delete checked[fullId]; else checked[fullId] = true;
    persist({ ...doc, checked });
  };
  const addItem = () => {
    const text = draft.trim(); if (!text || !doc) return;
    const cid = "c" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const custom = { ...doc.custom, [active]: [...customItems, { id: cid, text }] };
    persist({ ...doc, custom }); setDraft("");
  };
  const delItem = (cid) => {
    if (!doc) return;
    const custom = { ...doc.custom, [active]: customItems.filter((c) => c.id !== cid) };
    const checked = { ...doc.checked }; delete checked[active + ":c:" + cid];
    persist({ ...doc, custom, checked });
  };
  const resetList = () => {
    if (!doc) return;
    if (typeof window !== "undefined" && window.confirm && !window.confirm(t("chk.resetConfirm"))) return;
    const checked = { ...doc.checked };
    Object.keys(checked).forEach((k) => { if (k.indexOf(active + ":") === 0) delete checked[k]; });
    const custom = { ...doc.custom, [active]: [] };
    persist({ ...doc, checked, custom });
  };
  const exportPDF = () => { if (typeof window !== "undefined" && window.print) window.print(); };

  const wrap = { minHeight: "calc(100vh - 44px)", background: C.slate, color: C.snow, fontFamily: FONT, padding: "22px 16px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 540, margin: "0 auto" };
  const panel = { background: C.slate2, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginBottom: 16 };
  const tripName = (doc && doc.tripName) || "";

  return (
    <div style={wrap}><div style={inner}>
      {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: C.ice, cursor: "pointer", fontSize: 13, padding: "2px 0 10px", fontWeight: 700 }}>← {t("nav.allTools")}</button>}
      <Eyebrow>{t("chk.setup.eyebrow")}</Eyebrow>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 6px", letterSpacing: "-0.3px" }}>{t("chk.title")}</h1>
      <p style={{ fontSize: 13.5, color: C.textDim, lineHeight: 1.55, margin: "0 0 16px" }}>{t("chk.intro")}</p>

      {/* trip name + export */}
      <div style={{ ...panel, padding: 14 }}>
        <label style={{ fontSize: 12.5, fontWeight: 700, color: C.textDim, display: "block", marginBottom: 6 }}>{t("chk.tripName")}</label>
        <input value={tripName} onChange={(e) => onTripName(e.target.value)} placeholder={t("chk.tripPlaceholder")}
          style={{ width: "100%", padding: "11px 13px", borderRadius: 11, border: `1px solid ${C.line}`, background: C.panel, color: C.snow, fontSize: 14.5, fontFamily: FONT, boxSizing: "border-box", marginBottom: 10 }} />
        <button onClick={exportPDF}
          style={{ width: "100%", padding: "12px", borderRadius: 11, border: `1px solid ${C.ice}`, background: "rgba(124,196,255,0.12)", color: C.ice, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
          {t("chk.exportPdf")}
        </button>
        <div style={{ fontSize: 11, color: C.textMute, marginTop: 7, lineHeight: 1.45 }}>{t("chk.exportHint")}</div>
      </div>

      {/* list selector */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        {LISTS.map((l) => {
          const on = l.key === active;
          const lDone = doc ? [...l.items.map((id) => l.key + ":" + id), ...(((doc.custom || {})[l.key]) || []).map((c) => l.key + ":c:" + c.id)].filter((fid) => doc.checked[fid]).length : 0;
          const lTotal = l.items.length + (((doc && doc.custom && doc.custom[l.key]) || []).length);
          return (
            <button key={l.key} onClick={() => setActive(l.key)}
              style={{ padding: "8px 13px", borderRadius: 9, cursor: "pointer", fontSize: 13, fontWeight: 700,
                border: `1px solid ${on ? C.ice : C.line}`, background: on ? "rgba(124,196,255,0.14)" : "transparent",
                color: on ? C.ice : C.textDim }}>
              {t("chk.list." + l.key)} <span style={{ color: C.textMute, fontWeight: 600 }}>{lDone}/{lTotal}</span>
            </button>
          );
        })}
      </div>

      {/* progress */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: C.textDim, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, color: C.snow }}>{t("chk.list." + active)}</span>
          <span>{t("chk.progress", { done, total })}</span>
        </div>
        <div style={{ height: 8, background: C.panel, borderRadius: 6, overflow: "hidden", border: `1px solid ${C.line}` }}>
          <div style={{ width: (total ? (100 * done) / total : 0) + "%", height: "100%", background: complete ? C.good : C.ice, transition: "width .2s" }} />
        </div>
      </div>

      {complete && (
        <div style={{ ...panel, borderColor: C.good, padding: "12px 14px" }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: C.good }}>{t("chk.done.title")}</div>
          <p style={{ fontSize: 12.5, color: C.textDim, margin: "4px 0 0", lineHeight: 1.5 }}>{t("chk.done.body")}</p>
        </div>
      )}

      {/* items */}
      <div style={{ ...panel, padding: 6 }}>
        {rows.length === 0 && <div style={{ padding: 14, color: C.textMute, fontSize: 13 }}>{t("chk.empty")}</div>}
        {rows.map((r, i) => {
          const on = !!(doc && doc.checked[r.fullId]);
          return (
            <div key={r.fullId} style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 12px", borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <button onClick={() => toggle(r.fullId)} aria-label="toggle"
                style={{ flexShrink: 0, width: 22, height: 22, marginTop: 1, borderRadius: 6, cursor: "pointer",
                  border: `1.5px solid ${on ? C.good : C.line}`, background: on ? C.good : "transparent",
                  color: "#0c1218", fontWeight: 900, fontSize: 14, lineHeight: "20px", textAlign: "center", padding: 0 }}>
                {on ? "\u2713" : ""}
              </button>
              <div style={{ flex: 1, fontSize: 14, lineHeight: 1.45, color: on ? C.textMute : C.snow, textDecoration: on ? "line-through" : "none" }}>
                {r.text}
                {r.custom && <span style={{ marginLeft: 8, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.5px", color: C.textMute, border: `1px solid ${C.line}`, borderRadius: 5, padding: "1px 5px" }}>{t("chk.customBadge")}</span>}
              </div>
              {r.custom && (
                <button onClick={() => delItem(r.cid)} aria-label="delete"
                  style={{ flexShrink: 0, background: "transparent", border: "none", color: C.textMute, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>\u00d7</button>
              )}
            </div>
          );
        })}
      </div>

      {/* add + reset */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }}
          placeholder={t("chk.addPlaceholder")}
          style={{ flex: 1, padding: "11px 13px", borderRadius: 11, border: `1px solid ${C.line}`, background: C.panel, color: C.snow, fontSize: 14, fontFamily: FONT, boxSizing: "border-box" }} />
        <button onClick={addItem} style={{ padding: "11px 16px", borderRadius: 11, border: "none", background: C.ice, color: C.slate, fontWeight: 800, fontSize: 14, cursor: "pointer" }}>{t("chk.add")}</button>
      </div>
      <button onClick={resetList} style={{ background: "transparent", border: `1px solid ${C.line}`, color: C.textDim, borderRadius: 10, padding: "9px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>{t("chk.reset")}</button>

      <div style={{ fontSize: 11, color: C.textMute, marginTop: 16, lineHeight: 1.5 }}>
        <span style={{ color: C.textDim, fontWeight: 700 }}>{t("chk.reference")}</span>{t("chk.ref")}
      </div>
      <p style={{ color: C.textMute, fontSize: 11.5, lineHeight: 1.6, marginTop: 10 }}>{t("chk.footer")}</p>

      {/* printable trip sheet (hidden on screen; shown only when printing) */}
      <div className="chk-print-sheet">
        <div className="cps-head">
          <div className="cps-title">{(tripName.trim() || t("chk.pdf.untitled"))}</div>
          <div className="cps-sub">{t("chk.pdf.subtitle")} \u00b7 {new Date().toLocaleDateString()}</div>
        </div>
        {LISTS.map((l) => {
          const items = [
            ...l.items.map((id) => ({ text: t("chk.item." + id), on: !!(doc && doc.checked[l.key + ":" + id]) })),
            ...(((doc && doc.custom && doc.custom[l.key]) || []).map((c) => ({ text: c.text, on: !!(doc && doc.checked[l.key + ":c:" + c.id]) }))),
          ];
          return (
            <div className="cps-sec" key={l.key}>
              <div className="cps-h2">{t("chk.list." + l.key)}</div>
              {items.map((it, i) => (
                <div className="cps-row" key={i}><span className="cps-box">{it.on ? "\u2713" : ""}</span><span>{it.text}</span></div>
              ))}
            </div>
          );
        })}
        <div className="cps-foot">{t("chk.ref")} \u2014 {t("chk.pdf.app")}</div>
      </div>
    </div></div>
  );
}
