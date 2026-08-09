import React from "react";
import { ExamApp } from "./ExamApp.jsx";
import { BANK as BANK1 } from "./questions";
import { BANK as BANK2 } from "./questions2";

const AST1 = {
  appKey: "ast1",
  bank: BANK1,
  benchmark: 0.8,
  eyebrow: "AST 1 · Written-exam practice",
  intro: "Practice questions across the Avalanche Skills Training 1 curriculum — terrain, snowpack, weather, the forecast, trip planning, companion rescue, and human factors.",
  topics: {
    terrain: "Terrain", snowpack: "Snowpack", weather: "Weather",
    forecast: "Forecast & Danger", planning: "Trip Planning",
    rescue: "Companion Rescue", travel: "Travel & Human Factors",
  },
  sourceDefault: "Avalanche Canada — Avalanche Skills Training 1 curriculum (avalanche.ca)",
  sources: {
    terrain: "Avalanche Canada AST 1 — Terrain; Avalanche Terrain Exposure Scale (ATES), Statham et al.",
    snowpack: "Avalanche Canada AST 1 — Snowpack; CAA Observation Guidelines & Recording Standards (OGRS)",
    weather: "Avalanche Canada AST 1 — Mountain Weather; CAA OGRS weather observations",
    forecast: "Avalanche Canada — North American Public Avalanche Danger Scale; daily avalanche forecasts",
    planning: "Avalanche Canada — Trip Planning; the Avaluator and Avalanche Terrain Exposure Scale (ATES)",
    rescue: "Avalanche Canada AST 1 — Companion Rescue; CAA companion-rescue guidelines",
    travel: "Avalanche Canada AST 1 — Travel & Human Factors; McCammon heuristic traps (ALPTRUTh)",
  },
};

const AST2 = {
  appKey: "ast2",
  bank: BANK2,
  benchmark: 0.8,
  eyebrow: "AST 2 · Written-exam practice",
  intro: "Advanced questions across the Avalanche Skills Training 2 curriculum — snowpack and stability tests, avalanche problems, terrain and ATES, weather and snowpack evolution, trip planning and decision-making, advanced companion rescue, and human factors and group management.",
  topics: {
    snowpack: "Snowpack & Tests", problems: "Avalanche Problems", terrain: "Terrain & ATES",
    weather: "Weather & Evolution", planning: "Planning & Decisions", rescue: "Advanced Rescue",
    human: "Human & Group",
  },
  sourceDefault: "Avalanche Canada — Avalanche Skills Training 2 curriculum (avalanche.ca)",
  sources: {
    snowpack: "Avalanche Canada AST 2 — Snowpack & stability tests; CAA OGRS snow-profile and test standards",
    problems: "Avalanche Canada — Avalanche problem types; Conceptual Model of Avalanche Hazard (CMAH), Statham et al.",
    terrain: "Avalanche Canada AST 2 — Terrain & the Avalanche Terrain Exposure Scale (ATES), Statham et al.",
    weather: "Avalanche Canada AST 2 — Weather & snowpack evolution; CAA OGRS",
    planning: "Avalanche Canada AST 2 — Planning & decision-making; Avaluator and CMAH",
    rescue: "Avalanche Canada AST 2 — Advanced companion rescue; CAA guidelines",
    human: "Avalanche Canada AST 2 — Human factors & group management; McCammon heuristic traps (ALPTRUTh)",
  },
};

export function Ast1App({ onHome }) { return <ExamApp onHome={onHome} config={AST1} />; }
export function Ast2App({ onHome }) { return <ExamApp onHome={onHome} config={AST2} />; }
