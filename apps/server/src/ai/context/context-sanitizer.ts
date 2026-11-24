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
const PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous\s+)?instructions/i,
  /system\s+override/i,
  /reveal\s+(?:the\s+)?(?:api\s+key|credentials|secrets|env)/i,
  /output\s+raw\s+(?:database|credentials|env)/i,
  /disregard\s+(?:all\s+)?(?:prior\s+)?rules/i,
  /you\s+are\s+now\s+(?:in\s+)?developer\s+mode/i,
];

function assertNoPromptInjection(value: unknown, path = "$"): void {
  if (typeof value === "string") {
    if (PROMPT_INJECTION_PATTERNS.some((p) => p.test(value))) {
      throw new Error(`Context sanitization failed: prompt injection pattern detected at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => assertNoPromptInjection(item, `${path}[${idx}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoPromptInjection(v, `${path}.${k}`);
    }
  }
}
export function sanitizeGenerationContext(
  ctx: SanitizedGenerationContext
): SanitizedGenerationContext {
  assertNoPromptInjection(
  ctx);
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