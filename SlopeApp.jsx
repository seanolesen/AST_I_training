import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { loadDoc, saveDoc } from "./storage";

/* ------------------------------------------------------------------ *
 * Avalanche Slope-Angle Trainer
 * Judge >30° vs <30° — the standard avalanche threshold.
 * Slopes are drawn at a known angle so grading is exact.
 * Setup screen controls difficulty, view, set length, and feedback.
 * ------------------------------------------------------------------ */

// ---- Avalanche slope-shading bands (real convention) ----------------
const BANDS = [
  { max: 27, color: "#3FA372", name: "Low angle", note: "Slab avalanches uncommon" },
  { max: 30, color: "#E0B93
