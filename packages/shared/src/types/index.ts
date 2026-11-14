import { z } from "zod";
import {
  FrictionLevelSchema,
  InteractionStatusSchema,
  UIAdaptationStatusSchema,
  FrictionSignalTypeSchema,
  FrictionSignalSchema,
  FrictionScoreSchema,
  SessionSchema,
  HealthResponseSchema,
} from "../schemas/index.js";

export type FrictionLevel = z.infer<typeof FrictionLevelSchema>;
export type InteractionStatus = z.infer<typeof InteractionStatusSchema>;
export type UIAdaptationStatus = z.infer<typeof UIAdaptationStatusSchema>;
export type FrictionSignalType = z.infer<typeof FrictionSignalTypeSchema>;
export type FrictionSignal = z.infer<typeof FrictionSignalSchema>;
export type FrictionScore = z.infer<typeof FrictionScoreSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/**
 * Socket.IO Strongly Typed Event Contracts
 */
export interface ServerToClientEvents {
  "telemetry:acknowledged": (payload: {
    sessionId: string;
    score: number;
    level: FrictionLevel;
    interactionStatus: InteractionStatus;
    adaptationStatus: UIAdaptationStatus;
  }) => void;
}

export interface ClientToServerEvents {
  "telemetry:simulate_high_friction": (payload: { sessionId: string }) => void;
  "telemetry:reset_friction": (payload: { sessionId: string }) => void;
}