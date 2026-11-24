import { SERVER_CANONICAL_LOAN_METADATA } from "../canonical/canonical-loan-metadata.js";
import type { SanitizedFormMetadata } from "../types/ai.types.js";
import { validateGeneratedAdaptiveUI as runDay7CanonicalValidator } from "../validators/generated-ui.validator.js";
import { GeneratedAdaptiveUISchema } from "../types/ai.types.js";
import {
  AIOutputGuardResult,
  AISecurityLimits,
  AISecurityViolation,
  DEFAULT_AI_SECURITY_LIMITS,
} from "./security.types.js";
import { createViolation } from "./security-errors.js";
import { guardResponseSizeAndStructure } from "./response-size-guard.js";
import { validateStrictSchemaStructure } from "./schema-validator.js";
import { validateCanonicalFieldIntegrity } from "./canonical-field-guard.js";
import { validateComponentRegistrySecurity } from "./component-registry-guard.js";
import { validateStringContentSafety } from "./content-validator.js";

export interface ValidateAIOutputParams {
  rawOutput: unknown;
  canonicalFormDefinition?: SanitizedFormMetadata;
  limits?: AISecurityLimits;
}

function deepFreezeSchema<T>(obj: T): Readonly<T> {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item) => deepFreezeSchema(item));
  } else {
    for (const key of Object.keys(obj)) {
      deepFreezeSchema((obj as Record<string, unknown>)[key]);
    }
  }
  return Object.freeze(obj);
}

/**
 * Central AI Output Security Pipeline (Day 10).
 * Executes ordered defense-in-depth checks without mutating raw model output:
 * 1. Response size & structure guard
 * 2. Strict JSON parsing & depth / prototype-pollution checks
 * 3. Strict schema version, structure & unknown-property validation
 * 4. Canonical 17-field financial form integrity guard
 * 5. Component registry & executable code guard
 * 6. Untrusted plain-text content & HTML safety guard
 * 7. Day 7 canonical schema normalization & deep immutability freeze
 */
export function runAIOutputSecurityGuard(
  params: ValidateAIOutputParams
): AIOutputGuardResult {
  const limits = params.limits ?? DEFAULT_AI_SECURITY_LIMITS;
  const canonicalForm =
    params.canonicalFormDefinition ?? SERVER_CANONICAL_LOAN_METADATA;

  // 1 & 2. Size, JSON parsing, nesting depth, and dangerous property guard
  const parsed = guardResponseSizeAndStructure(params.rawOutput, limits);
  if (!parsed.ok || !parsed.value) {
    return {
      success: false,
      schema: null,
      validationStatus: "rejected",
      validationErrors: parsed.violations,
    };
  }

  // Deep clone so raw model output is never mutated
  const candidate = JSON.parse(JSON.stringify(parsed.value)) as Record<
    string,
    unknown
  >;

  // 3. Strict structural & unknown-property checks
  const structureViolations = validateStrictSchemaStructure(candidate, limits);
  if (structureViolations.length > 0) {
    return {
      success: false,
      schema: null,
      validationStatus: "rejected",
      validationErrors: structureViolations,
    };
  }

  // 4. Canonical financial form integrity (17/17 fields, no duplicates/mutations)
  const canonicalViolations = validateCanonicalFieldIntegrity(
    candidate,
    canonicalForm
  );
  if (canonicalViolations.length > 0) {
    return {
      success: false,
      schema: null,
      validationStatus: "rejected",
      validationErrors: canonicalViolations,
    };
  }

  // 5. Component registry allowlist & executable JSX/JS guard
  const componentViolations = validateComponentRegistrySecurity(candidate);
  if (componentViolations.length > 0) {
    return {
      success: false,
      schema: null,
      validationStatus: "rejected",
      validationErrors: componentViolations,
    };
  }

  // 6. String content & HTML safety checks
  const contentViolations = validateStringContentSafety(candidate, limits);
  if (contentViolations.length > 0) {
    return {
      success: false,
      schema: null,
      validationStatus: "rejected",
      validationErrors: contentViolations,
    };
  }

  // 7. Existing Day 7 canonical normalizer & Zod validator
  const day7Result = runDay7CanonicalValidator(candidate, canonicalForm);
  if (!day7Result.valid || !day7Result.schema) {
    const mapped: AISecurityViolation[] = (day7Result.errors ?? []).map(
      (err) =>
        createViolation("SCHEMA_VALIDATION_ERROR", err.path, err.message)
    );
    return {
      success: false,
      schema: null,
      validationStatus: "rejected",
      validationErrors:
        mapped.length > 0
          ? mapped
          : [
              createViolation(
                "SCHEMA_VALIDATION_ERROR",
                "$",
                "Generated schema failed canonical normalization."
              ),
            ],
    };
  }

  // Normalize into clean canonical presentation schema and deep-freeze
  const normalizedSchema: GeneratedAdaptiveUISchema = {
    version: 1,
    mode: day7Result.schema.mode,
    title: day7Result.schema.title.trim(),
    ...(day7Result.schema.description
      ? { description: day7Result.schema.description.trim() }
      : {}),
    steps: day7Result.schema.steps.map((step) => ({
      id: step.id.trim(),
      title: step.title.trim(),
      ...(step.description ? { description: step.description.trim() } : {}),
      fields: step.fields.map((f) => ({
        fieldId: f.fieldId,
        ...(f.helperText ? { helperText: f.helperText.trim() } : {}),
        ...(f.placeholder ? { placeholder: f.placeholder.trim() } : {}),
      })),
    })),
    navigation: {
      nextLabel: day7Result.schema.navigation.nextLabel.trim(),
      previousLabel: day7Result.schema.navigation.previousLabel.trim(),
      submitLabel: day7Result.schema.navigation.submitLabel.trim(),
    },
    appearance: {
      density: day7Result.schema.appearance.density,
      showProgress: Boolean(day7Result.schema.appearance.showProgress),
    },
  };

  return {
    success: true,
    schema: deepFreezeSchema(normalizedSchema),
    validationStatus: "valid",
    validationErrors: [],
  };
}