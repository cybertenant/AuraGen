import { z } from "zod";
import { FieldInteractionMetricsSchema } from "@auragen/shared";
import { PresentationGoalSchema } from "../schemas/generation.schema.js";

export const ContextualScenarioIdSchema = z.enum([
  "financial_information_friction",
  "employment_section_friction",
  "general_application_friction",
  "low_friction",
]);

export const ClientFormContextHintSchema = z
  .object({
    currentSectionId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z][a-z0-9_]*$/)
      .optional(),
    currentStepIndex: z.number().int().min(1).max(10).optional(),
    activeFieldId: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      .optional(),
    completedFieldIds: z
      .array(
        z
          .string()
          .min(1)
          .max(64)
          .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/)
      )
      .max(25)
      .optional(),
    fieldMetrics: z.array(FieldInteractionMetricsSchema).max(25).optional(),
  })
  .strict();

export const GenerateContextualAdaptationRequestSchema = z
  .object({
    sessionId: z.string().uuid("Valid sessionId UUID is required"),
    generationMode: z.enum(["standard", "contextual"]).default("contextual"),
    presentationGoal: PresentationGoalSchema.default("simplify_cognitive_load"),
    triggerScore: z.number().min(0).max(100).optional(),
    formContext: ClientFormContextHintSchema.optional(),
    simulationScenario: ContextualScenarioIdSchema.optional(),
  })
  .strict();