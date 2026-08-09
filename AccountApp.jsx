import React, { useState } from "react";
import { exportAllData, deleteAllData } from "./storage";

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
  const signedIn = !!(session && session.user);
  const email = signedIn ? session.user.email : null;

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);

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
      setNote(`Exported ${n} recorded run${n === 1 ? "" : "s"} plus trainer history.`);
    } catch (e) {
      setNote("Export failed: " + (e && e.message ? e.message : String(e)));
    }
    setBusy(false);
  };

  const doDelete = async () => {
    setBusy(true); setNote("");
    try {
      const res = await deleteAllData();
      if (res.ok) { setDone(true); setNote("Your practice data has been deleted."); }
      else setNote("Some data could not be deleted: " + res.error + " — if you're signed in, make sure the updated schema.sql (with delete policies) has been run in Supabase.");
    } catch (e) {
      setNote("Delete failed: " + (e && e.message ? e.message : String(e)));
    }
    setConfirming(false); setBusy(false);
  };

  return (
    <div style={wrap}>
      <div style={inner}>
        {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: T.dim,
          cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 600 }}>← All tools</button>}
        <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>Account &amp; privacy</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 16px" }}>Your account and your data</h1>

        {/* Account */}
        <Card accent={T.ice}>
          <Eyebrow>Account</Eyebrow>
          {signedIn ? (
            <div>
              <div style={{ fontSize: 14, color: T.snow }}>Signed in as <b>{email}</b></div>
              <div style={{ fontSize: 12.5, color: T.dim, margin: "6px 0 12px", lineHeight: 1.5 }}>
                Your practice history syncs to this account across devices.
              </div>
              {onSignOut && <button style={ghost} onClick={onSignOut}>Sign out</button>}
            </div>
          ) : (
            <div style={{ fontSize: 13.5, color: T.dim, lineHeight: 1.5 }}>
              You&rsquo;re in guest / local mode — history is stored only on this device. Sign in from the top bar to sync across devices.
            </div>
          )}
        </Card>

        {/* What we store */}
        <Card>
          <Eyebrow>What&rsquo;s stored</Eyebrow>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.6 }}>
            {signedIn
              ? "Your email address, used only to send magic sign-in links, and your practice history (exam runs and trainer attempts), so your progress and analytics follow you across devices."
              : "Only your practice history, kept in this browser&rsquo;s local storage on this device. Nothing is sent to a server while you&rsquo;re in guest mode."}
            <br /><br />
            No ads, no trackers, and your data is never sold. This is a personal study project.
          </div>
        </Card>

        {/* Export */}
        <Card accent={T.good}>
          <Eyebrow>Export my data</Eyebrow>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, marginBottom: 12 }}>
            Download everything stored for you — every recorded run and all trainer history — as a JSON file you keep.
          </div>
          <button style={btn(T.good, "#0c1218")} disabled={busy} onClick={doExport}>Export my data (JSON)</button>
        </Card>

        {/* Delete */}
        <Card accent={T.bad}>
          <Eyebrow>Delete my data</Eyebrow>
          <div style={{ fontSize: 13, color: T.dim, lineHeight: 1.55, marginBottom: 12 }}>
            Permanently remove all of your practice history{signedIn ? " from this account and this device" : " from this device"}. This can&rsquo;t be undone.
            {signedIn && <span> Your sign-in email itself stays with the login provider; deleting it entirely isn&rsquo;t something the app can do from here.</span>}
          </div>
          {done ? (
            <div style={{ fontSize: 13.5, color: T.good, fontWeight: 700 }}>✓ Deleted. You may want to reload the app.</div>
          ) : !confirming ? (
            <button style={btn("transparent", T.bad)} onClick={() => { setNote(""); setConfirming(true); }}>
              Delete all my practice data
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: T.snow, lineHeight: 1.5, marginBottom: 10,
                padding: "10px 12px", background: "rgba(214,72,59,0.12)", border: `1px solid ${T.bad}`, borderRadius: 10 }}>
                This will permanently erase your entire practice history. Consider exporting first. Continue?
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button style={{ ...btn(T.bad, "#fff"), flex: 1 }} disabled={busy} onClick={doDelete}>Yes, delete everything</button>
                <button style={{ ...ghost, flex: 1 }} disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
              </div>
            </div>
          )}
        </Card>

        {note && <div style={{ fontSize: 12.5, color: T.dim, lineHeight: 1.5, marginTop: 2 }}>{note}</div>}
      </div>
    </div>
  );
}
