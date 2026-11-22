import { z } from "zod";

export const ADAPTIVE_SCHEMA_LIMITS = {
  supportedVersion: 1 as const,
  maxSteps: 8,
  maxFieldsPerStep: 8,
  maxTitleLength: 100,
  maxDescriptionLength: 300,
  maxHelperTextLength: 200,
  maxNavLabelLength: 40,
} as const;

/**
 * Rejects strings containing HTML tags, JSX expressions, script protocols,
 * import statements, or executable code patterns.
 */
const FORBIDDEN_MARKUP_OR_CODE_PATTERN =
  /(<\s*\/?\s*[a-zA-Z][^>]*>|\{\s*[^}]+\s*\}|\b(import|export|eval|Function|window|document|__proto__|constructor)\b|javascript:|on\w+\s*=)/i;

export function createSafePlainTextSchema(
  maxLength: number,
  fieldLabel: string
) {
  return z
    .string()
    .trim()
    .min(1, `${fieldLabel} cannot be empty`)
    .max(maxLength, `${fieldLabel} exceeds maximum length of ${maxLength} characters`)
    .refine(
      (val) => !FORBIDDEN_MARKUP_OR_CODE_PATTERN.test(val),
      `${fieldLabel} contains disallowed markup, HTML/JSX tags, or code expressions`
    );
}

/**
 * Strict Adaptive Field Reference Schema.
 * Only permits `fieldId` plus optional plain-text `helperText` and `placeholder`.
 * Any attempt to inject `type`, `required`, `validation`, `options`, `component`,
 * or unknown properties is rejected by `.strict()`.
 */
export const AdaptiveFieldReferenceSchema = z
  .object({
    fieldId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, "Invalid fieldId identifier format"),
    helperText: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxHelperTextLength,
      "Helper text"
    ).optional(),
    placeholder: createSafePlainTextSchema(
      ADAPTIVE_SCHEMA_LIMITS.maxTitleLength,
      "Placeholder"
    ).optional(),
  })
  .strict();