import type {
  AdaptationEligibilityResult,
  FrictionThresholdConfig,
  FrictionThresholdStateName,
} from "../types/friction.js";
import {
  AdaptationEligibilityResultSchema,
  FrictionThresholdConfigSchema,
} from "../schemas/friction.schema.js";
import { clampScore100, sanitizeFiniteNumber } from "./normalization.js";

/**
 * Deterministic State Machine for Sustained High-Friction Detection.
 *
 * Rules:
 * 1. High-friction threshold: >= 65 (configurable).
 * 2. Score must stay >= 65 continuously for 5000ms before adaptation eligibility triggers.
 * 3. If score drops below recoveryThreshold (55), the candidate timer resets to idle.
 * 4. Once triggered, enters a 60000ms cooldown to prevent repeated triggers while user stays in high friction.
 * 5. After cooldown expires AND user recovers (<55), a subsequent high-friction episode can trigger again.
 */
export class SustainedFrictionThresholdMachine {
  private readonly config: FrictionThresholdConfig;
  private state: FrictionThresholdStateName = "idle";
  private candidateStartedAtMs: number | null = null;
  private cooldownStartedAtMs: number | null = null;
  private hasTriggeredInCurrentEpisode = false;

  constructor(config?: Partial<FrictionThresholdConfig>) {
    this.config = FrictionThresholdConfigSchema.parse(config ?? {});
  }

  public getConfig(): FrictionThresholdConfig {
    return { ...this.config };
  }

  public getState(): FrictionThresholdStateName {
    return this.state;
  }

  public reset(): void {
    this.state = "idle";
    this.candidateStartedAtMs = null;
    this.cooldownStartedAtMs = null;
    this.hasTriggeredInCurrentEpisode = false;
  }

  public evaluate(
    score: number,
    timestampMs: number
  ): AdaptationEligibilityResult {
    const safeScore = clampScore100(score);
    const now = Math.max(0, sanitizeFiniteNumber(timestampMs, Date.now()));

    const {
      highFrictionThreshold,
      sustainedDurationMs,
      recoveryThreshold,
      cooldownDurationMs,
    } = this.config;

    const isAboveHighThreshold = safeScore >= highFrictionThreshold;
    const isBelowRecoveryThreshold = safeScore < recoveryThreshold;

    let shouldTriggerAdaptationEvent = false;
    let sustainedMs = 0;
    let cooldownRemainingMs = 0;

    // 1. Handle active cooldown expiration first
    if (
      (this.state === "cooldown" || this.state === "eligible_triggered") &&
      this.cooldownStartedAtMs !== null
    ) {
      const elapsedCooldown = Math.max(0, now - this.cooldownStartedAtMs);
      if (elapsedCooldown >= cooldownDurationMs) {
        this.cooldownStartedAtMs = null;
        if (isBelowRecoveryThreshold) {
          this.state = "idle";
          this.candidateStartedAtMs = null;
          this.hasTriggeredInCurrentEpisode = false;
        } else {
          // Cooldown finished, but user has not yet dipped below recoveryThreshold (55)
          this.state = "eligible_triggered";
        }
      } else {
        this.state = "cooldown";
        cooldownRemainingMs = cooldownDurationMs - elapsedCooldown;
      }
    }

    // 2. State transitions when not in active cooldown
    if (this.state !== "cooldown") {
      if (isBelowRecoveryThreshold) {
        // User recovered below 55 -> reset candidate and allow future episodes
        this.state = "idle";
        this.candidateStartedAtMs = null;
        this.hasTriggeredInCurrentEpisode = false;
      } else if (isAboveHighThreshold) {
        if (!this.hasTriggeredInCurrentEpisode) {
          if (this.candidateStartedAtMs === null) {
            this.candidateStartedAtMs = now;
            this.state = "candidate";
            sustainedMs = 0;
          } else {
            sustainedMs = Math.max(0, now - this.candidateStartedAtMs);
            if (sustainedMs >= sustainedDurationMs) {
              // Sustained >= 5 seconds! Fire adaptation eligibility event once & start cooldown
              this.state = "eligible_triggered";
              this.hasTriggeredInCurrentEpisode = true;
              this.cooldownStartedAtMs = now;
              shouldTriggerAdaptationEvent = true;
              cooldownRemainingMs = cooldownDurationMs;
            } else {
              this.state = "candidate";
            }
          }
        } else {
          // Already triggered in this high-friction episode; do not re-trigger without recovery + cooldown
          this.state = "eligible_triggered";
        }
      } else {
        // Hysteresis band: recoveryThreshold (55) <= score < highFrictionThreshold (65)
        // Brief dip below 65 that hasn't recovered below 55 resets the 5s continuous high-friction timer
        if (!this.hasTriggeredInCurrentEpisode) {
          this.state = "idle";
          this.candidateStartedAtMs = null;
        }
      }
    }

    const remainingSustainedMs =
      this.state === "candidate"
        ? Math.max(0, sustainedDurationMs - sustainedMs)
        : 0;

    return AdaptationEligibilityResultSchema.parse({
      state: this.state,
      isAboveHighThreshold,
      isEligibleForAdaptation:
        shouldTriggerAdaptationEvent ||
        this.state === "eligible_triggered" ||
        this.state === "cooldown",
      shouldTriggerAdaptationEvent,
      sustainedDurationMs: sustainedMs,
      remainingSustainedMs,
      cooldownRemainingMs,
    });
  }
}