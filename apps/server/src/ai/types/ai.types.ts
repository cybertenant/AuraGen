export type PresentationGoal =
  | "simplify_cognitive_load"
  | "conversational_guided"
  | "compact_executive";

export type GenerationErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_API_KEY"
  | "UNSUPPORTED_MODEL"
  | "QUOTA_EXHAUSTED"
  | "RATE_LIMIT_EXCEEDED"
  | "DUPLICATE_IN_FLIGHT"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "MALFORMED_RESPONSE"
  | "SCHEMA_VALIDATION_FAILED"
  | "INVALID_SESSION"
  | "INVALID_REQUEST"
  | "PERSISTENCE_FAILED";

export interface SanitizedCanonicalFieldMetadata {
  readonly fieldId: string;
  readonly componentType:
    | "text"
    | "email"
    | "phone"
    | "number"
    | "select"
    | "date"
    | "textarea"
    | "radio"
    | "checkbox";
  readonly label: string;
  readonly required: boolean;
  readonly originalSectionId: string;
  readonly originalSectionTitle: string;
  readonly hasOptions: boolean;
}

export interface SanitizedFormMetadata {
  readonly formId: string;
  readonly formTitle: string;
  readonly version: number;
  readonly totalFields: number;
  readonly fields: readonly SanitizedCanonicalFieldMetadata[];
}

export interface GeneratedFieldReference {
  fieldId: string;
  helperText?: string;
  placeholder?: string;
}

export interface GeneratedWizardStep {
  id: string;
  title: string;
  description?: string;
  fields: GeneratedFieldReference[];
}

export interface GeneratedAdaptiveUISchema {
  version: 1;
  mode: "wizard";
  title: string;
  description?: string;
  steps: GeneratedWizardStep[];
  navigation: {
    nextLabel: string;
    previousLabel: string;
    submitLabel: string;
  };
  appearance: {
    density: "comfortable" | "compact";
    showProgress: boolean;
  };
}

export interface TokenUsageSummary {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AdaptiveUIGenerationResult {
  success: boolean;
  providerType: "gemini_live" | "test_mock";
  model: string;
  generationTimeMs: number;
  validationStatus: "valid" | "invalid";
  schema: GeneratedAdaptiveUISchema | null;
  validationErrors?: Array<{ path: string; code: string; message: string }>;
  errorCode?: GenerationErrorCode;
  errorMessage?: string;
  tokenUsage?: TokenUsageSummary;
}