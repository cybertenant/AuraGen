import { randomUUID } from "crypto";
import {
  CognitiveFrictionEngine,
  CognitiveFrictionEvaluation,
  FrictionLevel,
  TelemetryBatchPayload,
  FrictionUpdatePayload,
  TelemetryAckPayload,
  AggregatedSignalsSchema,
} from "@auragen/shared";
import { PersistenceService } from "../../services/persistence.service.js";
import { logger } from "../../utils/logger.js";

interface SessionFrictionContext {
  sessionId: string;
  engine: CognitiveFrictionEngine;
  lastEvaluation: CognitiveFrictionEvaluation | null;
  lastPersistedAtMs: number;
  lastPersistedScore: number | null;
  lastPersistedLevel: FrictionLevel | null;
  updatedAtMs: number;
}

const MAX_ACTIVE_SESSIONS = 1000;
const SESSION_TTL_MS = 1000 * 60 * 60; // 1 hour
const DEFAULT_PERSIST_INTERVAL_MS = 10000; // ~10s

/**
 * Server-Authoritative Per-Session Friction Engine & Throttled Neon Persistence Service.
 *
 * Scaling Note:
 * For this single-instance Node.js architecture, per-session smoothing and threshold state
 * are maintained in a bounded in-memory Map. Horizontal scaling across multiple Node.js instances
 * will require shared session state in Redis and `@socket.io/redis-adapter`.
 */
export class FrictionSessionService {
  private readonly sessions = new Map<string, SessionFrictionContext>();
  private readonly persistenceService: PersistenceService;
  private readonly persistIntervalMs: number;

  constructor(
    persistenceService: PersistenceService = new PersistenceService(),
    persistIntervalMs: number = DEFAULT_PERSIST_INTERVAL_MS
  ) {
    this.persistenceService = persistenceService;
    this.persistIntervalMs = persistIntervalMs;
  }

  public getPersistenceService(): PersistenceService {
    return this.persistenceService;
  }

  public ensureSessionContext(sessionId: string): SessionFrictionContext {
    this.evictStaleSessions();

    let ctx = this.sessions.get(sessionId);
    if (!ctx) {
      ctx = {
        sessionId,
        engine: new CognitiveFrictionEngine(),
        lastEvaluation: null,
        lastPersistedAtMs: 0,
        lastPersistedScore: null,
        lastPersistedLevel: null,
        updatedAtMs: Date.now(),
      };
      this.sessions.set(sessionId, ctx);
    } else {
      ctx.updatedAtMs = Date.now();
    }
    return ctx;
  }

  public getSessionEvaluation(
    sessionId: string
  ): CognitiveFrictionEvaluation | null {
    return this.sessions.get(sessionId)?.lastEvaluation ?? null;
  }

  public resetSessionFriction(sessionId: string): void {
    const ctx = this.sessions.get(sessionId);
    if (ctx) {
      ctx.engine.reset();
      ctx.lastEvaluation = null;
      ctx.lastPersistedScore = null;
      ctx.lastPersistedLevel = null;
      ctx.updatedAtMs = Date.now();
    }
  }

  /**
   * Processes a validated TelemetryBatchPayload using the shared Day 4 CognitiveFrictionEngine,
   * persists to Neon PostgreSQL when persistence rules match, and returns authoritative payloads.
   */
  public async processTelemetryBatch(
    sessionId: string,
    batch: TelemetryBatchPayload,
    nowMs = Date.now()
  ): Promise<{
    ack: TelemetryAckPayload;
    frictionUpdate: FrictionUpdatePayload;
    previousLevel: FrictionLevel | null;
  }> {
    const startedPerf = performance.now();
    const ctx = this.ensureSessionContext(sessionId);
    const previousLevel = ctx.lastEvaluation?.level ?? null;

    const evaluation = ctx.engine.evaluate(batch, nowMs);
    ctx.lastEvaluation = evaluation;
    ctx.updatedAtMs = nowMs;

    const { persistedToDatabase, databaseAvailable } =
      await this.maybePersistSnapshot(ctx, batch, evaluation, nowMs);

    const processingTimeMs = Number(
      Math.max(0, performance.now() - startedPerf).toFixed(2)
    );
    const serverTimestamp = new Date(nowMs).toISOString();
    const batchId = randomUUID();

    const ack: TelemetryAckPayload = {
      status: "processed",
      batchId,
      sessionId,
      serverTimestamp,
      processingTimeMs,
      persistedToDatabase,
      databaseAvailable,
    };

    const frictionUpdate: FrictionUpdatePayload = {
      sessionId,
      rawScore: evaluation.rawScore,
      smoothedScore: evaluation.smoothedScore,
      level: evaluation.level,
      signals: evaluation.signals,
      contributions: evaluation.contributions,
      thresholdStatus: evaluation.thresholdStatus,
      persistedToDatabase,
      databaseAvailable,
      processingTimeMs,
      timestamp: serverTimestamp,
    };

    return {
      ack,
      frictionUpdate,
      previousLevel,
    };
  }

