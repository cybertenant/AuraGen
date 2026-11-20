import { z } from "zod";
import { FrictionLevelSchema } from "./index.js";
import {
  AdaptationEligibilityResultSchema,
  NormalizedFrictionSignalsSchema,
  SignalContributionBreakdownSchema,
} from "./friction.schema.js";

/**
 * Client-to-Server: session:join
 * Note: An anonymous session UUID is suitable only for synthetic demo data.
 * Authenticated session ownership checks (JWT/OAuth) are required before production financial deployment.
 */
export const SessionJoinPayloadSchema = z
  .object({
    sessionId: z.string().uuid("Invalid session UUID format"),
  })
  .strict();

export const SessionJoinAckSchema = z
  .object({
    ok: z.boolean(),
    sessionId: z.string().uuid().optional(),
    room: z.string().optional(),
    serverTimestamp: z.string().datetime(),
    errorCode: z.string().optional(),
    message: z.string().optional(),
  })
  .strict();

/**
 * Client-to-Server: telemetry:batch
 * Strictly rejects any extra properties (such as raw form values, passwords, or raw coordinates).
 */
export const TelemetryBatchPayloadSchema = z
  .object({
    observationWindowSeconds: z.number().int().positive().max(3600).default(30),
    fieldFocusCount: z.number().int().min(0).max(500).default(0),
    hesitationCount: z.number().int().min(0).max(200).default(0),
    totalFieldFocusDurationMs: z.number().min(0).max(3600000).optional().default(0),
    validationErrors: z.number().int().min(0).max(200).default(0),
    repeatedClicks: z.number().int().min(0).max(500).default(0),
    backtracks: z.number().int().min(0).max(200).default(0),
    cursorAnomalyScore: z.number().min(0).max(1).default(0),
  })
  .strict();

/**
 * Server-to-Client: session:ready
 */
export const SessionReadyPayloadSchema = z
  .object({
    sessionId: z.string().uuid(),
    room: z.string().min(1),
    serverTimestamp: z.string().datetime(),
    message: z.string(),
  })
  .strict();

/**
 * Server-to-Client: telemetry:ack
 */
export const TelemetryAckPayloadSchema = z
  .object({
    status: z.enum(["processed", "deduplicated"]),
    batchId: z.string().uuid(),
    sessionId: z.string().uuid(),
    serverTimestamp: z.string().datetime(),
    processingTimeMs: z.number().nonnegative(),
    persistedToDatabase: z.boolean(),
    databaseAvailable: z.boolean(),
  })
  .strict();

/**
 * Server-to-Client: friction:update (Authoritative backend calculation)
 */
export const FrictionUpdatePayloadSchema = z
  .object({
    sessionId: z.string().uuid(),
    rawScore: z.number().min(0).max(100),
    smoothedScore: z.number().min(0).max(100),
    level: FrictionLevelSchema,
    signals: NormalizedFrictionSignalsSchema,
    contributions: SignalContributionBreakdownSchema,
    thresholdStatus: AdaptationEligibilityResultSchema,
    persistedToDatabase: z.boolean(),
    databaseAvailable: z.boolean(),
    processingTimeMs: z.number().nonnegative(),
    timestamp: z.string().datetime(),
  })
  .strict();

/**
 * Server-to-Client: server:error
 */
export const ServerErrorCodeSchema = z.enum([
  "INVALID_SESSION_UUID",
  "SESSION_NOT_FOUND",
  "UNAUTHORIZED_SESSION",
  "INVALID_TELEMETRY_PAYLOAD",
  "RATE_LIMIT_EXCEEDED",
  "DATABASE_UNAVAILABLE",
  "INTERNAL_SOCKET_ERROR",
]);

export const ServerErrorPayloadSchema = z
  .object({
    code: ServerErrorCodeSchema,
    message: z.string(),
    timestamp: z.string().datetime(),
  })
  .strict();

/**
 * Day 6 Adaptive Friction Orchestration Event Schemas
 */
export const AdaptiveOrchestrationStateSchema = z.enum([
  "MONITORING",
  "HIGH_FRICTION_CANDIDATE",
  "ADAPTATION_ELIGIBLE",
  "COOLDOWN",
  "RECOVERED",
]);

export const FrictionStatePayloadSchema = z
  .object({
    sessionId: z.string().uuid(),
    state: AdaptiveOrchestrationStateSchema,
    frictionScore: z.number().min(0).max(100),
    frictionLevel: FrictionLevelSchema,
    durationMs: z.number().nonnegative(),
    requiredDurationMs: z.number().positive(),
    cooldownRemainingMs: z.number().nonnegative(),
    episodeTriggered: z.boolean(),
    resetReason: z
      .enum(["none", "recovered_below_threshold", "inactivity_gap_exceeded"])
      .optional(),
    timestamp: z.string().datetime(),
  })
  .strict();

export const FrictionAlertPayloadSchema = z
  .object({
    sessionId: z.string().uuid(),
    alertType: z.enum([
      "candidate_started",
      "sustained_high_friction",
      "inactivity_candidate_reset",
    ]),
    frictionScore: z.number().min(0).max(100),
    frictionLevel: FrictionLevelSchema,
    durationMs: z.number().nonnegative(),
    message: z.string(),
    timestamp: z.string().datetime(),
  })
  .strict();

export const AdaptationEligiblePayloadSchema = z
  .object({
    sessionId: z.string().uuid(),
    eligible: z.literal(true),
    frictionScore: z.number().min(0).max(100),
    frictionLevel: FrictionLevelSchema,
    reason: z.literal("sustained_high_interaction_friction"),
    sustainedDurationMs: z.number().nonnegative(),
    cooldownDurationMs: z.number().nonnegative(),
    timestamp: z.string().datetime(),
  })
  .strict();

export const AdaptationDeferredPayloadSchema = z
  .object({
    sessionId: z.string().uuid(),
    deferred: z.literal(true),
    frictionScore: z.number().min(0).max(100),
    frictionLevel: FrictionLevelSchema,
    reason: z.enum([
      "cooldown_active",
      "episode_already_triggered_awaiting_recovery",
    ]),
    cooldownRemainingMs: z.number().nonnegative(),
    timestamp: z.string().datetime(),
  })
  .strict();

export const FrictionRecoveredPayloadSchema = z
  .object({
    sessionId: z.string().uuid(),
    recovered: z.literal(true),
    frictionScore: z.number().min(0).max(100),
    frictionLevel: FrictionLevelSchema,
    recoveryThreshold: z.number().min(0).max(100),
    cooldownRemainingMs: z.number().nonnegative(),
    timestamp: z.string().datetime(),
  })
  .strict();