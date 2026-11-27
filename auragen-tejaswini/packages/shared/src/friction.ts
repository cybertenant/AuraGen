import {
  SanitizedContextSchema,
  type FrictionLevel,
  type FrictionSignals,
  type SanitizedContext,
} from "./schemas.js";

const WEIGHTS = {
  hesitation: 0.35,
  validationErrors: 0.3,
  backtracks: 0.2,
  repeatedClicks: 0.15,
} as const;

const DIVISORS = {
  hesitationMs: 30000,
  validationErrors: 3,
  backtracks: 3,
  repeatedClicks: 4,
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Turns aggregated behavioural signals into a 0-100 friction score.
 * This is an interaction heuristic, not a psychological assessment.
 */
export function computeFrictionScore(signals: FrictionSignals): number {
  const raw =
    WEIGHTS.hesitation *
      clamp01(signals.hesitationMs / DIVISORS.hesitationMs) +
    WEIGHTS.validationErrors *
      clamp01(signals.validationErrors / DIVISORS.validationErrors) +
    WEIGHTS.backtracks * clamp01(signals.backtracks / DIVISORS.backtracks) +
    WEIGHTS.repeatedClicks *
      clamp01(signals.repeatedClicks / DIVISORS.repeatedClicks);

  return Math.round(Math.max(0, Math.min(100, raw * 100)));
}

export function frictionLevel(score: number): FrictionLevel {
  if (score >= 65) return "high";
  if (score >= 31) return "medium";
  return "low";
}

/** Builds the only object permitted to leave the browser for the AI provider. */
export function sanitizeForAi(
  sessionId: string,
  score: number,
  fieldIds: string[]
): SanitizedContext {
  return SanitizedContextSchema.parse({
    sessionId,
    frictionScore: score,
    frictionLevel: frictionLevel(score),
    fieldIds,
  });
}
