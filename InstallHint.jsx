import React, { useEffect, useState } from "react";
import { useLang } from "./i18n.jsx";

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
  const bar = { display: "flex", alignItems: "center", gap: 8, margin: "0 0 12px", fontSize: 12.5,
    color: T.dim, fontFamily: FONT, lineHeight: 1.4 };
  const link = { background: "none", border: "none", padding: 0, cursor: "pointer", color: T.ice,
    fontWeight: 700, fontSize: 12.5, textDecoration: "underline", whiteSpace: "nowrap" };
  const x = { background: "none", border: "none", padding: "0 2px", cursor: "pointer", color: T.dim,
    fontSize: 17, lineHeight: 1, flexShrink: 0 };

  return (
    <div style={bar}>
      <span style={{ flex: 1, minWidth: 0 }}>
        {ios ? t("install.iosLine") : t("install.line")}
        {!ios && <> <button style={link} onClick={install}>{t("install.button")}</button></>}
      </span>
      <button style={x} onClick={dismiss} aria-label={t("install.dismiss")} title={t("install.dismiss")}>&times;</button>
    </div>
  );
}
