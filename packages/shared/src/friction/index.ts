import type { TelemetrySnapshot } from "../types/index.js";
import type {
  CognitiveFrictionEvaluation,
  FrictionScoringConfig,
  FrictionThresholdConfig,
} from "../types/friction.js";
import {
  CognitiveFrictionEvaluationSchema,
  FrictionScoringConfigSchema,
} from "../schemas/friction.schema.js";
import { calculateRawFrictionScore, classifyFrictionLevel } from "./scoring.js";
import { computeSmoothedFrictionScore } from "./smoothing.js";
import { SustainedFrictionThresholdMachine } from "./threshold.js";
import { sanitizeFiniteNumber } from "./normalization.js";

export * from "./normalization.js";
export * from "./scoring.js";
export * from "./smoothing.js";
export * from "./threshold.js";

export interface CognitiveFrictionEngineOptions {
  scoringConfig?: Partial<FrictionScoringConfig>;
  thresholdConfig?: Partial<FrictionThresholdConfig>;
}

/**
 * Deterministic, framework-independent Cognitive Friction Engine.
 * Converts aggregated interaction telemetry into a smoothed [0, 100] Interaction Friction Score
 * and tracks sustained high-friction adaptation eligibility.
 */
export class CognitiveFrictionEngine {
  private readonly scoringConfig: FrictionScoringConfig;
  private readonly thresholdMachine: SustainedFrictionThresholdMachine;
  private previousSmoothedScore: number | null = null;
  private lastEvaluation: CognitiveFrictionEvaluation | null = null;

  constructor(options: CognitiveFrictionEngineOptions = {}) {
    this.scoringConfig = FrictionScoringConfigSchema.parse(
      options.scoringConfig ?? {}
    );
    this.thresholdMachine = new SustainedFrictionThresholdMachine(
      options.thresholdConfig
    );
  }

  public getPreviousSmoothedScore(): number | null {
    return this.previousSmoothedScore;
  }

  public getLastEvaluation(): CognitiveFrictionEvaluation | null {
    return this.lastEvaluation;
  }

  public reset(): void {
    this.previousSmoothedScore = null;
    this.lastEvaluation = null;
    this.thresholdMachine.reset();
  }

  public evaluate(
    snapshot: Partial<TelemetrySnapshot> | null | undefined,
    timestampMs: number = Date.now()
  ): CognitiveFrictionEvaluation {
    const safeTimestamp = Math.max(
      1,
      Math.floor(sanitizeFiniteNumber(timestampMs, Date.now()))
    );

    const { rawScore, signals, contributions } = calculateRawFrictionScore(
      snapshot,
      this.scoringConfig
    );

    const smoothedScore = computeSmoothedFrictionScore(
      rawScore,
      this.previousSmoothedScore,
      this.scoringConfig.smoothing
    );

    this.previousSmoothedScore = smoothedScore;

    const level = classifyFrictionLevel(smoothedScore, this.scoringConfig);
    const thresholdStatus = this.thresholdMachine.evaluate(
      smoothedScore,
      safeTimestamp
    );

    const evaluation = CognitiveFrictionEvaluationSchema.parse({
      rawScore,
      smoothedScore,
      level,
      signals,
      contributions,
      thresholdStatus,
      evaluatedAt: safeTimestamp,
    });

    this.lastEvaluation = evaluation;
    return evaluation;
  }
}