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
export type EmploymentStatus = z.infer<typeof EmploymentStatusSchema>;
export type LoanPurpose = z.infer<typeof LoanPurposeSchema>;
export type CollateralType = z.infer<typeof CollateralTypeSchema>;
export type FinancialLoanApplication = z.infer<typeof FinancialLoanApplicationSchema>;