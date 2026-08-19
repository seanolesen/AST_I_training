import React, { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "./supabaseClient";
import { PwaStatus } from "./PwaStatus.jsx";
import { LogoMark, Snowflake } from "./Logo.jsx";
import { InstallHint } from "./InstallHint.jsx";
import { ExpandToggle, ax, useAcronyms } from "./glossary.jsx";
import { useLang, LangToggle } from "./i18n.jsx";

// Code-split each tool so only the shell + Home load up front; each tool
// (and the large question banks) load on demand the first time it's opened.
const Ast1App = lazy(() => import("./App.jsx").then((m) => ({ default: m.Ast1App })));
const Ast2App = lazy(() => import("./App.jsx").then((m) => ({ default: m.Ast2App })));
const SlopeApp = lazy(() => import("./SlopeApp.jsx").then((m) => ({ default: m.SlopeApp })));
const CardApp = lazy(() => import("./CardApp.jsx").then((m) => ({ default: m.CardApp })));
const SnowTestApp = lazy(() => import("./SnowTestApp.jsx").then((m) => ({ default: m.SnowTestApp })));
const DangerApp = lazy(() => import("./DangerApp.jsx").then((m) => ({ default: m.DangerApp })));
const BulletinApp = lazy(() => import("./BulletinApp.jsx").then((m) => ({ default: m.BulletinApp })));
const TerrainApp = lazy(() => import("./TerrainApp.jsx").then((m) => ({ default: m.TerrainApp })));
const AtesApp = lazy(() => import("./AtesApp.jsx").then((m) => ({ default: m.AtesApp })));
const BeaconApp = lazy(() => import("./BeaconApp.jsx").then((m) => ({ default: m.BeaconApp })));
const ChecklistApp = lazy(() => import("./ChecklistApp.jsx").then((m) => ({ default: m.ChecklistApp })));
const Performance = lazy(() => import("./Performance.jsx").then((m) => ({ default: m.Performance })));
const Leaderboard = lazy(() => import("./Leaderboard.jsx").then((m) => ({ default: m.Leaderboard })));
const SiteAnalytics = lazy(() => import("./SiteAnalytics.jsx").then((m) => ({ default: m.SiteAnalytics })));
const AccountApp = lazy(() => import("./AccountApp.jsx").then((m) => ({ default: m.AccountApp })));

const SUPER_ADMIN = "sean.olesen@gmail.com";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0",
  ice: "#7cc4ff", amber: "#f0812c", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const BUILD = (typeof __BUILD__ !== "undefined") ? __BUILD__ : "dev";

function ToolFallback() {
  return (
    <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <Snowflake size={44} color={T.ice} style={{ opacity: 0.45 }} />
    </div>
  );
}
try { console.log("AST Prep build:", BUILD); } catch (e) {}

function Tile({ accent, name, desc, onClick }) {
  const s = { position: "relative", overflow: "hidden", display: "block", width: "100%", textAlign: "left",
    background: T.panel, border: `1px solid ${T.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 14,
    padding: "17px 40px 17px 18px", marginTop: 12, color: T.snow, cursor: "pointer", fontFamily: FONT };
  return (
    <button style={s} onClick={onClick}>
      <Snowflake size={82} color={accent} style={{ position: "absolute", top: -20, right: -16, opacity: 0.07, pointerEvents: "none" }} />
      <div style={{ position: "relative", margin: "0 0 4px", fontSize: 17, fontWeight: 800 }}>{name}</div>
      <p style={{ position: "relative", margin: 0, fontSize: 13.5, color: T.dim, lineHeight: 1.5 }}>{desc}</p>
      <span style={{ position: "absolute", right: 15, top: "50%", transform: "translateY(-50%)", color: T.dim, opacity: 0.5, fontSize: 18, lineHeight: 1 }}>&rarr;</span>
    </button>
  );
}

function TopBar({ session, view, onHome, onAccount }) {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("link"); // link | password | signup
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const row = { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", padding: "calc(10px + env(safe-area-inset-top)) 12px 10px", background: T.bg,
    borderBottom: `1px solid ${T.line}`, fontFamily: FONT, fontSize: 12.5,
    position: "sticky", top: 0, zIndex: 50 };
  const chip = { padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.line}`,
    background: T.panel, color: T.snow };
  const btn = { ...chip, cursor: "pointer" };

  const back = view !== "home"
    ? <button onClick={onHome} style={{ ...btn, border: `1px solid ${T.ice}`, color: T.ice, fontWeight: 700 }}>{t("nav.allTools")}</button>
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
    const sendLink = async () => {
      if (!email) { setStatus(t("auth.enterEmail")); return; }
      setBusy(true); setStatus(t("auth.sending"));
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin, shouldCreateUser: false },
      });
      setBusy(false);
      setStatus(error ? (t("auth.errorPrefix") + error.message) : t("auth.linkSent"));
    };
    const signInPw = async () => {
      if (!email || !password) { setStatus(t("auth.enterBoth")); return; }
      setBusy(true); setStatus(t("auth.signingIn"));
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { setStatus(t("auth.signInFailed")); }
      else { setPassword(""); setStatus(""); } // onAuthStateChange sets the session
    };
    const createAccount = async () => {
      if (!email || !password) { setStatus(t("auth.enterBoth")); return; }
      if (password.length < 6) { setStatus(t("auth.passwordShort")); return; }
      if (!code.trim()) { setStatus(t("auth.needCode")); return; }
      setBusy(true); setStatus(t("auth.creating"));
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { join_code: code.trim().toUpperCase() } },
      });
      setBusy(false);
      if (error) {
        const m = error.message || "";
        if (/already|registered/i.test(m)) setStatus(t("auth.exists"));
        else if (/code|active|sign up|create an account/i.test(m)) setStatus(m); // server-side gate message
        else setStatus(t("auth.errorPrefix") + m);
      } else if (data && data.session) { setPassword(""); setCode(""); setStatus(""); }
      else { setStatus(t("auth.confirmSent")); }
    };
    const iceBtn = { ...btn, border: `1px solid ${T.ice}`, color: T.ice, fontWeight: 700 };
    const emailInput = (
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPlaceholder")}
        type="email" autoComplete="email" inputMode="email" style={{ ...chip, minWidth: 140, outline: "none" }} />
    );
    const pwInput = (
      <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("auth.passwordPlaceholder")}
        type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} style={{ ...chip, minWidth: 120, outline: "none" }} />
    );
    if (mode === "signup") {
      auth = (
        <React.Fragment>
          {emailInput}{pwInput}
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder={t("auth.codePlaceholder")}
            autoCapitalize="characters" autoComplete="off"
            style={{ ...chip, minWidth: 120, outline: "none", textTransform: "uppercase", letterSpacing: "0.5px" }} />
          <button style={iceBtn} disabled={busy} onClick={createAccount}>{t("auth.createAccount")}</button>
          <button style={btn} onClick={() => { setMode("password"); setStatus(""); }}>{t("auth.backToSignIn")}</button>
          {status && <span style={{ color: T.dim }}>{status}</span>}
        </React.Fragment>
      );
    } else if (mode === "link") {
      auth = (
        <React.Fragment>
          {emailInput}
          <button style={btn} disabled={busy} onClick={sendLink}>{t("auth.linkBtn")}</button>
          <button style={iceBtn} onClick={() => { setMode("password"); setStatus(""); }}>{t("auth.usePassword")}</button>
          <button style={iceBtn} onClick={() => { setMode("signup"); setStatus(""); }}>{t("auth.createAccount")}</button>
          {status && <span style={{ color: T.dim }}>{status}</span>}
        </React.Fragment>
      );
    } else {
      auth = (
        <React.Fragment>
          {emailInput}{pwInput}
          <button style={btn} disabled={busy} onClick={signInPw}>{t("auth.signIn")}</button>
          <button style={iceBtn} onClick={() => { setMode("signup"); setStatus(""); }}>{t("auth.createAccount")}</button>
          <button style={btn} onClick={() => { setMode("link"); setStatus(""); }}>{t("auth.useLink")}</button>
          {status && <span style={{ color: T.dim }}>{status}</span>}
        </React.Fragment>
      );
    }
  }

  return (
    <div style={row}>
      <button onClick={onHome} title="Home" style={{ display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left", minWidth: 0 }}>
        <LogoMark size={30} />
        <div style={{ lineHeight: 1.06, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.snow, letterSpacing: "-0.3px" }}>AST Prep</div>
          <div style={{ fontSize: 10.5, color: T.dim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t("app.tagline")}</div>
        </div>
      </button>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {back}
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
  const signedIn = !!(session && session.user);
  const tiles = [
    { key: "slope", accent: T.amber },
    { key: "card", accent: "#5AD1CF" },
    { key: "snowtest", accent: "#8bd0c0" },
    { key: "danger", accent: "#ef8b2b" },
    { key: "bulletin", accent: "#7aa2c2" },
    { key: "terrain", accent: "#A6754C" },
    { key: "ates", accent: "#7fae6b" },
    { key: "beacon", accent: "#3fb6c9" },
    { key: "checklist", accent: "#c2a35a" },
    { key: "ast1", accent: T.ice },
    { key: "ast2", accent: "#b98cff" },
    ...(signedIn ? [{ key: "perf", accent: "#3FA372" }, { key: "leaderboard", accent: "#f2c14e" }] : []),
    ...(isAdmin ? [{ key: "admin", accent: "#E0B93C" }] : []),
  ];
  const p = { margin: 0, fontSize: 13.5, color: T.dim, lineHeight: 1.5 };
  return (
    <div style={wrap}>
      <div style={inner}>
        <InstallHint />
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 2px", letterSpacing: "-0.3px" }}>{t("home.choose")}</h1>
        <p style={{ ...p, margin: "0 0 4px" }}>
          {session && session.user
            ? t("home.signedIn", { email: session.user.email })
            : t("home.localSub")}
        </p>
        {tiles.map((tl) => (
          <Tile key={tl.key} accent={tl.accent} onClick={() => onPick(tl.key)}
            name={t("tool." + tl.key + ".name")}
            desc={tl.key === "ast2" && lang === "en" ? ax(t("tool.ast2.desc"), on) : t("tool." + tl.key + ".desc")} />
        ))}
        <button onClick={() => onPick("account")}
          style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none",
            color: T.dim, cursor: "pointer", fontSize: 13, padding: "20px 2px 0", textDecoration: "underline" }}>
          {t("account.title")}
        </button>
        <div style={{ marginTop: 20, fontSize: 10.5, color: T.dim, opacity: 0.55, textAlign: "center", letterSpacing: "0.3px" }}>build {BUILD}</div>
      </div>
    </div>
  );
}

function ExpiredScreen({ until, onSignOut }) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null); // "data" | "account"
  const [msg, setMsg] = useState("");
  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow, fontFamily: FONT, padding: "40px 16px", boxSizing: "border-box" };
  const card = { maxWidth: 460, margin: "0 auto", background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 22 };
  const bBtn = (extra) => ({ padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.line}`, background: "transparent", color: T.snow, cursor: "pointer", fontFamily: FONT, fontSize: 13.5, width: "100%", ...extra });
  const delData = async () => { setBusy(true); try { await supabase.rpc("delete_my_data"); setMsg(t("expired.dataDeleted")); } catch (e) {} setBusy(false); setConfirm(null); };
  const delAccount = async () => { setBusy(true); try { await supabase.rpc("delete_my_account"); } catch (e) {} try { await supabase.auth.signOut(); } catch (e) {} };
  const danger = { border: "1px solid #D6483B", color: "#ff8a80", fontWeight: 700 };
  return (
    <div style={wrap}><div style={card}>
      <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 10px" }}>{t("expired.title")}</h1>
      <p style={{ fontSize: 14, color: T.dim, lineHeight: 1.55, margin: "0 0 8px" }}>{t("expired.sub")}</p>
      <p style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, margin: "0 0 18px" }}>{t("expired.contact")}</p>
      {msg && <p style={{ fontSize: 13, color: "#3FA372", margin: "0 0 14px" }}>{msg}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button style={bBtn({ border: `1px solid ${T.ice}`, color: T.ice, fontWeight: 700 })} onClick={onSignOut}>{t("auth.signOut")}</button>
        {confirm === "data" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={bBtn({ ...danger })} disabled={busy} onClick={delData}>{t("expired.confirmDelete")}</button>
            <button style={bBtn({})} onClick={() => setConfirm(null)}>{t("common.cancel")}</button>
          </div>
        ) : (
          <button style={bBtn({})} onClick={() => { setConfirm("data"); setMsg(""); }}>{t("expired.deleteData")}</button>
        )}
        {confirm === "account" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={bBtn({ ...danger })} disabled={busy} onClick={delAccount}>{t("expired.confirmDelete")}</button>
            <button style={bBtn({})} onClick={() => setConfirm(null)}>{t("common.cancel")}</button>
          </div>
        ) : (
          <button style={bBtn({})} onClick={() => { setConfirm("account"); setMsg(""); }}>{t("expired.deleteAccount")}</button>
        )}
      </div>
    </div></div>
  );
}

function LoginRequired() {
  const { t } = useLang();
  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow, fontFamily: FONT, padding: "44px 16px", boxSizing: "border-box" };
  const card = { maxWidth: 440, margin: "0 auto", background: T.panel, border: `1px solid ${T.line}`, borderRadius: 16, padding: 24, textAlign: "center" };
  return (
    <div style={wrap}><div style={card}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><Snowflake size={38} color={T.ice} style={{ opacity: 0.5 }} /></div>
      <h1 style={{ fontSize: 21, fontWeight: 800, margin: "0 0 10px" }}>{t("login.title")}</h1>
      <p style={{ fontSize: 14, color: T.dim, lineHeight: 1.55, margin: "0 0 8px" }}>{t("login.sub")}</p>
      <p style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, margin: 0 }}>{t("login.hint")}</p>
    </div></div>
  );
}

export default function Root() {
  const [session, setSession] = useState(null);
  const on = useAcronyms();
  const { t, lang } = useLang();
  const [view, setView] = useState("home"); // home | ast1 | ast2 | slope | card | perf | admin | account
  const [isAdmin, setIsAdmin] = useState(false);
  const [access, setAccess] = useState({ active: true, until: null, loaded: false });
  const [requireLogin, setRequireLogin] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);

  useEffect(() => {
    if (!supabase) { setSettingsLoaded(true); return; }
    let alive = true;
    (async () => {
      try { const { data } = await supabase.rpc("require_login"); if (alive) setRequireLogin(!!data); }
      catch (e) {}
      finally { if (alive) setSettingsLoaded(true); }
    })();
    return () => { alive = false; };
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
    let alive = true;
    (async () => {
      if (!supabase || !(session && session.user)) { if (alive) setAccess({ active: true, until: null, loaded: false }); return; }
      try {
        const [a, u] = await Promise.all([supabase.rpc("am_i_active"), supabase.rpc("my_access")]);
        if (alive) setAccess({ active: (a && a.error) ? true : !!(a && a.data), until: (u && u.error) ? null : (u && u.data), loaded: true });
      } catch (e) { if (alive) setAccess({ active: true, until: null, loaded: true }); }
    })();
    return () => { alive = false; };
  }, [session]);

  useEffect(() => {
    try { if (!localStorage.getItem("avy_onboarded")) setShowIntro(true); } catch (e) {}
  }, []);

  const home = () => setView("home");
  const signedInNow = !!(session && session.user);
  const blocked = signedInNow && !isAdmin && access.loaded && !access.active;
  const needLogin = !signedInNow && requireLogin;
  const gatingUnknown = !signedInNow && !settingsLoaded;

  return (
    <React.Fragment>
      {showIntro && !needLogin && !gatingUnknown && (
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
      {needLogin ? (
        <LoginRequired />
      ) : gatingUnknown ? (
        <ToolFallback />
      ) : blocked ? (
        <ExpiredScreen until={access.until} onSignOut={() => { try { supabase && supabase.auth.signOut(); } catch (e) {} }} />
      ) : (
        <React.Fragment>
          {view === "home" && <Home onPick={setView} session={session} isAdmin={isAdmin} />}
          <Suspense fallback={<ToolFallback />}>
            {view === "ast1" && <Ast1App onHome={home} />}
            {view === "ast2" && <Ast2App onHome={home} />}
            {view === "slope" && <SlopeApp onHome={home} />}
            {view === "card" && <CardApp onHome={home} />}
            {view === "snowtest" && <SnowTestApp onHome={home} />}
            {view === "danger" && <DangerApp onHome={home} />}
            {view === "bulletin" && <BulletinApp onHome={home} />}
            {view === "terrain" && <TerrainApp onHome={home} />}
            {view === "ates" && <AtesApp onHome={home} />}
            {view === "beacon" && <BeaconApp onHome={home} />}
            {view === "checklist" && <ChecklistApp onHome={home} />}
            {view === "perf" && <Performance onHome={home} session={session} />}
            {view === "leaderboard" && <Leaderboard onHome={home} session={session} isAdmin={isAdmin} />}
            {view === "admin" && isAdmin && <SiteAnalytics onHome={home} session={session} />}
            {view === "account" && <AccountApp onHome={home} session={session} access={access} onSignOut={() => { try { supabase && supabase.auth.signOut(); } catch (e) {} home(); }} />}
          </Suspense>
        </React.Fragment>
      )}
      <PwaStatus />
    </React.Fragment>
  );
}
