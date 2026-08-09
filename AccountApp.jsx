import React, { useState, useEffect } from "react";
import { exportAllData, deleteAllData } from "./storage";
import { getMyLeaderboard, upsertMyLeaderboard, deleteMyLeaderboard } from "./leaderboard.js";
import { useLang } from "./i18n.jsx";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0",
  ice: "#7cc4ff", amber: "#f0812c", good: "#3FA372", bad: "#D6483B",
  line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function Card({ children, accent }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`,
      borderLeft: `4px solid ${accent || T.line}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
      {children}
    </div>
  );
}
function Eyebrow({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: "0.9px", textTransform: "uppercase", color: T.dim, marginBottom: 8 }}>{children}</div>;
}

export function AccountApp({ onHome, session, onSignOut }) {
  const { t } = useLang();
  const signedIn = !!(session && session.user);
  const email = signedIn ? session.user.email : null;

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [lbName, setLbName] = useState("");
  const [lbOptIn, setLbOptIn] = useState(false);
  const [lbBusy, setLbBusy] = useState(false);
  const [lbNote, setLbNote] = useState("");

  useEffect(() => {
    let alive = true;
    if (!signedIn) return;
    (async () => { const row = await getMyLeaderboard(); if (alive && row) { setLbName(row.display_name || ""); setLbOptIn(true); } })();
    return () => { alive = false; };
  }, [signedIn]);

  const saveLb = async () => {
    setLbBusy(true); setLbNote("");
    try {
      if (lbOptIn) {
        if (!lbName.trim()) { setLbNote(t("account.lb.needName")); setLbBusy(false); return; }
        const res = await upsertMyLeaderboard(lbName.trim());
        setLbNote(res.ok ? t("account.lb.saved") : t("account.lb.error", { error: res.error }));
      } else {
        const res = await deleteMyLeaderboard();
        setLbNote(res.ok ? t("account.lb.removed") : t("account.lb.error", { error: res.error }));
      }
    } catch (e) { setLbNote(t("account.lb.error", { error: e && e.message ? e.message : String(e) })); }
    setLbBusy(false);
  };

  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow,
    fontFamily: FONT, padding: "22px 14px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 560, margin: "0 auto" };
  const btn = (bg, fg) => ({ width: "100%", padding: "13px", borderRadius: 12, border: "none",
    cursor: busy ? "default" : "pointer", background: bg, color: fg, fontSize: 14.5, fontWeight: 800,
    opacity: busy ? 0.6 : 1 });
  const ghost = { width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer",
    background: "transparent", border: `1px solid ${T.line}`, color: T.snow, fontSize: 14, fontWeight: 700 };

  const doExport = async () => {
    setBusy(true); setNote("");
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url; a.download = `avalanche-training-data-${stamp}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      const n = Array.isArray(data.runs) ? data.runs.length : 0;
      setNote(t(n === 1 ? "account.exportedOne" : "account.exportedMany", { n }));
    } catch (e) {
      setNote(t("account.exportFail", { msg: e && e.message ? e.message : String(e) }));
    }
    setBusy(false);
  };

  const doDelete = async () => {
    setBusy(true); setNote("");
    try {
      const res = await deleteAllData();
      if (res.ok) { setDone(true); setNote(t("account.deletedMsg")); }
      else setNote(t("account.deletePartial", { error: res.error }));
    } catch (e) {
      setNote(t("account.deleteFail", { msg: e && e.message ? e.message : String(e) }));
    }
    setConfirming(false); setBusy(false);
  };

  return (
    <div style={wrap}>
      <div style={inner}>
        {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: T.dim,
          cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 600 }}>{t("nav.allTools")}</button>}
        <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>{t("account.title")}</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 16px" }}>{t("account.h1")}</h1>

        {/* Account */}
        <Card accent={T.ice}>
          <Eyebrow>{t("account.accountLabel")}</Eyebrow>
          {signedIn ? (
            <div>
              <div style={{ fontSize: 14, color: T.snow }}>{t("account.signedInAs", { email })}</div>
              <div style={{ fontSize: 12.5, color: T.dim, margin: "6px 0 12px", lineHeight: 1.5 }}>
                {t("account.syncNote")}
              </div>
              {onSignOut && <button style={ghost} onClick={onSignOut}>{t("auth.signOut")}</button>}
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.5 }}>{t("account.guest")}</div>
          )}
        </Card>

        {/* Leaderboard */}
        {signedIn && (
          <Card accent="#f2c14e">
            <Eyebrow>{t("account.lb.label")}</Eyebrow>
            <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, marginBottom: 12 }}>{t("account.lb.desc")}</div>
            <input value={lbName} onChange={(e) => setLbName(e.target.value)} placeholder={t("account.lb.namePlaceholder")} maxLength={40}
              style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 10, background: T.bg,
                border: `1px solid ${T.line}`, color: T.snow, fontSize: 14, marginBottom: 10 }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 13.5, color: T.snow }}>{t("account.lb.optIn")}</span>
              <button onClick={() => setLbOptIn((v) => !v)}
                style={{ padding: "7px 14px", borderRadius: 9, cursor: "pointer", fontWeight: 700, fontSize: 13,
                  border: `1px solid ${lbOptIn ? T.ice : T.line}`, background: lbOptIn ? "rgba(124,196,255,0.14)" : "transparent",
                  color: lbOptIn ? T.ice : T.dim }}>{lbOptIn ? t("account.lb.on") : t("account.lb.off")}</button>
            </div>
            <button style={btn(T.ice, "#0c1218")} disabled={lbBusy} onClick={saveLb}>{t("account.lb.save")}</button>
            {lbNote && <div style={{ fontSize: 12.5, color: T.dim, marginTop: 10 }}>{lbNote}</div>}
          </Card>
        )}

        {/* What we store */}
        <Card>
          <Eyebrow>{t("account.storedLabel")}</Eyebrow>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.6 }}>
            {signedIn ? t("account.storedSignedIn") : t("account.storedGuest")}
            <br /><br />
            {t("account.storedFooter")}
          </div>
        </Card>

        {/* Export */}
        <Card accent={T.good}>
          <Eyebrow>{t("account.exportLabel")}</Eyebrow>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, marginBottom: 12 }}>{t("account.exportDesc")}</div>
          <button style={btn(T.good, "#0c1218")} disabled={busy} onClick={doExport}>{t("account.exportBtn")}</button>
        </Card>

        {/* Delete */}
        <Card accent={T.bad}>
          <Eyebrow>{t("account.deleteLabel")}</Eyebrow>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, marginBottom: 12 }}>
            {signedIn ? t("account.deleteDescSignedIn") : t("account.deleteDescGuest")}
            {signedIn && <span> {t("account.deleteEmailNote")}</span>}
          </div>
          {done ? (
            <div style={{ fontSize: 13.5, color: T.good, fontWeight: 700 }}>{t("account.deletedDone")}</div>
          ) : !confirming ? (
            <button style={btn("transparent", T.bad)} onClick={() => { setNote(""); setConfirming(true); }}>
              {t("account.deleteBtn")}
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: T.snow, lineHeight: 1.5, marginBottom: 10,
                padding: "10px 12px", background: "rgba(214,72,59,0.12)", border: `1px solid ${T.bad}`, borderRadius: 10 }}>
                {t("account.confirmWarn")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...btn(T.bad, "#fff"), flex: 1 }} disabled={busy} onClick={doDelete}>{t("account.confirmYes")}</button>
                <button style={{ ...ghost, flex: 1 }} disabled={busy} onClick={() => setConfirming(false)}>{t("common.cancel")}</button>
              </div>
            </div>
          )}
        </Card>

        {note && <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginTop: 2 }}>{note}</div>}
      </div>
    </div>
  );
}