  private async maybePersistSnapshot(
    ctx: SessionFrictionContext,
    batch: TelemetryBatchPayload,
    evaluation: CognitiveFrictionEvaluation,
    nowMs: number
  ): Promise<{ persistedToDatabase: boolean; databaseAvailable: boolean }> {
    const roundedScore = Math.round(evaluation.smoothedScore);

    // Do not repeatedly save unchanged scores
    if (
      ctx.lastPersistedScore === roundedScore &&
      ctx.lastPersistedLevel === evaluation.level &&
      !evaluation.thresholdStatus.shouldTriggerAdaptationEvent
    ) {
      return { persistedToDatabase: false, databaseAvailable: true };
    }

    // Do not save an initial zero reading
    if (roundedScore === 0 && ctx.lastPersistedScore === null) {
      return { persistedToDatabase: false, databaseAvailable: true };
    }

    const elapsedMs = nowMs - ctx.lastPersistedAtMs;
    const isLevelTransition =
      ctx.lastPersistedLevel !== null &&
      ctx.lastPersistedLevel !== evaluation.level;
    const isSignificantScoreDelta =
      ctx.lastPersistedScore !== null &&
      Math.abs(roundedScore - ctx.lastPersistedScore) >= 12;
    const isHighFrictionAlert =
      evaluation.thresholdStatus.shouldTriggerAdaptationEvent ||
      (ctx.lastPersistedLevel !== "high" && evaluation.level === "high");

    const shouldPersist =
      ctx.lastPersistedScore === null ||
      elapsedMs >= this.persistIntervalMs ||
      isLevelTransition ||
      isSignificantScoreDelta ||
      isHighFrictionAlert;

    if (!shouldPersist) {
      return { persistedToDatabase: false, databaseAvailable: true };
    }

    try {
      const signals = AggregatedSignalsSchema.parse({
        hesitation_count: batch.hesitationCount,
        validation_errors: batch.validationErrors,
        repeated_clicks: batch.repeatedClicks,
        backtracking: batch.backtracks,
        cursor_anomaly_score: Math.round(batch.cursorAnomalyScore * 100),
        observation_window_seconds: batch.observationWindowSeconds,
      });

      await this.persistenceService.recordFrictionEvent(ctx.sessionId, {
        frictionScore: roundedScore,
        frictionLevel: evaluation.level,
        signals,
      });

      ctx.lastPersistedAtMs = nowMs;
      ctx.lastPersistedScore = roundedScore;
      ctx.lastPersistedLevel = evaluation.level;

      return { persistedToDatabase: true, databaseAvailable: true };
    } catch (error) {
      logger.warn("Graceful fallback: Failed to persist socket friction snapshot to Neon", {
        sessionId: ctx.sessionId,
        reason: error instanceof Error ? error.message : "Unknown DB error",
      });
      return { persistedToDatabase: false, databaseAvailable: false };
    }
  }

  private evictStaleSessions(): void {
    if (this.sessions.size <= MAX_ACTIVE_SESSIONS) return;
    const now = Date.now();
    for (const [id, ctx] of this.sessions.entries()) {
      if (now - ctx.updatedAtMs > SESSION_TTL_MS) {
        this.sessions.delete(id);
      }
    }
  }
}