import { FieldInteractionMetrics } from "@auragen/shared";
import { SanitizedFormMetadata } from "../types/ai.types.js";
import {
  FieldFrictionAnalysisReport,
  FieldFrictionSummary,
  SectionFrictionSummary,
} from "./context.types.js";

/**
 * Analyzes per-field aggregated interaction telemetry (never raw input values)
 * to pinpoint which canonical fields and sections exhibit concentrated interaction difficulty.
 */
export function analyzeFieldFriction(input: {
  formMetadata: SanitizedFormMetadata;
  fieldMetrics?: readonly FieldInteractionMetrics[];
  fallbackSectionId?: string;
}): FieldFrictionAnalysisReport {
  const canonicalById = new Map(
    input.formMetadata.fields.map((f) => [f.fieldId, f])
  );
  const metricsList = input.fieldMetrics ?? [];

  const fieldSummaries: FieldFrictionSummary[] = [];

  for (const rawMetric of metricsList) {
    const canonical = canonicalById.get(rawMetric.fieldId);
    if (!canonical) continue;

    const reasons: string[] = [];
    let score = 0;

    if (rawMetric.validationErrorCount >= 2) {
      reasons.push(
        `Repeated validation errors (${rawMetric.validationErrorCount})`
      );
      score += rawMetric.validationErrorCount * 22;
    } else if (rawMetric.validationErrorCount === 1) {
      reasons.push("Validation error recorded");
      score += 12;
    }

    if (rawMetric.hesitationCount >= 2) {
      reasons.push(
        `Prolonged hesitation events (${rawMetric.hesitationCount})`
      );
      score += rawMetric.hesitationCount * 18;
    } else if (rawMetric.hesitationCount === 1) {
      reasons.push("Single hesitation pause");
      score += 10;
    }

    if (rawMetric.repeatedInteractionCount >= 2) {
      reasons.push(
        `Repeated clicks/interactions (${rawMetric.repeatedInteractionCount})`
      );
      score += rawMetric.repeatedInteractionCount * 15;
    }

    // Prolonged duration alone only contributes when paired with hesitation, errors, or multiple refocuses
    if (
      rawMetric.totalFocusDurationMs >= 15000 &&
      (rawMetric.hesitationCount > 0 ||
        rawMetric.validationErrorCount > 0 ||
        rawMetric.focusCount >= 3)
    ) {
      reasons.push(
        `Extended focus duration (${Math.round(rawMetric.totalFocusDurationMs / 1000)}s across${rawMetric.focusCount} visits)`
      );
      score += 14;
    }

    const boundedScore = Math.min(100, score);
    const requiresSimplification = boundedScore >= 25;

    if (boundedScore > 0) {
      fieldSummaries.push({
        fieldId: canonical.fieldId,
        label: canonical.label,
        sectionId: canonical.originalSectionId,
        focusCount: rawMetric.focusCount,
        hesitationCount: rawMetric.hesitationCount,
        validationErrorCount: rawMetric.validationErrorCount,
        repeatedInteractionCount: rawMetric.repeatedInteractionCount,
        totalFocusDurationMs: rawMetric.totalFocusDurationMs,
        fieldFrictionScore: boundedScore,
        difficultyReasons: reasons,
        requiresSimplification,
      });
    }
  }

  fieldSummaries.sort((a, b) => b.fieldFrictionScore - a.fieldFrictionScore);

  // Aggregate by canonical section without bleeding one field's score into unrelated sections
  const sectionMap = new Map<
    string,
    {
      sectionId: string;
      sectionTitle: string;
      totalFieldFrictionScore: number;
      affectedFieldIds: string[];
    }
  >();

  for (const field of input.formMetadata.fields) {
    if (!sectionMap.has(field.originalSectionId)) {
      sectionMap.set(field.originalSectionId, {
        sectionId: field.originalSectionId,
        sectionTitle: field.originalSectionTitle,
        totalFieldFrictionScore: 0,
        affectedFieldIds: [],
      });
    }
  }

  for (const summary of fieldSummaries) {
    const sec = sectionMap.get(summary.sectionId);
    if (sec) {
      sec.totalFieldFrictionScore += summary.fieldFrictionScore;
      if (summary.requiresSimplification) {
        sec.affectedFieldIds.push(summary.fieldId);
      }
    }
  }

  const totalAcrossSections = Array.from(sectionMap.values()).reduce(
    (acc, s) => acc + s.totalFieldFrictionScore,
    0
  );

  const sectionSummaries: SectionFrictionSummary[] = Array.from(
    sectionMap.values()
  )
    .map((s) => ({
      ...s,
      concentrationRatio:
        totalAcrossSections > 0
          ? Number((s.totalFieldFrictionScore / totalAcrossSections).toFixed(2))
          : 0,
    }))
    .sort((a, b) => b.totalFieldFrictionScore - a.totalFieldFrictionScore);

  const hasFieldLevelPrecision = fieldSummaries.some(
    (f) => f.requiresSimplification
  );

  const fallbackSection =
    sectionSummaries.find(
      (s) => s.sectionId === input.fallbackSectionId
    ) ?? sectionSummaries[0]!;

  const dominantSection = hasFieldLevelPrecision
    ? sectionSummaries[0]!
    : fallbackSection;

  return {
    dominantSectionId: dominantSection.sectionId,
    dominantSectionTitle: dominantSection.sectionTitle,
    hasFieldLevelPrecision,
    ...(hasFieldLevelPrecision
      ? {}
      : {
          precisionLimitationNote:
            "Field-level telemetry did not isolate a single high-friction input; using section-level interaction context.",
        }),
    highFrictionFields: fieldSummaries.filter((f) => f.requiresSimplification),
    sectionSummaries,
  };
}