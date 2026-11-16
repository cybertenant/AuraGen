import { z } from "zod";
import { FrictionLevelSchema } from "./index.js";

/**
 * Configurable weights and normalization denominators for the Interaction Friction heuristic.
 * Note: These represent behavioral interaction-friction heuristics, NOT psychological or emotional diagnoses.
 */
export const FrictionScoringConfigSchema = z
  .object({
    weights: z
      .object({
        hesitation: z.number().min(0).max(1).default(0.25),
        validationErrors: z.number().min(0).max(1).default(0.3),
        repeatedClicks: z.number().min(0).max(1).default(0.2),
        backtracking: z.number().min(0).max(1).default(0.15),
        cursorAnomaly: z.number().min(0).max(1).default(0.1),
      })
      .default({
        hesitation: 0.25,
        validationErrors: 0.3,
        repeatedClicks: 0.2,
        backtracking: 0.15,
        cursorAnomaly: 0.1,
      }),
    normalizationThresholds: z
      .object({
        hesitationDivisor: z.number().positive().default(3),
        validationErrorsDivisor: z.number().positive().default(3),
        repeatedClicksDivisor: z.number().positive().default(4),
        backtracksDivisor: z.number().positive().default(3),
      })
      .default({
        hesitationDivisor: 3,
        validationErrorsDivisor: 3,
        repeatedClicksDivisor: 4,
        backtracksDivisor: 3,
      }),
    levelThresholds: z
      .object({
        mediumMin: z.number().min(0).max(100).default(31),
        highMin: z.number().min(0).max(100).default(65),
      })
      .default({
        mediumMin: 31,
        highMin: 65,
      }),
    smoothing: z
      .object({
        previousWeight: z.number().min(0).max(1).default(0.65),
        currentWeight: z.number().min(0).max(1).default(0.35),
      })
      .default({
        previousWeight: 0.65,
        currentWeight: 0.35,
      }),
  })
  .strict();

export const FrictionThresholdConfigSchema = z
  .object({
    highFrictionThreshold: z.number().min(0).max(100).default(65),
    sustainedDurationMs: z.number().nonnegative().default(5000),
    recoveryThreshold: z.number().min(0).max(100).default(55),
    cooldownDurationMs: z.number().nonnegative().default(60000),
  })
  .strict();

export const NormalizedFrictionSignalsSchema = z
  .object({
    hesitation: z.number().min(0).max(1),
    validationErrors: z.number().min(0).max(1),
    repeatedClicks: z.number().min(0).max(1),
    backtracking: z.number().min(0).max(1),
    cursorAnomaly: z.number().min(0).max(1),
  })
  .strict();

export const SignalContributionBreakdownSchema = z
  .object({
    hesitation: z.number().min(0).max(100),
    validationErrors: z.number().min(0).max(100),
    repeatedClicks: z.number().min(0).max(100),
    backtracking: z.number().min(0).max(100),
    cursorAnomaly: z.number().min(0).max(100),
  })
  .strict();

export const FrictionThresholdStateNameSchema = z.enum([
  "idle",
  "candidate",
  "eligible_triggered",
  "cooldown",
]);

export const AdaptationEligibilityResultSchema = z
  .object({
    state: FrictionThresholdStateNameSchema,
    isAboveHighThreshold: z.boolean(),
    isEligibleForAdaptation: z.boolean(),
    shouldTriggerAdaptationEvent: z.boolean(),
    sustainedDurationMs: z.number().nonnegative(),
    remainingSustainedMs: z.number().nonnegative(),
    cooldownRemainingMs: z.number().nonnegative(),
  })
  .strict();

export const CognitiveFrictionEvaluationSchema = z
  .object({
    rawScore: z.number().min(0).max(100),
    smoothedScore: z.number().min(0).max(100),
    level: FrictionLevelSchema,
    signals: NormalizedFrictionSignalsSchema,
    contributions: SignalContributionBreakdownSchema,
    thresholdStatus: AdaptationEligibilityResultSchema,
    evaluatedAt: z.number().int().positive(),
  })
  .strict();