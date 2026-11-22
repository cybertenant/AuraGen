import type { FinancialLoanApplication } from "@auragen/shared";

export type ApprovedComponentType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "select"
  | "date"
  | "textarea"
  | "radio"
  | "checkbox";

export type CanonicalLoanFieldId = keyof FinancialLoanApplication;

export interface SelectOrRadioOption {
  readonly value: string | number;
  readonly label: string;
  readonly description?: string;
}

export interface CanonicalFieldValidationRules {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly min?: number;
  readonly max?: number;
  readonly pattern?: RegExp;
  readonly patternMessage?: string;
  readonly valueAsNumber?: boolean;
}

export interface CanonicalFieldDefinition {
  readonly fieldId: CanonicalLoanFieldId;
  readonly componentType: ApprovedComponentType;
  readonly label: string;
  readonly placeholder?: string;
  readonly defaultHelperText?: string;
  readonly required: boolean;
  readonly originalSectionId: string;
  readonly originalSectionTitle: string;
  readonly options?: readonly SelectOrRadioOption[];
  readonly validation: CanonicalFieldValidationRules;
}

export interface CanonicalFormDefinition {
  readonly formId: string;
  readonly formTitle: string;
  readonly version: number;
  readonly fields: readonly CanonicalFieldDefinition[];
  readonly fieldMap: Readonly<Record<CanonicalLoanFieldId, CanonicalFieldDefinition>>;
}

export interface AdaptiveFieldReference {
  fieldId: CanonicalLoanFieldId;
  helperText?: string;
  placeholder?: string;
}

export interface AdaptiveWizardStep {
  id: string;
  title: string;
  description?: string;
  fields: AdaptiveFieldReference[];
}

export interface AdaptiveNavigationConfig {
  nextLabel: string;
  previousLabel: string;
  submitLabel: string;
}

export interface AdaptiveAppearanceConfig {
  density: "comfortable" | "compact";
  showProgress: boolean;
}

export interface AdaptiveUISchema {
  version: 1;
  mode: "wizard";
  title: string;
  description?: string;
  steps: AdaptiveWizardStep[];
  navigation: AdaptiveNavigationConfig;
  appearance: AdaptiveAppearanceConfig;
}

export interface SchemaValidationIssue {
  path: string;
  code: string;
  message: string;
}

export interface AdaptiveSchemaValidationResult {
  valid: boolean;
  schema: AdaptiveUISchema | null;
  errors: SchemaValidationIssue[];
}