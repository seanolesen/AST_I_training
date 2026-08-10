import React, { useEffect, useRef, useState } from "react";
import { useLang } from "./i18n.jsx";
import { registerServiceWorker } from "./pwaRegister.js";

const T = { slate2: "#141c26", snow: "#e8eef4", dim: "#9fb0c0", ice: "#7cc4ff", amber: "#f0812c", line: "rgba(255,255,255,0.14)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

export function PwaStatus() {
  const { t } = useLang();
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine !== false : true);
  const updateRef = useRef(() => {});

  useEffect(() => {
    try {
      updateRef.current = registerServiceWorker({
        onNeedRefresh() { setNeedRefresh(true); },
        onOfflineReady() { setOfflineReady(true); setTimeout(() => setOfflineReady(false), 4000); },
      }) || (() => {});
    } catch (e) { /* service worker unavailable (dev or unsupported) */ }
    const goOn = () => setOnline(true), goOff = () => setOnline(false);
    window.addEventListener("online", goOn);
    window.addEventListener("offline", goOff);
    return () => { window.removeEventListener("online", goOn); window.removeEventListener("offline", goOff); };
  }, []);

  const bar = {
    position: "fixed", left: "50%", transform: "translateX(-50%)",
    bottom: "calc(16px + env(safe-area-inset-bottom, 0px))", zIndex: 9999,
    maxWidth: "calc(100vw - 28px)", display: "flex", alignItems: "center", gap: 12,
    background: T.slate2, border: `1px solid ${T.line}`, borderRadius: 12,
    padding: "10px 12px 10px 14px", boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
    fontFamily: FONT, color: T.snow, fontSize: 13.5, lineHeight: 1.35,
  };
  const dot = (c) => ({ width: 8, height: 8, borderRadius: "50%", background: c, flexShrink: 0 });

  if (needRefresh) {
    return (
      <div style={bar} role="status">
        <span style={dot(T.ice)} />
        <span>{t("pwa.update.msg")}</span>
        <button onClick={() => updateRef.current(true)}
          style={{ marginLeft: 4, padding: "7px 14px", borderRadius: 9, border: "none", cursor: "pointer",
            background: T.ice, color: "#0c1218", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
          {t("pwa.update.action")}
        </button>
      </div>
    );
  }
  if (!online) {
    return <div style={bar} role="status"><span style={dot(T.amber)} /><span>{t("pwa.offline")}</span></div>;
  }
  if (offlineReady) {
    return <div style={{ ...bar, color: T.dim }} role="status"><span style={dot(T.ice)} /><span>{t("pwa.offlineReady")}</span></div>;
  }
  return null;
}
