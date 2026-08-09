import React, { useState, useEffect } from "react";
import { useLang } from "./i18n.jsx";
import { TOOLS } from "./Performance.jsx";
import { fetchLeaderboard, getMyLeaderboard, rankFor, QUALIFY } from "./leaderboard.js";

const T = { bg: "#0f1720", panel: "#141c26", snow: "#e8eef4", dim: "#9fb0c0", mute: "#6b7c8c",
  ice: "#7cc4ff", good: "#3FA372", warn: "#f0812c", line: "rgba(255,255,255,0.12)" };
const FONT = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const MONO = "ui-monospace, Menlo, monospace";
const MEDAL = ["#f2c14e", "#c8d2dc", "#cd7f45"]; // gold / silver / bronze

export function Leaderboard({ onHome, session }) {
  const { t } = useLang();
  const signedIn = !!(session && session.user);
  const myId = signedIn ? session.user.id : null;
  const [rows, setRows] = useState(null); // null = loading
  const [tab, setTab] = useState(TOOLS[0].key);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!signedIn) { if (alive) setRows([]); return; }
      const data = await fetchLeaderboard();
      if (alive) setRows(data);
    })();
    return () => { alive = false; };
  }, [signedIn]);

  const wrap = { minHeight: "calc(100vh - 44px)", background: T.bg, color: T.snow, fontFamily: FONT, padding: "22px 14px 44px", boxSizing: "border-box" };
  const inner = { maxWidth: 560, margin: "0 auto" };
  const ranked = rows ? rankFor(rows, tab) : [];
  const myRank = ranked.findIndex((r) => r.user_id === myId);

  return (
    <div style={wrap}>
      <div style={inner}>
        {onHome && <button onClick={onHome} style={{ background: "transparent", border: "none", color: T.dim, cursor: "pointer", fontSize: 13, padding: "0 0 12px", fontWeight: 600 }}>{t("nav.allTools")}</button>}
        <div style={{ fontSize: 12, letterSpacing: "1.6px", textTransform: "uppercase", color: T.dim }}>{t("lb.eyebrow")}</div>
        <h1 style={{ fontSize: 23, fontWeight: 800, margin: "6px 0 2px" }}>{t("lb.h1")}</h1>
        <p style={{ fontSize: 13, color: T.dim, margin: "0 0 14px", lineHeight: 1.5 }}>{t("lb.intro")}</p>

        {!signedIn ? (
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, fontSize: 13.5, color: T.dim }}>{t("lb.signIn")}</div>
        ) : (
          <>
            {/* tool tabs (canonical order) */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
              {TOOLS.map((tool) => {
                const on = tab === tool.key;
                return (
                  <button key={tool.key} onClick={() => setTab(tool.key)}
                    style={{ padding: "7px 11px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: on ? 700 : 500,
                      background: on ? T.ice : T.panel, color: on ? "#0c1218" : T.dim, border: `1px solid ${on ? T.ice : T.line}` }}>
                    {t("tool." + tool.key + ".name")}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 11.5, color: T.mute, marginBottom: 10 }}>{t("lb.rankedBy", { n: QUALIFY })}</div>

            {rows === null ? (
              <div style={{ fontSize: 13, color: T.dim }}>{t("lb.loading")}</div>
            ) : ranked.length === 0 ? (
              <div style={{ fontSize: 13, color: T.dim, background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16 }}>{t("lb.empty")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ranked.map((r, i) => {
                  const me = r.user_id === myId;
                  const medal = i < 3 ? MEDAL[i] : null;
                  return (
                    <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12,
                      background: me ? "rgba(124,196,255,0.12)" : T.panel, border: `1px solid ${me ? T.ice : T.line}` }}>
                      <div style={{ width: 26, textAlign: "center", fontFamily: MONO, fontWeight: 800, fontSize: 15, color: medal || T.dim }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.snow, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.name}{me && <span style={{ color: T.ice, fontWeight: 600, fontSize: 12 }}> · {t("lb.you")}</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: T.mute }}>{t("lb.reps", { n: r.n })}</div>
                      </div>
                      <div style={{ fontFamily: MONO, fontWeight: 800, fontSize: 17, color: r.acc >= 80 ? T.good : r.acc >= 50 ? T.warn : T.dim }}>{r.acc}%</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ fontSize: 11.5, color: T.mute, marginTop: 14, lineHeight: 1.5 }}>
              {myRank < 0 ? t("lb.notOnBoard") : t("lb.yourRank", { rank: myRank + 1, total: ranked.length })}
              {" "}{t("lb.optInHint")}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
