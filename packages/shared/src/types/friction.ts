import { z } from "zod";
import {
  FrictionScoringConfigSchema,
  FrictionThresholdConfigSchema,
  NormalizedFrictionSignalsSchema,
  SignalContributionBreakdownSchema,
  FrictionThresholdStateNameSchema,
  AdaptationEligibilityResultSchema,
  CognitiveFrictionEvaluationSchema,
} from "../schemas/friction.schema.js";

export type FrictionScoringConfig = z.infer<typeof FrictionScoringConfigSchema>;
export type FrictionThresholdConfig = z.infer<
  typeof FrictionThresholdConfigSchema
>;
export type NormalizedFrictionSignals = z.infer<
  typeof NormalizedFrictionSignalsSchema
>;
export type SignalContributionBreakdown = z.infer<
  typeof SignalContributionBreakdownSchema
>;
export type FrictionThresholdStateName = z.infer<
  typeof FrictionThresholdStateNameSchema
>;
export type AdaptationEligibilityResult = z.infer<
  typeof AdaptationEligibilityResultSchema
>;
export type CognitiveFrictionEvaluation = z.infer<
  typeof CognitiveFrictionEvaluationSchema
>;