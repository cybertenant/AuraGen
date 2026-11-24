import {
  AISecurityLimits,
  AISecurityViolation,
  DEFAULT_AI_SECURITY_LIMITS,
} from "./security.types.js";
import { createViolation } from "./security-errors.js";

// Reject ASCII C0/C1 control characters except standard space/tab/newline
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

// Reject HTML/script markup tags or HTML entity script smuggling
const HTML_TAG_REGEX = /<\s*\/?\s*[a-zA-Z!/?][^>]*>/;

function checkTextField(
  value: unknown,
  path: string,
  maxLength: number,
  violations: AISecurityViolation[]
): void {
  if (value === undefined || value === null) return;
  if (typeof value !== "string") {
    violations.push(
      createViolation(
        "SCHEMA_VALIDATION_ERROR",
        path,
        "Expected plain-text string value."
      )
    );
    return;
  }

  if (value.length > maxLength) {
    violations.push(
      createViolation(
        "TEXT_LENGTH_EXCEEDED",
        path,
        `Text length (${value.length}) exceeds maximum (${maxLength} characters).`
      )
    );
  }

  if (CONTROL_CHAR_REGEX.test(value)) {
    violations.push(
      createViolation(
        "CONTROL_CHARACTER_DETECTED",
        path,
        "Disallowed control character detected in text string."
      )
    );
  }

  if (HTML_TAG_REGEX.test(value)) {
    violations.push(
      createViolation(
        "HTML_INJECTION_DETECTED",
        path,
        "Raw HTML or markup tags are prohibited in adaptive UI text."
      )
    );
  }
}

export function validateStringContentSafety(
  candidate: Record<string, unknown>,
  limits: AISecurityLimits = DEFAULT_AI_SECURITY_LIMITS
): AISecurityViolation[] {
  const violations: AISecurityViolation[] = [];

  checkTextField(candidate.title, "$.title", limits.maxTitleLength, violations);
  checkTextField(
    candidate.description,
    "$.description",
    limits.maxDescriptionLength,
    violations
  );

  if (Array.isArray(candidate.steps)) {
    candidate.steps.forEach((rawStep, stepIdx) => {
      if (!rawStep || typeof rawStep !== "object") return;
      const step = rawStep as Record<string, unknown>;
      const stepPath = `$.steps[${stepIdx}]`;

      checkTextField(
        step.title,
        `${stepPath}.title`,
        limits.maxTitleLength,
        violations
      );
      checkTextField(
        step.description,
        `${stepPath}.description`,
        limits.maxDescriptionLength,
        violations
      );

      if (Array.isArray(step.fields)) {
        step.fields.forEach((rawField, fieldIdx) => {
          if (!rawField || typeof rawField !== "object") return;
          const field = rawField as Record<string, unknown>;
          const fieldPath = `${stepPath}.fields[${fieldIdx}]`;

          checkTextField(
            field.helperText,
            `${fieldPath}.helperText`,
            limits.maxSupportingTextLength,
            violations
          );
          checkTextField(
            field.placeholder,
            `${fieldPath}.placeholder`,
            limits.maxSupportingTextLength,
            violations
          );
          checkTextField(
            field.hint,
            `${fieldPath}.hint`,
            limits.maxSupportingTextLength,
            violations
          );
        });
      }
    });
  }

  if (candidate.navigation && typeof candidate.navigation === "object") {
    const nav = candidate.navigation as Record<string, unknown>;
    checkTextField(
      nav.nextLabel,
      "$.navigation.nextLabel",
      limits.maxTitleLength,
      violations
    );
    checkTextField(
      nav.previousLabel,
      "$.navigation.previousLabel",
      limits.maxTitleLength,
      violations
    );
    checkTextField(
      nav.submitLabel,
      "$.navigation.submitLabel",
      limits.maxTitleLength,
      violations
    );
  }

  return violations;
}