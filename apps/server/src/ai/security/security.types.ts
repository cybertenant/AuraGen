import type { GeneratedAdaptiveUISchema } from "../types/ai.types.js";

export interface AISecurityLimits {
  maxResponseBytes: number;
  maxNestingDepth: number;
  maxSteps: number;
  maxFieldsPerStep: number;
  maxTitleLength: number;
  maxDescriptionLength: number;
  maxSupportingTextLength: number;
  supportedVersions: readonly number[];
}

export const DEFAULT_AI_SECURITY_LIMITS: AISecurityLimits = Object.freeze({
  maxResponseBytes: 64 * 1024, // 64 KB
  maxNestingDepth: 8,
  maxSteps: 8,
  maxFieldsPerStep: 8,
  maxTitleLength: 100,
  maxDescriptionLength: 300,
  maxSupportingTextLength: 200,
  supportedVersions: [1],
});

export type AISecurityViolationCode =
  | "EMPTY_OUTPUT"
  | "OVERSIZED_RESPONSE"
  | "MALFORMED_JSON"
  | "INVALID_TOP_LEVEL_TYPE"
  | "EXCESSIVE_NESTING"
  | "DANGEROUS_PROPERTY"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "SCHEMA_VALIDATION_ERROR"
  | "UNKNOWN_PROPERTY"
  | "EXCESSIVE_STEPS"
  | "EXCESSIVE_FIELDS_PER_STEP"
  | "UNKNOWN_FIELD"
  | "DUPLICATE_FIELD"
  | "MISSING_REQUIRED_FIELD"
  | "BUSINESS_RULE_MUTATION"
  | "UNKNOWN_COMPONENT"
  | "EXECUTABLE_CODE_DETECTED"
  | "HTML_INJECTION_DETECTED"
  | "CONTROL_CHARACTER_DETECTED"
  | "TEXT_LENGTH_EXCEEDED";

export interface AISecurityViolation {
  code: AISecurityViolationCode;
  path: string;
  message: string;
}

export type AIOutputGuardResult =
  | {
      success: true;
      schema: Readonly<GeneratedAdaptiveUISchema>;
      validationStatus: "valid";
      validationErrors: [];
    }
  | {
      success: false;
      schema: null;
      validationStatus: "rejected";
      validationErrors: AISecurityViolation[];
    };