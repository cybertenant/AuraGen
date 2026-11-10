// All tunable values for the Friction Engine live here.
// These are prototype values: adjust them as you learn from real usage.

import { FIELDS, SECTION_META } from "../lib/fields.js";

// Sections the engine scores (the dashboard and monitor pages are not scored).
export const FRICTION_SECTIONS = ["personal", "employment", "financial", "documents", "review"];

export const SECTION_LABELS = Object.fromEntries(
  FRICTION_SECTIONS.map((id) => [id, SECTION_META[id].label])
);

// Human-readable field names for the interaction log (labels only, never values).
export const FIELD_LABELS = {
  submitButton: "Submit button",
  ...Object.fromEntries(
    Object.values(FIELDS).flat().map((field) => [field.name, field.label])
  ),
};

export const FRICTION_CONFIG = {
  // Rolling window: events older than this stop affecting the score.
  windowMs: 60_000,
  // Events keep full weight for the first part of the window, then fade linearly to zero,
  // so scores fall gradually instead of dropping all at once.
  useDecay: true,
  decayStartFraction: 0.5,
  // How often the engine recalculates when no new event arrives.
  tickMs: 1_000,

  // Formula weights (must add up to 1).
  weights: { clicks: 0.3, hesitation: 0.3, validation: 0.25, navigation: 0.15 },

  // Score ranges: 0-30 low, 31-60 moderate, 61-100 high.
  thresholds: { moderate: 31, high: 61 },

  // "Overall" score shown on the dashboard: "max" of the sections, or "mean".
  overall: "max",

  clicks: {
    burstWindowMs: 2_000, // clicks must land within this window...
    burstThreshold: 3, // ...and reach this count to be a repeated-click burst
    saturation: 8, // total burst clicks in the window that equal a score of 100
  },

  hesitation: {
    thresholdMs: 8_000, // focus time before typing (or leaving) that counts as hesitation
    minSampleMs: 250, // ignore shorter focus times (tabbing through fields)
    saturation: 3, // weighted hesitation events that equal a score of 100
  },

  validation: {
    // attempt: an invalid Next/Submit click. repeat: the same field failing again.
    // inline: an error shown when leaving a field.
    weights: { attempt: 1, repeat: 0.5, inline: 0.25 },
    saturation: 6,
  },

  navigation: {
    saturation: 4, // backtracks in the window that equal a score of 100
  },

  // Asymmetric smoothing: score rises quickly, falls slowly.
  smoothing: { riseTauMs: 1_500, fallTauMs: 6_000 },

  // High-friction trigger.
  trigger: {
    cooldownMs: 30_000, // minimum gap between events for the same section
  },

  maxLogEntries: 100,
};

export function getFrictionLevel(score, thresholds = FRICTION_CONFIG.thresholds) {
  const rounded = Math.round(score);
  if (rounded >= thresholds.high) return "high";
  if (rounded >= thresholds.moderate) return "moderate";
  return "low";
}
