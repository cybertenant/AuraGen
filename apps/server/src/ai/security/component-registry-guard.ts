import { AISecurityViolation } from "./security.types.js";
import { createViolation } from "./security-errors.js";

/**
 * Explicit allowlist matching Day 7 Approved React Component Registry.
 */
export const APPROVED_ADAPTIVE_COMPONENTS = new Set([
  "text",
  "email",
  "phone",
  "number",
  "date",
  "select",
  "radio",
  "checkbox",
  "textarea",
  "AdaptiveTextField",
  "AdaptiveEmailField",
  "AdaptivePhoneField",
  "AdaptiveNumberField",
  "AdaptiveDateField",
  "AdaptiveSelectField",
  "AdaptiveRadioField",
  "AdaptiveCheckboxField",
  "AdaptiveTextareaField",
]);

const EXECUTABLE_CODE_PATTERNS: readonly RegExp[] = [
  /<\s*[a-zA-Z][a-zA-Z0-9.-]*\b[^>]*>/, // JSX / HTML tags
  /\b(?:eval|Function|setTimeout|setInterval)\s*\(/,
  /\b(?:import|require)\s*\(/,
  /\bimport\s+[\w*{}\s,]+\s+from\s+['"]/,
  /\bexport\s+(?:default\s+)?(?:function|const|class)\b/,
  /javascript\s*:/i,
  /on(?:click|load|error|focus|blur|change|input|mouseover)\s*=/i,
  /\$\{[^}]+\}/,
];

function containsExecutableExpression(value: string): boolean {
  return EXECUTABLE_CODE_PATTERNS.some((pattern) => pattern.test(value));
}

export function validateComponentRegistrySecurity(
  candidate: Record<string, unknown>
): AISecurityViolation[] {
  const violations: AISecurityViolation[] = [];

  const inspectStrings = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      if (containsExecutableExpression(node)) {
        violations.push(
          createViolation(
            "EXECUTABLE_CODE_DETECTED",
            path,
            "Executable JavaScript, JSX, or dynamic import expression detected in schema."
          )
        );
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => inspectStrings(item, `${path}[${idx}]`));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        inspectStrings(v, `${path}.${k}`);
      }
    }
  };

  inspectStrings(candidate, "$");

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

      if ("component" in fieldObj && fieldObj.component !== undefined) {
        if (
          typeof fieldObj.component !== "string" ||
          !APPROVED_ADAPTIVE_COMPONENTS.has(fieldObj.component)
        ) {
          violations.push(
            createViolation(
              "UNKNOWN_COMPONENT",
              `${fieldPath}.component`,
              `Component "${String(fieldObj.component)}" is not in the approved Day 7 component registry.`
            )
          );
        }
      }
    });
  });

  return violations;
}