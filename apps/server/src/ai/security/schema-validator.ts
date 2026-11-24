import { BUSINESS_RULE_MUTATION_KEYS } from "./canonical-field-guard.js";
import {
  AISecurityLimits,
  AISecurityViolation,
  DEFAULT_AI_SECURITY_LIMITS,
} from "./security.types.js";
import { createViolation } from "./security-errors.js";

const ALLOWED_ROOT_KEYS = new Set([
  "version",
  "mode",
  "title",
  "description",
  "steps",
  "navigation",
  "appearance",
]);

const ALLOWED_STEP_KEYS = new Set([
  "id",
  "title",
  "description",
  "fields",
]);

const ALLOWED_FIELD_REF_KEYS = new Set([
  "fieldId",
  "helperText",
  "placeholder",
  "component",
  "label",
  "hint",
]);

const ALLOWED_NAVIGATION_KEYS = new Set([
  "nextLabel",
  "previousLabel",
  "submitLabel",
  "allowSkip",
]);

const ALLOWED_APPEARANCE_KEYS = new Set([
  "density",
  "showProgress",
  "highlightRequired",
]);

export function validateStrictSchemaStructure(
  candidate: Record<string, unknown>,
  limits: AISecurityLimits = DEFAULT_AI_SECURITY_LIMITS
): AISecurityViolation[] {
  const violations: AISecurityViolation[] = [];

  for (const key of Object.keys(candidate)) {
    if (!ALLOWED_ROOT_KEYS.has(key)) {
      violations.push(
        createViolation(
          "UNKNOWN_PROPERTY",
          `$.${key}`,
          `Unknown root property "${key}" is not allowed.`
        )
      );
    }
  }

  if (
    typeof candidate.version !== "number" ||
    !limits.supportedVersions.includes(candidate.version)
  ) {
    violations.push(
      createViolation(
        "UNSUPPORTED_SCHEMA_VERSION",
        "$.version",
        `Unsupported schema version: ${String(candidate.version)}.`
      )
    );
  }

  if (candidate.mode !== "wizard" && candidate.mode !== "guided") {
    violations.push(
      createViolation(
        "SCHEMA_VALIDATION_ERROR",
        "$.mode",
        `Unsupported adaptive UI mode: ${String(candidate.mode)}.`
      )
    );
  }

  if (typeof candidate.title !== "string" || candidate.title.trim().length === 0) {
    violations.push(
      createViolation(
        "SCHEMA_VALIDATION_ERROR",
        "$.title",
        "Schema title must be a non-empty string."
      )
    );
  }

  if (!Array.isArray(candidate.steps) || candidate.steps.length === 0) {
    violations.push(
      createViolation(
        "SCHEMA_VALIDATION_ERROR",
        "$.steps",
        "Schema must contain at least one step."
      )
    );
  } else {
    if (candidate.steps.length > limits.maxSteps) {
      violations.push(
        createViolation(
          "EXCESSIVE_STEPS",
          "$.steps",
          `Step count (${candidate.steps.length}) exceeds maximum (${limits.maxSteps}).`
        )
      );
    }

    const stepIds = new Set<string>();
    candidate.steps.forEach((rawStep, stepIdx) => {
      const stepPath = `$.steps[${stepIdx}]`;
      if (
        rawStep === null ||
        typeof rawStep !== "object" ||
        Array.isArray(rawStep)
      ) {
        violations.push(
          createViolation(
            "SCHEMA_VALIDATION_ERROR",
            stepPath,
            "Each step must be a plain object."
          )
        );
        return;
      }

      const step = rawStep as Record<string, unknown>;
      for (const k of Object.keys(step)) {
        if (!ALLOWED_STEP_KEYS.has(k)) {
          violations.push(
            createViolation(
              "UNKNOWN_PROPERTY",
              `${stepPath}.${k}`,
              `Unknown step property "${k}" is not allowed.`
            )
          );
        }
      }

      if (typeof step.id !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(step.id)) {
        violations.push(
          createViolation(
            "SCHEMA_VALIDATION_ERROR",
            `${stepPath}.id`,
            "Step id must be a valid alphanumeric/underscore identifier."
          )
        );
      } else if (stepIds.has(step.id)) {
        violations.push(
          createViolation(
            "SCHEMA_VALIDATION_ERROR",
            `${stepPath}.id`,
            `Duplicate step id "${step.id}".`
          )
        );
      } else {
        stepIds.add(step.id);
      }

      if (typeof step.title !== "string" || step.title.trim().length === 0) {
        violations.push(
          createViolation(
            "SCHEMA_VALIDATION_ERROR",
            `${stepPath}.title`,
            "Step title must be a non-empty string."
          )
        );
      }

      if (!Array.isArray(step.fields) || step.fields.length === 0) {
        violations.push(
          createViolation(
            "SCHEMA_VALIDATION_ERROR",
            `${stepPath}.fields`,
            "Each step must contain at least one field reference."
          )
        );
      } else {
        if (step.fields.length > limits.maxFieldsPerStep) {
          violations.push(
            createViolation(
              "EXCESSIVE_FIELDS_PER_STEP",
              `${stepPath}.fields`,
              `Step "${String(step.id)}" has ${step.fields.length} fields (max ${limits.maxFieldsPerStep}).`
            )
          );
        }

        step.fields.forEach((rawField, fieldIdx) => {
          const fieldPath = `${stepPath}.fields[${fieldIdx}]`;
          if (
            rawField === null ||
            typeof rawField !== "object" ||
            Array.isArray(rawField)
          ) {
            violations.push(
              createViolation(
                "SCHEMA_VALIDATION_ERROR",
                fieldPath,
                "Field reference must be a plain object."
              )
            );
            return;
          }

          const fieldObj = rawField as Record<string, unknown>;
          for (const fk of Object.keys(fieldObj)) {
            if (!ALLOWED_FIELD_REF_KEYS.has(fk) && !BUSINESS_RULE_MUTATION_KEYS.has(fk)) {
              violations.push(
                createViolation(
                  "UNKNOWN_PROPERTY",
                  `${fieldPath}.${fk}`,
                  `Unknown field property "${fk}" is not allowed.`
                )
              );
            }
          }

          if (
            typeof fieldObj.fieldId !== "string" ||
            fieldObj.fieldId.trim().length === 0
          ) {
            violations.push(
              createViolation(
                "SCHEMA_VALIDATION_ERROR",
                `${fieldPath}.fieldId`,
                "Field reference requires a valid string fieldId."
              )
            );
          }
        });
      }
    });
  }

  if (
    candidate.navigation === null ||
    typeof candidate.navigation !== "object" ||
    Array.isArray(candidate.navigation)
  ) {
    violations.push(
      createViolation(
        "SCHEMA_VALIDATION_ERROR",
        "$.navigation",
        "Navigation configuration must be an object."
      )
    );
  } else {
    const nav = candidate.navigation as Record<string, unknown>;
    for (const nk of Object.keys(nav)) {
      if (!ALLOWED_NAVIGATION_KEYS.has(nk)) {
        violations.push(
          createViolation(
            "UNKNOWN_PROPERTY",
            `$.navigation.${nk}`,
            `Unknown navigation property "${nk}".`
          )
        );
      }
    }
    for (const reqKey of ["nextLabel", "previousLabel", "submitLabel"]) {
      if (typeof nav[reqKey] !== "string" || (nav[reqKey] as string).trim().length === 0) {
        violations.push(
          createViolation(
            "SCHEMA_VALIDATION_ERROR",
            `$.navigation.${reqKey}`,
            `Navigation "${reqKey}" must be a non-empty string.`
          )
        );
      }
    }
  }

  if (
    candidate.appearance === null ||
    typeof candidate.appearance !== "object" ||
    Array.isArray(candidate.appearance)
  ) {
    violations.push(
      createViolation(
        "SCHEMA_VALIDATION_ERROR",
        "$.appearance",
        "Appearance configuration must be an object."
      )
    );
  } else {
    const app = candidate.appearance as Record<string, unknown>;
    for (const ak of Object.keys(app)) {
      if (!ALLOWED_APPEARANCE_KEYS.has(ak)) {
        violations.push(
          createViolation(
            "UNKNOWN_PROPERTY",
            `$.appearance.${ak}`,
            `Unknown appearance property "${ak}".`
          )
        );
      }
    }
    if (app.density !== "comfortable" && app.density !== "compact") {
      violations.push(
        createViolation(
          "SCHEMA_VALIDATION_ERROR",
          "$.appearance.density",
          `Invalid appearance density: ${String(app.density)}.`
        )
      );
    }
    if (typeof app.showProgress !== "boolean") {
      violations.push(
        createViolation(
          "SCHEMA_VALIDATION_ERROR",
          "$.appearance.showProgress",
          "appearance.showProgress must be a boolean."
        )
      );
    }
  }

  return violations;
}