/**
 * Centralized Adaptive Friction Threshold Configuration.
 * Note: These values are configurable engineering heuristics for UX friction detection,
 * not clinical or scientifically validated psychological measurements.
 */
export interface AdaptiveThresholdConfig {
  readonly minScore: number;
  readonly maxScore: number;
  readonly lowMaxScore: number;
  readonly mediumMaxScore: number;
  readonly highFrictionThreshold: number;
  readonly recoveryThreshold: number;
  readonly sustainedDurationMs: number;
  readonly cooldownDurationMs: number;
  readonly maxObservationGapMs: number;
  readonly maxTrackedSessions: number;
  readonly sessionTtlMs: number;
}

export const DEFAULT_ADAPTIVE_CONFIG: AdaptiveThresholdConfig = {
  minScore: 0,
  maxScore: 100,
  lowMaxScore: 30,
  mediumMaxScore: 64,
  highFrictionThreshold: 65,
  recoveryThreshold: 55,
  sustainedDurationMs: 5000,
  cooldownDurationMs: 60000,
  maxObservationGapMs: 15000,
  maxTrackedSessions: 1000,
  sessionTtlMs: 60 * 60 * 1000, // 1 hour
};

export function createAdaptiveConfig(
  overrides: Partial<AdaptiveThresholdConfig> = {}
): AdaptiveThresholdConfig {
  const merged = { ...DEFAULT_ADAPTIVE_CONFIG, ...overrides };

  if (merged.recoveryThreshold >= merged.highFrictionThreshold) {
    throw new Error(
      `Invalid adaptive config: recoveryThreshold (${merged.recoveryThreshold}) must be strictly lower than highFrictionThreshold (${merged.highFrictionThreshold}) to preserve hysteresis.`
    );
  }
  if (merged.sustainedDurationMs <= 0) {
    throw new Error("Invalid adaptive config: sustainedDurationMs must be > 0.");
  }
  if (merged.cooldownDurationMs < 0) {
    throw new Error("Invalid adaptive config: cooldownDurationMs must be >= 0.");
  }
  if (merged.maxObservationGapMs <= 0) {
    throw new Error("Invalid adaptive config: maxObservationGapMs must be > 0.");
  }

  return Object.freeze(merged);
}