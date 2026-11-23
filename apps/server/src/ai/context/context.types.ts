import { CognitiveFrictionEvaluation, FrictionLevel } from "@auragen/shared";
export type NormalizedSignals = CognitiveFrictionEvaluation["signals"];
import { SanitizedFormMetadata } from "../types/ai.types.js";

export type ContextualScenarioId =
  | "financial_information_friction"
  | "employment_section_friction"
  | "general_application_friction"
  | "low_friction";

export interface FieldFrictionSummary {
  fieldId: string;
  label: string;
  sectionId: string;
  focusCount: number;
  hesitationCount: number;
  validationErrorCount: number;
  repeatedInteractionCount: number;
  totalFocusDurationMs: number;
  fieldFrictionScore: number;
  difficultyReasons: string[];
  requiresSimplification: boolean;
}

export interface SectionFrictionSummary {
  sectionId: string;
  sectionTitle: string;
  totalFieldFrictionScore: number;
  affectedFieldIds: string[];
  concentrationRatio: number;
}

export interface FieldFrictionAnalysisReport {
  dominantSectionId: string;
  dominantSectionTitle: string;
  hasFieldLevelPrecision: boolean;
  precisionLimitationNote?: string;
  highFrictionFields: FieldFrictionSummary[];
  sectionSummaries: SectionFrictionSummary[];
}

export interface SanitizedFormProgressContext {
  currentSectionId: string;
  currentStepIndex?: number;
  activeFieldId?: string;
  completedFieldIds: string[];
  incompleteFieldIds: string[];
}

export interface SanitizedAuthoritativeFrictionContext {
  source: "server_authoritative_session" | "simulated_dev_scenario";
  simulationScenarioId?: ContextualScenarioId;
  rawScore: number;
  smoothedScore: number;
  frictionLevel: FrictionLevel;
  normalizedSignals: NormalizedSignals;
  eligibilityReason?: string;
  telemetryAgeMs: number;
  isStale: boolean;
  recentScoreTrend: "rising" | "stable" | "falling" | "unavailable";
}

export interface SanitizedGenerationContext {
  formMetadata: SanitizedFormMetadata;
  formProgress: SanitizedFormProgressContext;
  friction: SanitizedAuthoritativeFrictionContext;
  fieldAnalysis: FieldFrictionAnalysisReport;
  previousLayoutTitle?: string;
  previousLayoutStepCount?: number;
}

export interface ContextSummaryOutput {
  currentSection: string;
  dominantFrictionArea: string;
  frictionLevel: FrictionLevel;
  smoothedScore: number;
  source: "server_authoritative_session" | "simulated_dev_scenario";
  simulationScenarioId?: ContextualScenarioId;
  hasFieldLevelPrecision: boolean;
  highFrictionFieldIds: string[];
}