import { z } from "zod";

/**
 * Guided Session contract (Tejaswini contribution).
 *
 * This module extends the AuraGen guardrails to the guided, step-by-step
 * conversational UI:
 *  1. Only structured, Zod-validated JSON can describe a guided session.
 *  2. Only an explicitly approved set of components may be rendered.
 *  3. The context prepared for an AI request contains field IDs and friction
 *     metadata only - never a user's financial field values.
 */

export const GuidedComponentTypeSchema = z.enum([
  "text",
  "number",
  "select",
  "checkbox",
  "confirm",
]);

export const GuidedFrictionLevelSchema = z.enum(["low", "medium", "high"]);

export const GuidedOptionSchema = z
  .object({
    value: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, "Option values must be URL-safe tokens"),
    label: z.string().min(1).max(80),
  })
  .strict();

export const GuidedStepSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9-]+$/, "Step ids must be lowercase kebab-case"),
    fieldId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, "Field ids must be safe tokens"),
    title: z.string().min(1).max(160),
    helperText: z.string().max(300).optional(),
    component: GuidedComponentTypeSchema,
    options: z.array(GuidedOptionSchema).max(12).optional(),
    required: z.boolean().default(true),
  })
  .strict()
  .superRefine((step, ctx) => {
    if (step.component === "select" && !step.options?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "A select step requires at least one approved option",
      });
    }
    if (step.component !== "select" && step.options) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Only select steps may declare options",
      });
    }
  });

export const GuidedSessionSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(120),
    frictionLevel: GuidedFrictionLevelSchema,
    frictionScore: z.number().min(0).max(100),
    steps: z.array(GuidedStepSchema).min(1).max(8),
  })
  .strict();

/**
 * The ONLY shape that may be handed to an AI provider for guided sessions.
 * It deliberately has no `answers`, `value`, or `formData` member, and is
 * strict so extra keys (including leaked values) are rejected.
 */
export const SanitizedGuidedContextSchema = z
  .object({
    sessionId: z.string().uuid(),
    frictionLevel: GuidedFrictionLevelSchema,
    frictionScore: z.number().min(0).max(100),
    fieldIds: z.array(z.string().max(64)).max(8),
    visibleStepIndex: z.number().int().nonnegative(),
  })
  .strict();

export type GuidedComponentType = z.infer<typeof GuidedComponentTypeSchema>;
export type GuidedStep = z.infer<typeof GuidedStepSchema>;
export type GuidedSession = z.infer<typeof GuidedSessionSchema>;
export type SanitizedGuidedContext = z.infer<
  typeof SanitizedGuidedContextSchema
>;

export function buildSanitizedGuidedContext(
  session: GuidedSession,
  visibleStepIndex: number
): SanitizedGuidedContext {
  return SanitizedGuidedContextSchema.parse({
    sessionId: session.id,
    frictionLevel: session.frictionLevel,
    frictionScore: session.frictionScore,
    fieldIds: session.steps.map((step) => step.fieldId),
    visibleStepIndex,
  });
}
