import React, { useEffect, useState } from "react";
import { useLang } from "./i18n.jsx";
import { LogoMark } from "./Logo.jsx";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0", ice: "#7cc4ff", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function isStandalone() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  } catch (e) { return false; }
}

// Shown only in a browser (never once installed): offers the native install
// prompt on Chromium, and Add-to-Home-Screen steps on iOS Safari.
export function InstallHint() {
  const { t } = useLang();
  const [deferred, setDeferred] = useState(null);
  const [ios, setIos] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed -> never show
    try { if (localStorage.getItem("astp_install_dismissed")) return; } catch (e) {}
    const ua = window.navigator.userAgent || "";
    const isiOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);

    if (window.__bipEvent) { setDeferred(window.__bipEvent); setShow(true); }
    const onBip = () => { if (window.__bipEvent) { setDeferred(window.__bipEvent); setShow(true); } };
    const onInstalled = () => { setShow(false); try { localStorage.setItem("astp_install_dismissed", "1"); } catch (e) {} };
    window.addEventListener("astp-bip", onBip);
    window.addEventListener("appinstalled", onInstalled);
    if (isiOS) { setIos(true); setShow(true); } // iOS has no prompt API -> show steps
    return () => { window.removeEventListener("astp-bip", onBip); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const dismiss = () => { setShow(false); try { localStorage.setItem("astp_install_dismissed", "1"); } catch (e) {} };
  const install = async () => {
    const ev = deferred || window.__bipEvent;
    if (!ev) { dismiss(); return; }
    try { ev.prompt(); await ev.userChoice; } catch (e) {}
    window.__bipEvent = null; dismiss();
  };

  if (!show) return null;
  const card = { display: "flex", alignItems: "center", gap: 12, background: T.panel, border: `1px solid ${T.line}`,
    borderLeft: `4px solid ${T.ice}`, borderRadius: 14, padding: "14px 14px 14px 16px", marginBottom: 16, fontFamily: FONT };
  const primary = { padding: "8px 14px", borderRadius: 9, border: "none", cursor: "pointer", background: T.ice, color: "#0c1218", fontWeight: 800, fontSize: 13, flexShrink: 0 };
  const ghost = { padding: "8px 10px", borderRadius: 9, border: `1px solid ${T.line}`, cursor: "pointer", background: "transparent", color: T.dim, fontWeight: 700, fontSize: 12.5, flexShrink: 0 };

  return (
    <div style={card}>
      <LogoMark size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14.5, fontWeight: 800, color: T.snow, margin: 0 }}>{t("install.title")}</p>
        <p style={{ fontSize: 12.5, color: T.dim, margin: "3px 0 0", lineHeight: 1.45 }}>{ios ? t("install.iosSteps") : t("install.blurb")}</p>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        {!ios && <button style={primary} onClick={install}>{t("install.button")}</button>}
        <button style={ghost} onClick={dismiss}>{ios ? t("install.gotIt") : t("install.dismiss")}</button>
      </div>
    </div>
  );
}
