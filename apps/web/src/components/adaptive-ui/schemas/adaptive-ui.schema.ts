import { z } from "zod";
import {
  ADAPTIVE_SCHEMA_LIMITS,
  AdaptiveFieldReferenceSchema,
  createSafePlainTextSchema,
} from "./adaptive-field.schema";
import {
  AdaptiveSchemaValidationResult,
  AdaptiveUISchema,
  CanonicalFormDefinition,
  CanonicalLoanFieldId,
  SchemaValidationIssue,
} from "../types/adaptive-ui.types";

export const AdaptiveWizardStepSchema = z
  .object({
    id: z
      .string()
      .min(2, "Step ID must be at least 2 characters")
      .max(64, "Step ID must be at most 64 characters")
      .regex(
        /^[a-z][a-z0-9_-]*$/,
        "Step ID must be lowercase alphanumeric with underscores or hyphens"
      ),
    title: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxTitleLength,
      "Step title"
    ),
    description: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxDescriptionLength,
      "Step description"
    ).optional(),
    fields: z
      .array(AdaptiveFieldReferenceSchema)
      .min(1, "Each wizard step must contain at least 1 field")
      .max(
        ADAPTIVE_SCHEMA_LIMITS.maxFieldsPerStep,
        `A wizard step cannot contain more than ${ADAPTIVE_SCHEMA_LIMITS.maxFieldsPerStep} fields`
      ),
  })
  .strict();

export const AdaptiveNavigationSchema = z
  .object({
    nextLabel: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxNavLabelLength,
      "Next button label"
    ),
    previousLabel: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxNavLabelLength,
      "Previous button label"
    ),
    submitLabel: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxNavLabelLength,
      "Submit button label"
    ),
  })
  .strict();

export const AdaptiveAppearanceSchema = z
  .object({
    density: z.enum(["comfortable", "compact"]),
    showProgress: z.boolean(),
  })
  .strict();

export const AdaptiveUISchemaValidator = z
  .object({
    version: z.literal(ADAPTIVE_SCHEMA_LIMITS.supportedVersion),
    mode: z.literal("wizard"),
    title: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxTitleLength,
      "Wizard title"
    ),
    description: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxDescriptionLength,
      "Wizard description"
    ).optional(),
    steps: z
      .array(AdaptiveWizardStepSchema)
      .min(1, "Adaptive UI schema must define at least 1 step")
      .max(
        ADAPTIVE_SCHEMA_LIMITS.maxSteps,
        `Adaptive UI schema cannot exceed ${ADAPTIVE_SCHEMA_LIMITS.maxSteps} steps`
      ),
    navigation: AdaptiveNavigationSchema,
    appearance: AdaptiveAppearanceSchema,
  })
  .strict();

/**
 * Validates a proposed Adaptive UI JSON payload against both the strict Zod structure
 * and the Canonical Financial Form Definition.
 *
 * Enforces:
 * - Supported schema version (1) and strict object keys
 * - No unknown field IDs
 * - No duplicate field references across or within steps
 * - Complete coverage: every canonical field appears exactly once
 * - Unique step IDs
 * - No HTML/JSX tags or executable expressions
 */
export function validateAdaptiveUISchema(
  proposedSchema: unknown,
  formDefinition: CanonicalFormDefinition
): AdaptiveSchemaValidationResult {
  if (!formDefinition || !Array.isArray(formDefinition.fields)) {
    return {
      valid: false,
      schema: null,
      errors: [
        {
          path: "formDefinition",
          code: "MISSING_FORM_DEFINITION",
          message: "Canonical form definition is missing or invalid.",
        },
      ],
    };
  }

  const parsed = AdaptiveUISchemaValidator.safeParse(proposedSchema);
  if (!parsed.success) {
    const errors: SchemaValidationIssue[] = parsed.error.issues.map((issue) => ({
      path: issue.path.join(".") || "root",
      code: issue.code,
      message: issue.message,
    }));
    return {
      valid: false,
      schema: null,
      errors,
    };
  }

  const candidate = parsed.data;
  const issues: SchemaValidationIssue[] = [];
  const seenStepIds = new Set<string>();
  const seenFieldIds = new Set<string>();
  const canonicalFieldSet = new Set<string>(
    formDefinition.fields.map((f) => f.fieldId)
  );

  candidate.steps.forEach((step, stepIdx) => {
    if (seenStepIds.has(step.id)) {
      issues.push({
        path: `steps.${stepIdx}.id`,
        code: "DUPLICATE_STEP_ID",
        message: `Duplicate step ID "${step.id}" is not permitted.`,
      });
    }
    seenStepIds.add(step.id);

    step.fields.forEach((fieldRef, fieldIdx) => {
      const path = `steps.${stepIdx}.fields.${fieldIdx}.fieldId`;

      if (!canonicalFieldSet.has(fieldRef.fieldId)) {
        issues.push({
          path,
          code: "UNKNOWN_FIELD_ID",
          message: `Unknown canonical field reference "${fieldRef.fieldId}".`,
        });
        return;
      }

      if (seenFieldIds.has(fieldRef.fieldId)) {
        issues.push({
          path,
          code: "DUPLICATE_FIELD_ID",
          message: `Duplicate field reference "${fieldRef.fieldId}". Each canonical field must appear exactly once.`,
        });
        return;
      }

      seenFieldIds.add(fieldRef.fieldId);
    });
  });

  // Ensure no mandatory/canonical fields were silently omitted
  for (const canonicalField of formDefinition.fields) {
    if (!seenFieldIds.has(canonicalField.fieldId)) {
      issues.push({
        path: "steps",
        code: "MISSING_CANONICAL_FIELD",
        message: `Missing required canonical field "${canonicalField.fieldId}" (${canonicalField.label}).`,
      });
    }
  }

  if (issues.length > 0) {
    return {
      valid: false,
      schema: null,
      errors: issues,
    };
  }

  return {
    valid: true,
    schema: candidate as AdaptiveUISchema,
    errors: [],
  };
}