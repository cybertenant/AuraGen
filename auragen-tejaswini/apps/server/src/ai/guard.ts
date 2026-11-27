import {
  ApprovedComponentSchema,
  GeneratedUiSchema,
  SanitizedContextSchema,
  type GeneratedUi,
  type SanitizedContext,
} from "@tejaswini/shared";

export class GuardrailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GuardrailError";
  }
}

/**
 * Guardrails 1 & 2: nothing reaches the renderer unless it is valid JSON that
 * contains only approved components and no unexpected properties.
 */
export function validateGeneratedUi(input: unknown): GeneratedUi {
  const parsed = GeneratedUiSchema.safeParse(input);
  if (!parsed.success) {
    throw new GuardrailError(
      `Generated UI rejected: ${parsed.error.issues[0]?.message ?? "invalid schema"}`
    );
  }

  const approved = new Set<string>(ApprovedComponentSchema.options);
  for (const step of parsed.data.steps) {
    for (const field of step.fields) {
      if (!approved.has(field.component)) {
        throw new GuardrailError(`Unapproved component: ${field.component}`);
      }
    }
  }
  return parsed.data;
}

/** Guardrail 3: only a value-free context may be sent to an AI provider. */
export function sanitizeContext(input: unknown): SanitizedContext {
  const parsed = SanitizedContextSchema.safeParse(input);
  if (!parsed.success) {
    throw new GuardrailError(
      `Context rejected: ${parsed.error.issues[0]?.message ?? "invalid context"}`
    );
  }
  return parsed.data;
}
