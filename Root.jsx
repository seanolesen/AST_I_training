import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Ast1App, Ast2App } from "./App.jsx";
import { SlopeApp } from "./SlopeApp.jsx";
import { Performance } from "./Performance.jsx";
import { SiteAnalytics } from "./SiteAnalytics.jsx";

const SUPER_ADMIN = "sean.olesen@gmail.com";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0",
  ice: "#7cc4ff", amber: "#f0812c", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";

function TopBar({ session, view, onHome }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const row = { display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", padding: "10px 12px", background: T.bg,
    borderBottom: `1px solid ${T.line}`, fontFamily: FONT, fontSize: 12.5 };
  const chip = { padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.line}`,
    background: T.panel, color: T.snow };
  const btn = { ...chip, cursor: "pointer" };

  const back = view !== "home"
    ? <button onClick={onHome} style={{ ...btn, borderColor: T.ice, color: T.ice, fontWeight: 700 }}>← All tools</button>
    : <span />;

  let auth;
  if (!supabase) {
    auth = <span style={{ ...chip, opacity: 0.7 }}>Local mode</span>;
  } else if (session && session.user) {
    auth = (
      <React.Fragment>
        <span style={chip}>{session.user.email}</span>
        <button style={btn} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </React.Fragment>
    );
  } else {
    const send = async () => {
      if (!email) { setStatus("Enter your email"); return; }
      setStatus("Sending…");
      const { error } = await supabase.auth.signInWithOtp({
        email, options: { emailRedirectTo: window.location.origin },
      });
      setStatus(error ? ("Error: " + error.message) : "Check your email for the link");
    };
    auth = (
      <React.Fragment>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
          style={{ ...chip, minWidth: 150, outline: "none" }} />
        <button style={btn} onClick={send}>Sign in to sync</button>
        {status && <span style={{ color: T.dim }}>{status}</span>}
      </React.Fragment>
    );
  }

  return (
    <div style={row}>
      {back}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
        {auth}
      </div>
    </div>
  );
}

function Home({ onPick, session, isAdmin }) {
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
          Avalanche training
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 2px", letterSpacing: "-0.3px" }}>Choose a tool</h1>
        <p style={{ ...p, margin: "0 0 4px" }}>
          {session && session.user
            ? `Signed in as ${session.user.email} — your runs sync across devices.`
            : "Local mode — sign in above to sync your history across devices."}
        </p>
        <button style={tile(T.amber)} onClick={() => onPick("slope")}>
          <div style={h}>Slope-Angle Trainer</div>
          <p style={p}>Train your eye to call above vs. below the 30-degree avalanche threshold.</p>
        </button>
        <button style={tile(T.ice)} onClick={() => onPick("ast1")}>
          <div style={h}>AST 1 Practice</div>
          <p style={p}>273 questions across terrain, snowpack, weather, forecasting, trip planning, companion rescue, and human factors.</p>
        </button>
        <button style={tile("#b98cff")} onClick={() => onPick("ast2")}>
          <div style={h}>AST 2 Practice</div>
          <p style={p}>Advanced curriculum — snowpack tests, avalanche problems, terrain &amp; ATES, decision-making, and more.</p>
        </button>
        {session && session.user && (
          <button style={tile("#3FA372")} onClick={() => onPick("perf")}>
            <div style={h}>Performance analysis</div>
            <p style={p}>Accuracy across every tool — broken down by subject, format, and difficulty, with filters.</p>
          </button>
        )}
        {isAdmin && (
          <button style={tile("#E0B93C")} onClick={() => onPick("admin")}>
            <div style={h}>Site analytics</div>
            <p style={p}>Admin: all users, engagement stats, and click-into performance.</p>
          </button>
        )}
      </div>
    </div>
  );
}

export default function Root() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("home"); // home | ast1 | ast2 | slope | perf | admin
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
            <div style={{ fontSize: 12, letterSpacing: "1.4px", textTransform: "uppercase", color: T.dim }}>Before you start</div>
            <h2 style={{ fontSize: 20, fontWeight: 800, margin: "6px 0 10px" }}>A study aid, not the real thing</h2>
            <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.55, margin: "0 0 10px" }}>
              These tools help you prepare for AST 1 and AST 2, but they are not a substitute for a certified course or for real-world judgment. Questions are original study material, not official exam content, and the 80% figure is a self-study benchmark, not a pass mark.
            </p>
            <p style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.55, margin: "0 0 16px" }}>
              Avalanche terrain is dangerous. Take a course, carry a transceiver, probe, and shovel, check the local bulletin, and make decisions with trained partners.
            </p>
            <button onClick={() => { try { localStorage.setItem("avy_onboarded", "1"); } catch (e) {} setShowIntro(false); }}
              style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", cursor: "pointer",
                background: T.ice, color: T.bg, fontSize: 15, fontWeight: 800 }}>
              I understand
            </button>
          </div>
        </div>
      )}
      <TopBar session={session} view={view} onHome={home} />
      {view === "home" && <Home onPick={setView} session={session} isAdmin={isAdmin} />}
      {view === "ast1" && <Ast1App onHome={home} />}
      {view === "ast2" && <Ast2App onHome={home} />}
      {view === "slope" && <SlopeApp onHome={home} />}
      {view === "perf" && <Performance onHome={home} session={session} />}
      {view === "admin" && isAdmin && <SiteAnalytics onHome={home} session={session} />}
    </React.Fragment>
  );
}
