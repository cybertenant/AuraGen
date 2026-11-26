import { z } from "zod";

export const AdaptationLifecycleStatusSchema = z.enum([
  "generated",
  "validated",
  "rendered",
  "failed",
]);

export type AdaptationLifecycleStatus = z.infer<
  typeof AdaptationLifecycleStatusSchema
>;

export const AdaptationGeneratingEventSchema = z.object({
  sessionId: z.string().uuid(),
  generationId: z.string().uuid(),
  status: z.literal("generating"),
  timestamp: z.string(),
});

export type AdaptationGeneratingEvent = z.infer<
  typeof AdaptationGeneratingEventSchema
>;

export const AdaptationReadyEventSchema = z.object({
  sessionId: z.string().uuid(),
  generationId: z.string().uuid(),
  adaptationId: z.string().uuid(),
  status: z.literal("validated"),
  schemaVersion: z.literal(1),
  schema: z.record(z.unknown()),
  timestamp: z.string(),
});

export type AdaptationReadyEvent = z.infer<typeof AdaptationReadyEventSchema>;

export const AdaptationFailedEventSchema = z.object({
  sessionId: z.string().uuid().optional(),
  generationId: z.string().uuid(),
  status: z.literal("failed"),
  errorCode: z.string().min(1).max(64),
  message: z.string().min(1).max(300),
  timestamp: z.string().optional(),
});

export type AdaptationFailedEvent = z.infer<typeof AdaptationFailedEventSchema>;

export const AdaptationRenderedAckSchema = z.object({
  sessionId: z.string().uuid(),
  adaptationId: z.string().uuid(),
  generationId: z.string().uuid(),
  schemaVersion: z.literal(1),
  rendered: z.literal(true),
});

export type AdaptationRenderedAck = z.infer<typeof AdaptationRenderedAckSchema>;

export const AdaptationRestoreRequestSchema = z.object({
  sessionId: z.string().uuid(),
});

export type AdaptationRestoreRequest = z.infer<
  typeof AdaptationRestoreRequestSchema
>;