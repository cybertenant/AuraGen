import { SanitizedGenerationContext } from "./context.types.js";
import { AdaptiveGenerationError } from "../errors/ai.errors.js";

const PROMPT_INJECTION_PATTERN =
  /(ignore\s+(all\s+)?previous\s+instructions|system\s*:|assistant\s*:|<\s*script|drop\s+table|reveal\s+api\s+key)/i;

/**
 * Strict Allowlist Context Sanitizer.
 * Reconstructs a clean object containing ONLY approved structural, progress, and
 * aggregated telemetry properties—guaranteeing PII, form values, DOM HTML, and
 * prompt injection strings never enter Gemini prompts.
 */
export function sanitizeGenerationContext(
  ctx: SanitizedGenerationContext
): SanitizedGenerationContext {
  const canonicalIds = new Set(ctx.formMetadata.fields.map((f) => f.fieldId));
  const validSectionIds = new Set(
    ctx.formMetadata.fields.map((f) => f.originalSectionId)
  );

  const currentSectionId = validSectionIds.has(
    ctx.formProgress.currentSectionId
  )
    ? ctx.formProgress.currentSectionId
    : "personal_information";

  const completedSet = new Set(
    ctx.formProgress.completedFieldIds.filter((id) => canonicalIds.has(id))
  );

  const completedFieldIds = Array.from(completedSet);
  const incompleteFieldIds = ctx.formMetadata.fields
    .map((f) => f.fieldId)
    .filter((id) => !completedSet.has(id));

  const activeFieldId =
    ctx.formProgress.activeFieldId &&
    canonicalIds.has(ctx.formProgress.activeFieldId)
      ? ctx.formProgress.activeFieldId
      : undefined;

  const sanitized: SanitizedGenerationContext = {
    formMetadata: {
      formId: ctx.formMetadata.formId,
      formTitle: ctx.formMetadata.formTitle,
      version: ctx.formMetadata.version,
      totalFields: ctx.formMetadata.totalFields,
      fields: ctx.formMetadata.fields.map((f) => ({
        fieldId: f.fieldId,
        componentType: f.componentType,
        label: f.label,
        required: Boolean(f.required),
        originalSectionId: f.originalSectionId,
        originalSectionTitle: f.originalSectionTitle,
        hasOptions: Boolean(f.hasOptions),
      })),
    },
    formProgress: {
      currentSectionId,
      ...(typeof ctx.formProgress.currentStepIndex === "number"
        ? { currentStepIndex: ctx.formProgress.currentStepIndex }
        : {}),
      ...(activeFieldId ? { activeFieldId } : {}),
      completedFieldIds,
      incompleteFieldIds,
    },
    friction: {
      source: ctx.friction.source,
      ...(ctx.friction.simulationScenarioId
        ? { simulationScenarioId: ctx.friction.simulationScenarioId }
        : {}),
      rawScore: Math.max(0, Math.min(100, Number(ctx.friction.rawScore))),
      smoothedScore: Math.max(
        0,
        Math.min(100, Number(ctx.friction.smoothedScore))
      ),
      frictionLevel: ctx.friction.frictionLevel,
      normalizedSignals: {
        hesitation: Number(ctx.friction.normalizedSignals.hesitation ?? 0),
        validationErrors: Number(
          ctx.friction.normalizedSignals.validationErrors ?? 0
        ),
        repeatedClicks: Number(
          ctx.friction.normalizedSignals.repeatedClicks ?? 0
        ),
        backtracking: Number(ctx.friction.normalizedSignals.backtracking ?? 0),
        cursorAnomaly: Number(
          ctx.friction.normalizedSignals.cursorAnomaly ?? 0
        ),
      },
      ...(ctx.friction.eligibilityReason
        ? {
            eligibilityReason: String(ctx.friction.eligibilityReason).slice(
              0,
              120
            ),
          }
        : {}),
      telemetryAgeMs: Math.max(0, Number(ctx.friction.telemetryAgeMs)),
      isStale: Boolean(ctx.friction.isStale),
      recentScoreTrend: ctx.friction.recentScoreTrend,
    },
    fieldAnalysis: {
      dominantSectionId: ctx.fieldAnalysis.dominantSectionId,
      dominantSectionTitle: ctx.fieldAnalysis.dominantSectionTitle,
      hasFieldLevelPrecision: Boolean(ctx.fieldAnalysis.hasFieldLevelPrecision),
      ...(ctx.fieldAnalysis.precisionLimitationNote
        ? {
            precisionLimitationNote: ctx.fieldAnalysis.precisionLimitationNote,
          }
        : {}),
      highFrictionFields: ctx.fieldAnalysis.highFrictionFields
        .filter((f) => canonicalIds.has(f.fieldId))
        .map((f) => ({
          fieldId: f.fieldId,
          label: f.label,
          sectionId: f.sectionId,
          focusCount: f.focusCount,
          hesitationCount: f.hesitationCount,
          validationErrorCount: f.validationErrorCount,
          repeatedInteractionCount: f.repeatedInteractionCount,
          totalFocusDurationMs: f.totalFocusDurationMs,
          fieldFrictionScore: f.fieldFrictionScore,
          difficultyReasons: [...f.difficultyReasons],
          requiresSimplification: Boolean(f.requiresSimplification),
        })),
      sectionSummaries: ctx.fieldAnalysis.sectionSummaries.map((s) => ({
        sectionId: s.sectionId,
        sectionTitle: s.sectionTitle,
        totalFieldFrictionScore: s.totalFieldFrictionScore,
        affectedFieldIds: s.affectedFieldIds.filter((id) =>
          canonicalIds.has(id)
        ),
        concentrationRatio: s.concentrationRatio,
      })),
    },
    ...(ctx.previousLayoutTitle
      ? { previousLayoutTitle: String(ctx.previousLayoutTitle).slice(0, 100) }
      : {}),
    ...(typeof ctx.previousLayoutStepCount === "number"
      ? { previousLayoutStepCount: ctx.previousLayoutStepCount }
      : {}),
  };

  const serialized = JSON.stringify(sanitized);
  if (PROMPT_INJECTION_PATTERN.test(serialized)) {
    throw new AdaptiveGenerationError(
      "CONTEXT_SANITIZATION_FAILED",
      "Context payload failed security sanitization check.",
      400,
      false
    );
  }

  return sanitized;
}