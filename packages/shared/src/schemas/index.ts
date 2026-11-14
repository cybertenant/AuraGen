import { z } from "zod";

/**
 * Friction severity classification levels
 */
export const FrictionLevelSchema = z.enum(["low", "medium", "high"]);

/**
 * Interaction status shown in the UI telemetry monitor
 */
export const InteractionStatusSchema = z.enum([
  "Normal",
  "Elevated Friction",
  "High Cognitive Load",
]);

/**
 * Current state of the AI Generative UI adaptation engine
 */
export const UIAdaptationStatusSchema = z.enum([
  "Waiting",
  "Analyzing",
  "Adapting",
  "Adapted",
  "Fallback",
]);

/**
 * Individual user interaction telemetry signal
 */
export const FrictionSignalTypeSchema = z.enum([
  "hesitation",
  "repeated_click",
  "validation_error",
  "backtracking",
  "field_refocus",
]);

export const FrictionSignalSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  fieldId: z.string().min(1),
  type: FrictionSignalTypeSchema,
  timestamp: z.number().int().positive(),
  weight: z.number().min(0).max(100).default(10),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Calculated Cognitive Friction Score (0 - 100)
 */
export const FrictionScoreSchema = z.object({
  sessionId: z.string().uuid(),
  score: z.number().min(0).max(100),
  level: FrictionLevelSchema,
  interactionStatus: InteractionStatusSchema,
  adaptationStatus: UIAdaptationStatusSchema,
  updatedAt: z.string().datetime(),
});

/**
 * User form session state (Never stores raw sensitive financial values for AI)
 */
export const SessionSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  currentStep: z.string(),
  frictionScore: z.number().min(0).max(100).default(0),
  frictionLevel: FrictionLevelSchema.default("low"),
  adaptationStatus: UIAdaptationStatusSchema.default("Waiting"),
});

/**
 * Backend Health Response Schema
 */
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("auragen-server"),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  websocketReady: z.boolean(),
});