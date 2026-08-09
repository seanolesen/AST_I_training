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
};

export function Ast1App({ onHome }) { return <ExamApp onHome={onHome} config={AST1} />; }
export function Ast2App({ onHome }) { return <ExamApp onHome={onHome} config={AST2} />; }
