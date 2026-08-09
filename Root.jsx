import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Ast1App, Ast2App } from "./App.jsx";
import { SlopeApp } from "./SlopeApp.jsx";
import { Performance } from "./Performance.jsx";

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

function Home({ onPick, session }) {
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
        <button style={tile(T.ice)} onClick={() => onPick("ast1")}>
          <div style={h}>AST 1 Practice</div>
          <p style={p}>273 questions across terrain, snowpack, weather, forecasting, trip planning, companion rescue, and human factors.</p>
        </button>
        <button style={tile("#b98cff")} onClick={() => onPick("ast2")}>
          <div style={h}>AST 2 Practice</div>
          <p style={p}>Advanced curriculum — snowpack tests, avalanche problems, terrain &amp; ATES, decision-making, and more.</p>
        </button>
        <button style={tile(T.amber)} onClick={() => onPick("slope")}>
          <div style={h}>Slope-Angle Trainer</div>
          <p style={p}>Train your eye to call above vs. below the 30-degree avalanche threshold.</p>
        </button>
        {session && session.user && (
          <button style={tile("#3FA372")} onClick={() => onPick("perf")}>
            <div style={h}>Performance analysis</div>
            <p style={p}>Accuracy across every tool — broken down by subject, format, and difficulty, with filters.</p>
          </button>
        )}
      </div>
    </div>
  );
}

export default function Root() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState("home"); // home | ast1 | slope

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => { try { sub.subscription.unsubscribe(); } catch (e) {} };
  }, []);

  const home = () => setView("home");

  return (
    <React.Fragment>
      <TopBar session={session} view={view} onHome={home} />
      {view === "home" && <Home onPick={setView} session={session} />}
      {view === "ast1" && <Ast1App onHome={home} />}
      {view === "ast2" && <Ast2App onHome={home} />}
      {view === "slope" && <SlopeApp onHome={home} />}
      {view === "perf" && <Performance onHome={home} session={session} />}
    </React.Fragment>
  );
}
