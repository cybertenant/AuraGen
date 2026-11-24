import { SERVER_CANONICAL_LOAN_METADATA } from "../canonical/canonical-loan-metadata.js";
import type { SanitizedFormMetadata } from "../types/ai.types.js";
import { AISecurityViolation } from "./security.types.js";
import { createViolation } from "./security-errors.js";

export const BUSINESS_RULE_MUTATION_KEYS = new Set([
  "type",
  "fieldType",
  "inputType",
  "required",
  "isRequired",
  "optional",
  "min",
  "max",
  "minLength",
  "maxLength",
  "pattern",
  "regex",
  "options",
  "allowedOptions",
  "validation",
  "rules",
  "defaultValue",
]);

export function validateCanonicalFieldIntegrity(
  candidate: Record<string, unknown>,
  canonicalForm: SanitizedFormMetadata = SERVER_CANONICAL_LOAN_METADATA
): AISecurityViolation[] {
  const violations: AISecurityViolation[] = [];

  const canonicalFieldMap = new Map<
    string,
    { fieldId: string; required: boolean; componentType?: string }
  >();

  for (const field of canonicalForm.fields) {
    canonicalFieldMap.set(field.fieldId, {
      fieldId: field.fieldId,
      required: field.required,
      componentType: field.componentType,
    });
  }

  const seenFieldIds = new Set<string>();
  const steps = Array.isArray(candidate.steps) ? candidate.steps : [];

  steps.forEach((rawStep, stepIdx) => {
    if (!rawStep || typeof rawStep !== "object") return;
    const fields = Array.isArray((rawStep as Record<string, unknown>).fields)
      ? ((rawStep as Record<string, unknown>).fields as unknown[])
      : [];

    fields.forEach((rawField, fieldIdx) => {
      if (!rawField || typeof rawField !== "object") return;
      const fieldObj = rawField as Record<string, unknown>;
      const fieldPath = `$.steps[${stepIdx}].fields[${fieldIdx}]`;

      for (const key of Object.keys(fieldObj)) {
        if (BUSINESS_RULE_MUTATION_KEYS.has(key)) {
          violations.push(
            createViolation(
              "BUSINESS_RULE_MUTATION",
              `${fieldPath}.${key}`,
              `AI output cannot override canonical business/validation attribute "${key}".`
            )
          );
        }
      }

      const fieldId =
        typeof fieldObj.fieldId === "string" ? fieldObj.fieldId : "";
      if (!fieldId) return;

      if (!canonicalFieldMap.has(fieldId)) {
        violations.push(
          createViolation(
            "UNKNOWN_FIELD",
            `${fieldPath}.fieldId`,
            `Unknown canonical field reference "${fieldId}".`
          )
        );
        return;
      }

      if (seenFieldIds.has(fieldId)) {
        violations.push(
          createViolation(
            "DUPLICATE_FIELD",
            `${fieldPath}.fieldId`,
            `Duplicate canonical field reference "${fieldId}".`
          )
        );
        return;
      }

      seenFieldIds.add(fieldId);
    });
  });

  // Verify every canonical mandatory/registered field is present exactly once
  for (const [canonicalId] of canonicalFieldMap) {
    if (!seenFieldIds.has(canonicalId)) {
      violations.push(
        createViolation(
          "MISSING_REQUIRED_FIELD",
          "$.steps",
          `Missing canonical required form field "${canonicalId}".`
        )
      );
    }
  }

  return violations;
}