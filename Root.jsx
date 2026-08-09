import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Ast1App, Ast2App } from "./App.jsx";
import { SlopeApp } from "./SlopeApp.jsx";
import { CardApp } from "./CardApp.jsx";
import { DangerApp } from "./DangerApp.jsx";
import { Performance } from "./Performance.jsx";
import { SiteAnalytics } from "./SiteAnalytics.jsx";
import { AccountApp } from "./AccountApp.jsx";
import { ExpandToggle, ax, useAcronyms } from "./glossary.jsx";
import { useLang, LangToggle } from "./i18n.jsx";

const SUPER_ADMIN = "sean.olesen@gmail.com";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0",
  ice: "#7cc4ff", amber: "#f0812c", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function TopBar({ session, view, onHome, onAccount }) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const row = { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", padding: "10px 12px", background: T.bg,
    borderBottom: `1px solid ${T.line}`, fontFamily: FONT, fontSize: 12.5 };
  const chip = { padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.line}`,
    background: T.panel, color: T.snow };
  const btn = { ...chip, cursor: "pointer" };

  const back = view !== "home"
    ? <button onClick={onHome} style={{ ...btn, borderColor: T.ice, color: T.ice, fontWeight: 700 }}>{t("nav.allTools")}</button>
    : <span />;

  let auth;
  if (!supabase) {
    auth = <span style={{ ...chip, opacity: 0.7 }}>{t("auth.localMode")}</span>;
  } else if (session && session.user) {
    auth = (
      <React.Fragment>
        <button style={btn} onClick={onAccount} title="Account & privacy">{session.user.email}</button>
        <button style={btn} onClick={() => supabase.auth.signOut()}>{t("auth.signOut")}</button>
      </React.Fragment>
    );
  } else {
    const send = async () => {
      if (!email) { setStatus(t("auth.enterEmail")); return; }
      setStatus(t("auth.sending"));
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin },
      });
      setStatus(error ? (t("auth.errorPrefix") + error.message) : t("auth.checkEmail"));
    };
    auth = (
      <React.Fragment>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPlaceholder")}
          style={{ ...chip, minWidth: 150, outline: "none" }} />
        <button style={btn} onClick={send}>{t("auth.signIn")}</button>
        {status && <span style={{ color: T.dim }}>{status}</span>}
      </React.Fragment>
    );
  }

  return (
    <div style={row}>
      {back}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <LangToggle />
        <ExpandToggle />
        {auth}
      </div>
    </div>
  );
}

function Home({ onPick, session, isAdmin }) {
  const on = useAcronyms();
  const { t, lang } = useLang();
  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow,
    fontFamily: FONT, padding: "30px 16px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 540, margin: "0 auto" };
  const tile = (accent) => ({ display: "block", width: "100%", textAlign: "left", background: T.panel,
    border: `1px solid ${T.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 14,
    padding: "18px", marginTop: 14, color: T.snow, cursor: "pointer" });
  const h = { margin: "0 0 4px", fontSize: 17, fontWeight: 800 };
  const p = { margin: 0, fontSize: 13.5, color: T.dim, lineHeight: 1.5 };
  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>
          Avalanche Safety Training Prep
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 2px", letterSpacing: "-0.3px" }}>{t("home.choose")}</h1>
        <p style={{ ...p, margin: "0 0 4px" }}>
          {session && session.user
            ? t("home.signedIn", { email: session.user.email })
            : t("home.localSub")}
        </p>
        <button style={tile(T.amber)} onClick={() => onPick("slope")}>
          <div style={h}>{t("tool.slope.name")}</div>
          <p style={p}>{t("tool.slope.desc")}</p>
        </button>
        <button style={tile("#5AD1CF")} onClick={() => onPick("card")}>
          <div style={h}>{t("tool.card.name")}</div>
          <p style={p}>{t("tool.card.desc")}</p>
        </button>
        <button style={tile("#ef8b2b")} onClick={() => onPick("danger")}>
          <div style={h}>{t("tool.danger.name")}</div>
          <p style={p}>{t("tool.danger.desc")}</p>
        </button>
        <button style={tile(T.ice)} onClick={() => onPick("ast1")}>
          <div style={h}>{t("tool.ast1.name")}</div>
          <p style={p}>{t("tool.ast1.desc")}</p>
        </button>
        <button style={tile("#b98cff")} onClick={() => onPick("ast2")}>
          <div style={h}>{t("tool.ast2.name")}</div>
          <p style={p}>{lang === "en" ? ax(t("tool.ast2.desc"), on) : t("tool.ast2.desc")}</p>
        </button>
        {session && session.user && (
          <button style={tile("#3FA372")} onClick={() => onPick("perf")}>
            <div style={h}>{t("tool.perf.name")}</div>
            <p style={p}>{t("tool.perf.desc")}</p>
          </button>
        )}
        {isAdmin && (
          <button style={tile("#E0B93C")} onClick={() => onPick("admin")}>
            <div style={h}>{t("tool.admin.name")}</div>
            <p style={p}>{t("tool.admin.desc")}</p>
          </button>
        )}
        <button onClick={() => onPick("account")}
          style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none",
            color: T.dim, cursor: "pointer", fontSize: 13, padding: "20px 2px 0", textDecoration: "underline" }}>
          {t("account.title")}
        </button>
      </div>
    </div>
  );
}

