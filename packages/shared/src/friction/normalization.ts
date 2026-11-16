import type { TelemetrySnapshot } from "../types/index.js";
import type {
  FrictionScoringConfig,
  NormalizedFrictionSignals,
} from "../types/friction.js";
import {
  FrictionScoringConfigSchema,
  NormalizedFrictionSignalsSchema,
} from "../schemas/friction.schema.js";

/**
 * Safely sanitizes arbitrary numeric inputs, rejecting NaN and Infinity.
 */
export function sanitizeFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

/**
 * Clamps any value into the closed unit interval [0, 1].
 */
export function clamp01(x: number): number {
  const safe = sanitizeFiniteNumber(x, 0);
  return Math.max(0, Math.min(1, safe));
}

/**
 * Clamps any score into the closed range [0, 100].
 */
export function clampScore100(score: number): number {
  const safe = sanitizeFiniteNumber(score, 0);
  return Math.max(0, Math.min(100, safe));
}

/**
 * Normalizes aggregated Day 3 telemetry metrics into bounded [0, 1] signals:
 * - H = clamp01(hesitationCount / 3)
 * - E = clamp01(validationErrors / 3)
 * - R = clamp01(repeatedClicks / 4)
 * - B = clamp01(backtracks / 3)
 * - M = clamp01(cursorAnomalyScore)
 */
export function normalizeTelemetrySignals(
  snapshot: Partial<TelemetrySnapshot> | null | undefined,
  config?: Partial<FrictionScoringConfig>
): NormalizedFrictionSignals {
  const resolvedConfig = FrictionScoringConfigSchema.parse(config ?? {});
  const divisors = resolvedConfig.normalizationThresholds;

  const hesitationCount = Math.max(
    0,
    sanitizeFiniteNumber(snapshot?.hesitationCount, 0)
  );
  const validationErrors = Math.max(
    0,
    sanitizeFiniteNumber(snapshot?.validationErrors, 0)
  );
  const repeatedClicks = Math.max(
    0,
    sanitizeFiniteNumber(snapshot?.repeatedClicks, 0)
  );
  const backtracks = Math.max(0, sanitizeFiniteNumber(snapshot?.backtracks, 0));
  const cursorAnomalyScore = sanitizeFiniteNumber(
    snapshot?.cursorAnomalyScore,
    0
  );

  return NormalizedFrictionSignalsSchema.parse({
    hesitation: Number(
      clamp01(hesitationCount / divisors.hesitationDivisor).toFixed(4)
    ),
    validationErrors: Number(
      clamp01(validationErrors / divisors.validationErrorsDivisor).toFixed(4)
    ),
    repeatedClicks: Number(
      clamp01(repeatedClicks / divisors.repeatedClicksDivisor).toFixed(4)
    ),
    backtracking: Number(
      clamp01(backtracks / divisors.backtracksDivisor).toFixed(4)
    ),
    cursorAnomaly: Number(clamp01(cursorAnomalyScore).toFixed(4)),
  });
}