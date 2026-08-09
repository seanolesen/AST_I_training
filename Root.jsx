import React, { useState, useEffect } from "react";
import { supabase } from "./supabaseClient";
import { Ast1App, Ast2App } from "./App.jsx";
import { SlopeApp } from "./SlopeApp.jsx";
import { Performance } from "./Performance.jsx";
import { SiteAnalytics } from "./SiteAnalytics.jsx";

const SUPER_ADMIN = "sean.olesen@gmail.com";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0",
  ice: "#7cc4ff", amber: "#f0812c", line: "rgba(255,255,255,0.12)" };

function TopBar({ session, view, onHome }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const btn = { padding: "7px 12px", borderRadius: 9, border: `1px solid ${T.line}`,
    background: "transparent", color: T.dim, fontSize: 13, cursor: "pointer", fontWeight: 600 };
  const chip = { fontSize: 12.5, color: T.dim, maxWidth: 180, overflow: "hidden",
    textOverflow: "ellipsis", whiteSpace: "nowrap" };
  const bar = { display: "flex", alignItems: "center", justifyContent: "space-between",
    gap: 10, padding: "8px 14px", background: T.panel, borderBottom: `1px solid ${T.line}`,
    position: "sticky", top: 0, zIndex: 10 };

  let right;
  if (!supabase) {
    right = <span style={chip}>Local mode</span>;
  } else if (session && session.user) {
    right = (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={chip}>{session.user.email}</span>
        <button style={btn} onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    );
  } else {
    const send = async () => {
      if (!email) return;
      setStatus("sending");
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      });
      setStatus(error ? "error" : "sent");
    };
    right = (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
          style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${T.line}`,
            background: T.bg, color: T.snow, fontSize: 13, width: 150 }} />
        <button style={{ ...btn, borderColor: T.ice, color: T.ice }} onClick={send}>
          {status === "sending" ? "…" : status === "sent" ? "Check email" : status === "error" ? "Retry" : "Sign in"}
        </button>
      </div>
    );
  }

  return (
    <div style={bar}>
      {view !== "home"
        ? <button onClick={onHome} style={{ ...btn, borderColor: T.ice, color: T.ice, fontWeight: 700 }}>← All tools</button>
        : <span style={{ fontSize: 14, fontWeight: 800, color: T.snow }}>Avalanche Training</span>}
      {right}
    </div>
  );
}

function Home({ onPick, session, isAdmin }) {
  const h = { fontSize: 16, fontWeight: 800, color: T.snow };
  const p = { fontSize: 13, color: T.dim, margin: "4px 0 0", lineHeight: 1.45 };
  const tile = (accent) => ({
    display: "block", width: "100%", textAlign: "left", cursor: "pointer",
    background: T.panel, border: `1px solid ${T.line}`, borderLeft: `4px solid ${accent}`,
    borderRadius: 14, padding: "16px 16px", marginBottom: 12,
  });
  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    padding: "22px 14px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 560, margin: "0 auto" };

  return (
    <div style={wrap}>
      <div style={inner}>
        <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>Avalanche safety training</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 4px" }}>Choose a tool</h1>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 18px", lineHeight: 1.5 }}>
          {session && session.user
            ? `Signed in as ${session.user.email} — your runs sync across devices.`
            : "Practice tools for AST 1 and AST 2 prep. Sign in (top right) to sync your history and see analytics."}
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

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
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

  const home = () => setView("home");

  return (
    <div style={{ background: T.bg, minHeight: "100vh" }}>
      <TopBar session={session} view={view} onHome={home} />
      {view === "home" && <Home onPick={setView} session={session} isAdmin={isAdmin} />}
      {view === "ast1" && <Ast1App onHome={home} />}
      {view === "ast2" && <Ast2App onHome={home} />}
      {view === "slope" && <SlopeApp onHome={home} />}
      {view === "perf" && <Performance onHome={home} session={session} />}
      {view === "admin" && isAdmin && <SiteAnalytics onHome={home} session={session} />}
    </div>
  );
}
