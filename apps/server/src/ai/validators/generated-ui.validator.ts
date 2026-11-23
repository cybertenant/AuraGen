import { GeneratedAdaptiveUISchemaZod } from "../schemas/generation.schema.js";
import {
  GeneratedAdaptiveUISchema,
  SanitizedFormMetadata,
} from "../types/ai.types.js";

export interface GeneratedUIValidationResult {
  valid: boolean;
  schema: GeneratedAdaptiveUISchema | null;
  errors: Array<{ path: string; code: string; message: string }>;
}

/**
 * Backend Day 7/8 Authoritative Validator.
 * Verifies that AI-generated JSON conforms strictly to the Day 7 Adaptive UI schema
 * and references every canonical field ID in `formMetadata` exactly once.
 */
export function validateGeneratedAdaptiveUI(
  candidate: unknown,
  formMetadata: SanitizedFormMetadata
): GeneratedUIValidationResult {
  const parsed = GeneratedAdaptiveUISchemaZod.safeParse(candidate);
  if (!parsed.success) {
    return {
      valid: false,
      schema: null,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.join(".") || "root",
        code: i.code,
        message: i.message,
      })),
    };
  }

  const schema = parsed.data;
  const errors: Array<{ path: string; code: string; message: string }> = [];
  const seenStepIds = new Set<string>();
  const seenFieldIds = new Set<string>();
  const canonicalFieldIds = new Set(formMetadata.fields.map((f) => f.fieldId));

  schema.steps.forEach((step, stepIdx) => {
    if (seenStepIds.has(step.id)) {
      errors.push({
        path: `steps.${stepIdx}.id`,
        code: "DUPLICATE_STEP_ID",
        message: `Duplicate step ID "${step.id}".`,
      });
    }
    seenStepIds.add(step.id);

    step.fields.forEach((fieldRef, fieldIdx) => {
      const path = `steps.${stepIdx}.fields.${fieldIdx}.fieldId`;
      if (!canonicalFieldIds.has(fieldRef.fieldId)) {
        errors.push({
          path,
          code: "UNKNOWN_FIELD_ID",
          message: `Unknown canonical field "${fieldRef.fieldId}".`,
        });
        return;
      }

      if (seenFieldIds.has(fieldRef.fieldId)) {
        errors.push({
          path,
          code: "DUPLICATE_FIELD_ID",
          message: `Duplicate field reference "${fieldRef.fieldId}".`,
        });
        return;
      }

      seenFieldIds.add(fieldRef.fieldId);
    });
  });

  for (const canonicalField of formMetadata.fields) {
    if (!seenFieldIds.has(canonicalField.fieldId)) {
      errors.push({
        path: "steps",
        code: "MISSING_CANONICAL_FIELD",
        message: `Missing mandatory canonical field "${canonicalField.fieldId}".`,
      });
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      schema: null,
      errors,
    };
  }

  return {
    valid: true,
    schema,
    errors: [],
  };
}