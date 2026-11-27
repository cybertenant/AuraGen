import { z } from "zod";

/** Guardrail 2: the complete list of components the renderer may ever show. */
export const ApprovedComponentSchema = z.enum([
  "text",
  "number",
  "select",
  "checkbox",
  "textarea",
]);

export const FrictionLevelSchema = z.enum(["low", "medium", "high"]);

/** Privacy-conscious, aggregated interaction signals (no raw coordinates). */
export const FrictionSignalsSchema = z
  .object({
    hesitationMs: z.number().min(0).max(600000).default(0),
    validationErrors: z.number().int().min(0).max(100).default(0),
    backtracks: z.number().int().min(0).max(100).default(0),
    repeatedClicks: z.number().int().min(0).max(100).default(0),
  })
  .strict();

const SafeTokenSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Must be a safe identifier token");

const OptionSchema = z
  .object({
    value: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
    label: z.string().min(1).max(80),
  })
  .strict();

/** Guardrail 1 & 2: one approved field in a generated UI schema. */
export const GeneratedFieldSchema = z
  .object({
    id: SafeTokenSchema,
    label: z.string().min(1).max(120),
    component: ApprovedComponentSchema,
    placeholder: z.string().max(120).optional(),
    options: z.array(OptionSchema).max(12).optional(),
    required: z.boolean().default(true),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (field.component === "select" && !field.options?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "A select field needs at least one option",
      });
    }
    if (field.component !== "select" && field.options) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Only select fields may declare options",
      });
    }
  });

export const GeneratedStepSchema = z
  .object({
    id: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(160),
    helperText: z.string().max(300).optional(),
    fields: z.array(GeneratedFieldSchema).min(1).max(5),
  })
  .strict();

/** The only JSON shape an AI generator is allowed to return. */
export const GeneratedUiSchema = z
  .object({
    schemaVersion: z.literal(1),
    sessionId: z.string().min(1).max(80),
    reason: z.string().max(300).optional(),
    steps: z.array(GeneratedStepSchema).min(1).max(5),
  })
  .strict();

/**
 * Guardrail 3: the ONLY context sent to an AI provider.
 * It is strict and has no `answers` / `values` / `formData` member.
 */
export const SanitizedContextSchema = z
  .object({
    sessionId: z.string().min(1).max(80),
    frictionScore: z.number().min(0).max(100),
    frictionLevel: FrictionLevelSchema,
    fieldIds: z.array(SafeTokenSchema).max(20),
  })
  .strict();

export const AdaptRequestSchema = z
  .object({
    sessionId: z.string().min(1).max(80),
    signals: FrictionSignalsSchema,
    fieldIds: z.array(SafeTokenSchema).min(1).max(20),
  })
  .strict();

export type ApprovedComponent = z.infer<typeof ApprovedComponentSchema>;
export type FrictionLevel = z.infer<typeof FrictionLevelSchema>;
export type FrictionSignals = z.infer<typeof FrictionSignalsSchema>;
export type GeneratedField = z.infer<typeof GeneratedFieldSchema>;
export type GeneratedStep = z.infer<typeof GeneratedStepSchema>;
export type GeneratedUi = z.infer<typeof GeneratedUiSchema>;
export type SanitizedContext = z.infer<typeof SanitizedContextSchema>;
export type AdaptRequest = z.infer<typeof AdaptRequestSchema>;
