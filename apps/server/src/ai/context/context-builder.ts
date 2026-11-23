import {
  CognitiveFrictionEvaluation,
  FieldInteractionMetrics,
} from "@auragen/shared";
import { SERVER_CANONICAL_LOAN_METADATA } from "../canonical/canonical-loan-metadata.js";
import { analyzeFieldFriction } from "./field-friction-analyzer.js";
import { sanitizeGenerationContext } from "./context-sanitizer.js";
import {
  ContextSummaryOutput,
  ContextualScenarioId,
  NormalizedSignals,
  SanitizedGenerationContext,
} from "./context.types.js";
import { CONTEXTUAL_SIMULATION_PRESETS } from "./context-utils.js";

const DEFAULT_ZERO_SIGNALS: NormalizedSignals = {
  hesitation: 0,
  validationErrors: 0,
  repeatedClicks: 0,
  backtracking: 0,
  cursorAnomaly: 0,
};

export interface BuildContextualGenerationInput {
  sessionId: string;
  serverEvaluation?: CognitiveFrictionEvaluation | null;
  serverFieldMetrics?: readonly FieldInteractionMetrics[];
  serverEligibilityReason?: string;
  serverTelemetryUpdatedAtMs?: number | null;
  recentFrictionScores?: number[];
  previousLayout?: { title: string; stepCount: number } | null;
  clientFormContext?: {
    currentSectionId?: string;
    currentStepIndex?: number;
    activeFieldId?: string;
    completedFieldIds?: string[];
    fieldMetrics?: FieldInteractionMetrics[];
  };
  simulationScenario?: ContextualScenarioId;
  nowMs?: number;
  staleThresholdMs?: number;
}

export function buildSanitizedGenerationContext(
  input: BuildContextualGenerationInput
): SanitizedGenerationContext {
  const nowMs = input.nowMs ?? Date.now();
  const staleThresholdMs = input.staleThresholdMs ?? 5 * 60 * 1000;

  if (input.simulationScenario) {
    const preset = CONTEXTUAL_SIMULATION_PRESETS[input.simulationScenario];
    const analysis = analyzeFieldFriction({
      formMetadata: SERVER_CANONICAL_LOAN_METADATA,
      fieldMetrics: preset.fieldMetrics,
      fallbackSectionId: preset.currentSectionId,
    });

    return sanitizeGenerationContext({
      formMetadata: SERVER_CANONICAL_LOAN_METADATA,
      formProgress: {
        currentSectionId: preset.currentSectionId,
        activeFieldId: preset.activeFieldId,
        completedFieldIds: preset.completedFieldIds,
        incompleteFieldIds: [],
      },
      friction: {
        source: "simulated_dev_scenario",
        simulationScenarioId: preset.id,
        rawScore: preset.rawScore,
        smoothedScore: preset.smoothedScore,
        frictionLevel: preset.frictionLevel,
        normalizedSignals: preset.normalizedSignals,
        eligibilityReason: preset.eligibilityReason,
        telemetryAgeMs: 0,
        isStale: false,
        recentScoreTrend:
          preset.frictionLevel === "high" ? "rising" : "stable",
      },
      fieldAnalysis: analysis,
      ...(input.previousLayout
        ? {
            previousLayoutTitle: input.previousLayout.title,
            previousLayoutStepCount: input.previousLayout.stepCount,
          }
        : {}),
    });
  }

  // Authoritative server-side friction state (never trust client-supplied scores)
  const evalData = input.serverEvaluation ?? null;
  const telemetryAgeMs =
    typeof input.serverTelemetryUpdatedAtMs === "number" &&
    input.serverTelemetryUpdatedAtMs > 0
      ? Math.max(0, nowMs - input.serverTelemetryUpdatedAtMs)
      : 0;
  const isStale =
    typeof input.serverTelemetryUpdatedAtMs === "number" &&
    input.serverTelemetryUpdatedAtMs > 0 &&
    telemetryAgeMs > staleThresholdMs;

  const effectiveFieldMetrics =
    input.serverFieldMetrics && input.serverFieldMetrics.length > 0
      ? input.serverFieldMetrics
      : input.clientFormContext?.fieldMetrics ?? [];

  const currentSectionId =
    input.clientFormContext?.currentSectionId ?? "personal_information";

  const analysis = analyzeFieldFriction({
    formMetadata: SERVER_CANONICAL_LOAN_METADATA,
    fieldMetrics: effectiveFieldMetrics,
    fallbackSectionId: currentSectionId,
  });

  const scores = input.recentFrictionScores ?? [];
  let recentScoreTrend: "rising" | "stable" | "falling" | "unavailable" =
    "unavailable";
  if (scores.length >= 2) {
    const newest = scores[0]!;
    const oldest = scores[scores.length - 1]!;
    if (newest - oldest >= 6) recentScoreTrend = "rising";
    else if (oldest - newest >= 6) recentScoreTrend = "falling";
    else recentScoreTrend = "stable";
  }

  return sanitizeGenerationContext({
    formMetadata: SERVER_CANONICAL_LOAN_METADATA,
    formProgress: {
      currentSectionId,
      currentStepIndex: input.clientFormContext?.currentStepIndex,
      activeFieldId: input.clientFormContext?.activeFieldId,
      completedFieldIds: input.clientFormContext?.completedFieldIds ?? [],
      incompleteFieldIds: [],
    },
    friction: {
      source: "server_authoritative_session",
      rawScore: evalData?.rawScore ?? 0,
      smoothedScore: evalData?.smoothedScore ?? 0,
      frictionLevel: evalData?.level ?? "low",
      normalizedSignals: evalData?.signals ?? DEFAULT_ZERO_SIGNALS,
      eligibilityReason: input.serverEligibilityReason,
      telemetryAgeMs,
      isStale,
      recentScoreTrend,
    },
    fieldAnalysis: analysis,
    ...(input.previousLayout
      ? {
          previousLayoutTitle: input.previousLayout.title,
          previousLayoutStepCount: input.previousLayout.stepCount,
        }
      : {}),
  });
}

export function summarizeContextForResponse(
  ctx: SanitizedGenerationContext
): ContextSummaryOutput {
  return {
    currentSection: ctx.formProgress.currentSectionId,
    dominantFrictionArea: ctx.fieldAnalysis.dominantSectionId,
    frictionLevel: ctx.friction.frictionLevel,
    smoothedScore: Math.round(ctx.friction.smoothedScore),
    source: ctx.friction.source,
    ...(ctx.friction.simulationScenarioId
      ? { simulationScenarioId: ctx.friction.simulationScenarioId }
      : {}),
    hasFieldLevelPrecision: ctx.fieldAnalysis.hasFieldLevelPrecision,
    highFrictionFieldIds: ctx.fieldAnalysis.highFrictionFields.map(
      (f) => f.fieldId
    ),
  };
}