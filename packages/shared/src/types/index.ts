import { z } from "zod";
import {
  FrictionLevelSchema,
  InteractionStatusSchema,
  UIAdaptationStatusSchema,
  DbAdaptationRecordStatusSchema,
  FrictionSignalTypeSchema,
  FrictionSignalSchema,
  FrictionScoreSchema,
  SessionSchema,
  SessionRecordSchema,
  UpsertFormDraftInputSchema,
  FormDraftRecordSchema,
  AggregatedSignalsSchema,
  CreateFrictionEventInputSchema,
  FrictionEventRecordSchema,
  ValidationErrorCategorySchema,
  ValidationErrorSignalSchema,
  CursorAnomalyMetricsSchema,
  TelemetrySignalKindSchema,
  TelemetrySignalSchema,
  TelemetrySnapshotSchema,
  HealthResponseSchema,
  EmploymentStatusSchema,
  LoanPurposeSchema,
  CollateralTypeSchema,
  FinancialLoanApplicationSchema,
} from "../schemas/index.js";
import {
  SessionJoinPayloadSchema,
  SessionJoinAckSchema,
  TelemetryBatchPayloadSchema,
  SessionReadyPayloadSchema,
  TelemetryAckPayloadSchema,
  FrictionUpdatePayloadSchema,
  ServerErrorCodeSchema,
  ServerErrorPayloadSchema,
  FrictionStatePayloadSchema,
  FrictionAlertPayloadSchema,
  AdaptationEligiblePayloadSchema,
} from "../schemas/socket.schema.js";

export type FrictionLevel = z.infer<typeof FrictionLevelSchema>;
export type InteractionStatus = z.infer<typeof InteractionStatusSchema>;
export type UIAdaptationStatus = z.infer<typeof UIAdaptationStatusSchema>;
export type DbAdaptationRecordStatus = z.infer<typeof DbAdaptationRecordStatusSchema>;
export type FrictionSignalType = z.infer<typeof FrictionSignalTypeSchema>;
export type FrictionSignal = z.infer<typeof FrictionSignalSchema>;
export type FrictionScore = z.infer<typeof FrictionScoreSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type SessionRecord = z.infer<typeof SessionRecordSchema>;
export type UpsertFormDraftInput = z.infer<typeof UpsertFormDraftInputSchema>;
export type FormDraftRecord = z.infer<typeof FormDraftRecordSchema>;
export type AggregatedSignals = z.infer<typeof AggregatedSignalsSchema>;
export type CreateFrictionEventInput = z.infer<typeof CreateFrictionEventInputSchema>;
export type FrictionEventRecord = z.infer<typeof FrictionEventRecordSchema>;

export type ValidationErrorCategory = z.infer<typeof ValidationErrorCategorySchema>;
export type ValidationErrorSignal = z.infer<typeof ValidationErrorSignalSchema>;
export type CursorAnomalyMetrics = z.infer<typeof CursorAnomalyMetricsSchema>;
export type TelemetrySignalKind = z.infer<typeof TelemetrySignalKindSchema>;
export type TelemetrySignal = z.infer<typeof TelemetrySignalSchema>;
export type TelemetrySnapshot = z.infer<typeof TelemetrySnapshotSchema>;

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;
export type LoanPurpose = z.infer<typeof LoanPurposeSchema>;
export type CollateralType = z.infer<typeof CollateralTypeSchema>;
export type FinancialLoanApplication = z.infer<typeof FinancialLoanApplicationSchema>;

export type SessionJoinPayload = z.infer<typeof SessionJoinPayloadSchema>;
export type SessionJoinAck = z.infer<typeof SessionJoinAckSchema>;
export type TelemetryBatchPayload = z.infer<typeof TelemetryBatchPayloadSchema>;
export type SessionReadyPayload = z.infer<typeof SessionReadyPayloadSchema>;
export type TelemetryAckPayload = z.infer<typeof TelemetryAckPayloadSchema>;
export type FrictionUpdatePayload = z.infer<typeof FrictionUpdatePayloadSchema>;
export type ServerErrorCode = z.infer<typeof ServerErrorCodeSchema>;
export type ServerErrorPayload = z.infer<typeof ServerErrorPayloadSchema>;
export type FrictionStatePayload = z.infer<typeof FrictionStatePayloadSchema>;
export type FrictionAlertPayload = z.infer<typeof FrictionAlertPayloadSchema>;
export type AdaptationEligiblePayload = z.infer<typeof AdaptationEligiblePayloadSchema>;

/**
 * Socket.IO Strongly Typed Event Contracts (Day 1 + Day 5 + Day 6 Prepared)
 */
export interface ServerToClientEvents {
  // Day 1 legacy compatibility event
  "telemetry:acknowledged": (payload: {
    sessionId: string;
    score: number;
    level: FrictionLevel;
    interactionStatus: InteractionStatus;
    adaptationStatus: UIAdaptationStatus;
  }) => void;

  // Day 5 Server-Authoritative Events
  "session:ready": (payload: SessionReadyPayload) => void;
  "telemetry:ack": (payload: TelemetryAckPayload) => void;
  "friction:update": (payload: FrictionUpdatePayload) => void;
  "server:error": (payload: ServerErrorPayload) => void;

  // Day 6 Prepared Events
  "friction:state": (payload: FrictionStatePayload) => void;
  "friction:alert": (payload: FrictionAlertPayload) => void;
  "adaptation:eligible": (payload: AdaptationEligiblePayload) => void;
}

export interface ClientToServerEvents {
  // Day 1 legacy compatibility events
  "telemetry:simulate_high_friction": (payload: { sessionId: string }) => void;
  "telemetry:reset_friction": (payload: { sessionId: string }) => void;

  // Day 5 Client Events
  "session:join": (
    payload: unknown,
    ack?: (response: SessionJoinAck) => void
  ) => void;
  "telemetry:batch": (
    payload: unknown,
    ack?: (response: TelemetryAckPayload | ServerErrorPayload) => void
  ) => void;
}

export interface SocketData {
  sessionId?: string;
  joinedAt?: string;
}