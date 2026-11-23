import { FieldInteractionMetrics, FrictionLevel } from "@auragen/shared";
import { ContextualScenarioId, NormalizedSignals } from "./context.types.js";

export interface SimulatedScenarioPreset {
  id: ContextualScenarioId;
  title: string;
  description: string;
  currentSectionId: string;
  activeFieldId: string;
  completedFieldIds: string[];
  rawScore: number;
  smoothedScore: number;
  frictionLevel: FrictionLevel;
  normalizedSignals: NormalizedSignals;
  fieldMetrics: FieldInteractionMetrics[];
  eligibilityReason: string;
}

export const CONTEXTUAL_SIMULATION_PRESETS: Record<
  ContextualScenarioId,
  SimulatedScenarioPreset
> = {
  financial_information_friction: {
    id: "financial_information_friction",
    title: "Scenario 1 — Financial Information Friction",
    description:
      "Simulated high hesitation on annualIncome and repeated validation failures on existingMonthlyDebtObligations.",
    currentSectionId: "financial_information",
    activeFieldId: "existingMonthlyDebtObligations",
    completedFieldIds: [
      "fullName",
      "emailAddress",
      "phoneNumber",
      "residencyPostalCode",
      "employmentStatus",
      "employerOrEntityName",
      "yearsInCurrentRole",
    ],
    rawScore: 81,
    smoothedScore: 78,
    frictionLevel: "high",
    normalizedSignals: {
      hesitation: 0.75,
      validationErrors: 0.85,
      repeatedClicks: 0.4,
      backtracking: 0.3,
      cursorAnomaly: 0.35,
    },
    fieldMetrics: [
      {
        fieldId: "annualIncome",
        focusCount: 4,
        hesitationCount: 3,
        validationErrorCount: 1,
        repeatedInteractionCount: 1,
        totalFocusDurationMs: 26000,
      },
      {
        fieldId: "existingMonthlyDebtObligations",
        focusCount: 5,
        hesitationCount: 2,
        validationErrorCount: 4,
        repeatedInteractionCount: 3,
        totalFocusDurationMs: 29000,
      },
    ],
    eligibilityReason: "sustained_high_friction_in_financial_information",
  },
  employment_section_friction: {
    id: "employment_section_friction",
    title: "Scenario 2 — Employment Section Friction",
    description:
      "Simulated repeated interactions and long focus duration in employment_details with minimal friction elsewhere.",
    currentSectionId: "employment_details",
    activeFieldId: "employerOrEntityName",
    completedFieldIds: [
      "fullName",
      "emailAddress",
      "phoneNumber",
      "residencyPostalCode",
    ],
    rawScore: 72,
    smoothedScore: 70,
    frictionLevel: "high",
    normalizedSignals: {
      hesitation: 0.65,
      validationErrors: 0.45,
      repeatedClicks: 0.8,
      backtracking: 0.25,
      cursorAnomaly: 0.3,
    },
    fieldMetrics: [
      {
        fieldId: "employmentStatus",
        focusCount: 4,
        hesitationCount: 2,
        validationErrorCount: 1,
        repeatedInteractionCount: 3,
        totalFocusDurationMs: 18500,
      },
      {
        fieldId: "employerOrEntityName",
        focusCount: 5,
        hesitationCount: 2,
        validationErrorCount: 2,
        repeatedInteractionCount: 3,
        totalFocusDurationMs: 24000,
      },
    ],
    eligibilityReason: "sustained_high_friction_in_employment_details",
  },
  general_application_friction: {
    id: "general_application_friction",
    title: "Scenario 3 — General Application Friction",
    description:
      "Simulated elevated friction across financial_information, loan_details, and employment_details.",
    currentSectionId: "loan_details",
    activeFieldId: "requestedLoanAmount",
    completedFieldIds: ["fullName", "emailAddress"],
    rawScore: 84,
    smoothedScore: 80,
    frictionLevel: "high",
    normalizedSignals: {
      hesitation: 0.7,
      validationErrors: 0.7,
      repeatedClicks: 0.65,
      backtracking: 0.75,
      cursorAnomaly: 0.6,
    },
    fieldMetrics: [
      {
        fieldId: "yearsInCurrentRole",
        focusCount: 3,
        hesitationCount: 2,
        validationErrorCount: 1,
        repeatedInteractionCount: 2,
        totalFocusDurationMs: 17000,
      },
      {
        fieldId: "annualIncome",
        focusCount: 4,
        hesitationCount: 2,
        validationErrorCount: 2,
        repeatedInteractionCount: 2,
        totalFocusDurationMs: 21000,
      },
      {
        fieldId: "requestedLoanAmount",
        focusCount: 5,
        hesitationCount: 3,
        validationErrorCount: 2,
        repeatedInteractionCount: 3,
        totalFocusDurationMs: 25000,
      },
    ],
    eligibilityReason: "multi_section_sustained_high_friction",
  },
  low_friction: {
    id: "low_friction",
    title: "Scenario 4 — Low Friction Baseline",
    description:
      "Simulated smooth progression with low interaction friction; layout should stay close to canonical form structure.",
    currentSectionId: "personal_information",
    activeFieldId: "fullName",
    completedFieldIds: ["fullName", "emailAddress", "phoneNumber"],
    rawScore: 14,
    smoothedScore: 15,
    frictionLevel: "low",
    normalizedSignals: {
      hesitation: 0.05,
      validationErrors: 0,
      repeatedClicks: 0.05,
      backtracking: 0,
      cursorAnomaly: 0.08,
    },
    fieldMetrics: [],
    eligibilityReason: "manual_studio_low_friction_preview",
  },
};