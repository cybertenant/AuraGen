import type { FrictionLevel, TelemetrySnapshot } from "../types/index.js";
import type {
  FrictionScoringConfig,
  NormalizedFrictionSignals,
  SignalContributionBreakdown,
} from "../types/friction.js";
import {
  FrictionScoringConfigSchema,
  SignalContributionBreakdownSchema,
} from "../schemas/friction.schema.js";
import {
  clampScore100,
  normalizeTelemetrySignals,
  sanitizeFiniteNumber,
} from "./normalization.js";

/**
 * Classifies a [0, 100] Interaction Friction Score into LOW, MEDIUM, or HIGH.
 * Default ranges:
 * - LOW: 0–30
 * - MEDIUM: 31–64
 * - HIGH: 65–100
 */
export function classifyFrictionLevel(
  score: number,
  config?: Partial<FrictionScoringConfig>
): FrictionLevel {
  const resolved = FrictionScoringConfigSchema.parse(config ?? {});
  const safeScore = clampScore100(score);

  if (safeScore >= resolved.levelThresholds.highMin) {
    return "high";
  }
  if (safeScore >= resolved.levelThresholds.mediumMin) {
    return "medium";
  }
  return "low";
}

/**
 * Computes the deterministic raw Interaction Friction Score (0–100) and per-signal point contributions:
 * CLS = 100 * (0.25*H + 0.30*E + 0.20*R + 0.15*B + 0.10*M)
 *
 * Heuristic Rationale:
 * - Validation Errors (0.30): Highest immediate indicator of user-form mismatch or rule confusion.
 * - Field Hesitation (0.25): Prolonged dwell (>8s) suggests cognitive processing or term ambiguity.
 * - Repeated Clicks (0.20): Rapid re-clicking indicates unresponsive UI expectations or submission friction.
 * - Backtracking (0.15): Returning to earlier sections signals uncertainty or overlooked dependencies.
 * - Cursor Anomaly (0.10): Lowest weight because pointer jitter is noisy and non-diagnostic on its own.
 */
export function calculateRawFrictionScore(
  snapshot: Partial<TelemetrySnapshot> | null | undefined,
  config?: Partial<FrictionScoringConfig>
): {
  rawScore: number;
  signals: NormalizedFrictionSignals;
  contributions: SignalContributionBreakdown;
} {
  const resolved = FrictionScoringConfigSchema.parse(config ?? {});
  const signals = normalizeTelemetrySignals(snapshot, resolved);
  const w = resolved.weights;

  const weightSum =
    sanitizeFiniteNumber(w.hesitation, 0.25) +
    sanitizeFiniteNumber(w.validationErrors, 0.3) +
    sanitizeFiniteNumber(w.repeatedClicks, 0.2) +
    sanitizeFiniteNumber(w.backtracking, 0.15) +
    sanitizeFiniteNumber(w.cursorAnomaly, 0.1);

  const scale = weightSum > 0 ? 100 / weightSum : 100;

  const hesitationPoints = Number(
    clampScore100(signals.hesitation * w.hesitation * scale).toFixed(2)
  );
  const validationErrorPoints = Number(
    clampScore100(
      signals.validationErrors * w.validationErrors * scale
    ).toFixed(2)
  );
  const repeatedClickPoints = Number(
    clampScore100(signals.repeatedClicks * w.repeatedClicks * scale).toFixed(2)
  );
  const backtrackingPoints = Number(
    clampScore100(signals.backtracking * w.backtracking * scale).toFixed(2)
  );
  const cursorAnomalyPoints = Number(
    clampScore100(signals.cursorAnomaly * w.cursorAnomaly * scale).toFixed(2)
  );

  const rawScore = Number(
    clampScore100(
      hesitationPoints +
        validationErrorPoints +
        repeatedClickPoints +
        backtrackingPoints +
        cursorAnomalyPoints
    ).toFixed(2)
  );

  const contributions = SignalContributionBreakdownSchema.parse({
    hesitation: hesitationPoints,
    validationErrors: validationErrorPoints,
    repeatedClicks: repeatedClickPoints,
    backtracking: backtrackingPoints,
    cursorAnomaly: cursorAnomalyPoints,
  });

  return {
    rawScore,
    signals,
    contributions,
  };
}