export default function Root() {
  const [session, setSession] = useState(null);
  const on = useAcronyms();
  const { t, lang } = useLang();
  const [view, setView] = useState("home"); // home | ast1 | ast2 | slope | card | perf | admin | account
  const [isAdmin, setIsAdmin] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const email = session && session.user && session.user.email;
      if (!email) { if (alive) setIsAdmin(false); return; }
      if (email.toLowerCase() === SUPER_ADMIN.toLowerCase()) { if (alive) setIsAdmin(true); return; }
      if (!supabase) { if (alive) setIsAdmin(false); return; }
      try {
        const { data } = await supabase.from("profiles").select("is_admin").eq("id", session.user.id).maybeSingle();
        if (alive) setIsAdmin(!!(data && data.is_admin));
      } catch (e) { if (alive) setIsAdmin(false); }
    })();
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    try { if (!localStorage.getItem("avy_onboarded")) setShowIntro(true); } catch (e) {}
  }, []);

  const home = () => setView("home");

  return (
    <React.Fragment>
      {showIntro && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(6,10,15,0.72)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
          <div style={{ maxWidth: 440, width: "100%", background: T.panel, border: `1px solid ${T.line}`,
            borderRadius: 16, padding: "22px 20px", color: T.snow,
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
            <div style={{ fontSize: 12, letterSpacing: "1.4px", textTransform: "uppercase", color: T.dim }}>{t("intro.eyebrow")}</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "6px 0 10px" }}>{t("intro.title")}</h2>
            <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.55, margin: "0 0 10px" }}>
              {lang === "en" ? ax(t("intro.p1"), on) : t("intro.p1")}
            </p>
            <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.55, margin: "0 0 16px" }}>
              {t("intro.p2")}
            </p>
            <button onClick={() => { try { localStorage.setItem("avy_onboarded", "1"); } catch (e) {} setShowIntro(false); }}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer",
                background: T.ice, color: T.bg, fontSize: 15, fontWeight: 800 }}>
              {t("intro.ok")}
            </button>
          </div>
        </div>
      )}
      <TopBar session={session} view={view} onHome={home} onAccount={() => setView("account")} />
      {view === "home" && <Home onPick={setView} session={session} isAdmin={isAdmin} />}
      {view === "ast1" && <Ast1App onHome={home} />}
      {view === "ast2" && <Ast2App onHome={home} />}
      {view === "slope" && <SlopeApp onHome={home} />}
      {view === "card" && <CardApp onHome={home} />}
      {view === "danger" && <DangerApp onHome={home} />}
      {view === "perf" && <Performance onHome={home} session={session} />}
      {view === "admin" && isAdmin && <SiteAnalytics onHome={home} session={session} />}
      {view === "account" && <AccountApp onHome={home} session={session} onSignOut={() => { try { supabase && supabase.auth.signOut(); } catch (e) {} home(); }} />}
    </React.Fragment>
  );
}
