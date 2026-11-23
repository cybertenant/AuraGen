import { z } from "zod";

export const GENERATION_LIMITS = {
  supportedVersion: 1 as const,
  maxSteps: 8,
  maxFieldsPerStep: 8,
  maxTitleLength: 100,
  maxDescriptionLength: 300,
  maxHelperTextLength: 200,
  maxNavLabelLength: 40,
} as const;

const FORBIDDEN_MARKUP_OR_CODE_PATTERN =
  /(<\s*\/?\s*[a-zA-Z][^>]*>|\{\s*[^}]+\s*\}|\b(import|export|eval|Function|window|document|__proto__|constructor)\b|javascript:|on\w+\s*=)/i;

function safeText(maxLength: number, label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} cannot be empty`)
    .max(maxLength, `${label} exceeds ${maxLength} characters`)
    .refine(
      (val) => !FORBIDDEN_MARKUP_OR_CODE_PATTERN.test(val),
      `${label} contains disallowed markup or code expressions`
    );
}

export const PresentationGoalSchema = z.enum([
  "simplify_cognitive_load",
  "conversational_guided",
  "compact_executive",
]);

export const GenerateAdaptationRequestSchema = z
  .object({
    sessionId: z.string().uuid("Valid sessionId UUID is required"),
    presentationGoal: PresentationGoalSchema.default("simplify_cognitive_load"),
    triggerScore: z.number().min(0).max(100).optional(),
  })
  .strict();

export const GeneratedFieldReferenceZodSchema = z
  .object({
    fieldId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    helperText: safeText(
      GENERATION_LIMITS.maxHelperTextLength,
      "Helper text"
    ).optional(),
    placeholder: safeText(
      GENERATION_LIMITS.maxTitleLength,
      "Placeholder"
    ).optional(),
  })
  .strict();

export const GeneratedWizardStepZodSchema = z
  .object({
    id: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z][a-z0-9_-]*$/),
    title: safeText(GENERATION_LIMITS.maxTitleLength, "Step title"),
    description: safeText(
      GENERATION_LIMITS.maxDescriptionLength,
      "Step description"
    ).optional(),
    fields: z
      .array(GeneratedFieldReferenceZodSchema)
      .min(1)
      .max(GENERATION_LIMITS.maxFieldsPerStep),
  })
  .strict();

export const GeneratedAdaptiveUISchemaZod = z
  .object({
    version: z.literal(1),
    mode: z.literal("wizard"),
    title: safeText(GENERATION_LIMITS.maxTitleLength, "Wizard title"),
    description: safeText(
      GENERATION_LIMITS.maxDescriptionLength,
      "Wizard description"
    ).optional(),
    steps: z
      .array(GeneratedWizardStepZodSchema)
      .min(1)
      .max(GENERATION_LIMITS.maxSteps),
    navigation: z
      .object({
        nextLabel: safeText(GENERATION_LIMITS.maxNavLabelLength, "Next label"),
        previousLabel: safeText(
          GENERATION_LIMITS.maxNavLabelLength,
          "Previous label"
        ),
        submitLabel: safeText(
          GENERATION_LIMITS.maxNavLabelLength,
          "Submit label"
        ),
      })
      .strict(),
    appearance: z
      .object({
        density: z.enum(["comfortable", "compact"]),
        showProgress: z.boolean(),
      })
      .strict(),
  })
  .strict();