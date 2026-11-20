import {
  AggregatedSignalsSchema,
  TelemetryBatchPayload,
} from "@auragen/shared";
import {
  AdaptiveThresholdConfig,
  createAdaptiveConfig,
} from "./adaptive.config.js";
import {
  AdaptiveEvaluationOutcome,
  AdaptiveSessionState,
  Clock,
  SystemClock,
} from "./adaptive.types.js";
import {
  createInitialAdaptiveSessionState,
  evaluateAdaptiveStateTransition,
} from "./adaptive-state-machine.js";
import {
  buildAdaptiveSocketPayloads,
  BuiltAdaptiveSocketPayloads,
} from "./adaptive-events.js";
import { PersistenceService } from "../services/persistence.service.js";
import { logger } from "../utils/logger.js";

export interface AdaptiveOrchestrationResult {
  outcome: AdaptiveEvaluationOutcome;
  socketPayloads: BuiltAdaptiveSocketPayloads;
  persistedTransition: boolean;
  databaseAvailable: boolean;
}

/**
 * Per-Session Adaptive Friction Threshold Orchestrator.
 *
 * Scaling Note:
 * Maintains bounded, isolated per-session state in memory (`maxTrackedSessions` with TTL eviction)
 * suitable for single-instance deployment. Multi-instance horizontal scaling will require
 * externalizing session state to Redis and using `@socket.io/redis-adapter`.
 */
export class AdaptiveFrictionOrchestrator {
  private readonly sessionStates = new Map<string, AdaptiveSessionState>();
  private readonly config: AdaptiveThresholdConfig;
  private readonly clock: Clock;
  private readonly persistenceService?: PersistenceService;

  constructor(options: {
    config?: Partial<AdaptiveThresholdConfig>;
    clock?: Clock;
    persistenceService?: PersistenceService;
  } = {}) {
    this.config = createAdaptiveConfig(options.config);
    this.clock = options.clock ?? SystemClock;
    this.persistenceService = options.persistenceService;
  }

  public getConfig(): AdaptiveThresholdConfig {
    return this.config;
  }

  public getSessionState(sessionId: string): AdaptiveSessionState {
    this.evictAbandonedSessions();
    let state = this.sessionStates.get(sessionId);
    if (!state) {
      state = createInitialAdaptiveSessionState(sessionId);
      this.sessionStates.set(sessionId, state);
    }
    return state;
  }

  public resetSession(sessionId: string): void {
    this.sessionStates.set(
      sessionId,
      createInitialAdaptiveSessionState(sessionId)
    );
  }

  public removeSession(sessionId: string): void {
    this.sessionStates.delete(sessionId);
  }

  public getTrackedSessionCount(): number {
    return this.sessionStates.size;
  }

  /**
   * Evaluates a server-authoritative friction score for a specific session, updates its
   * isolated state machine, persists significant state transitions to Neon `friction_events`,
   * and returns strongly typed Socket.IO event payloads.
   */
  public async evaluateSessionScore(
    sessionId: string,
    authoritativeSmoothedScore: number,
    batch?: TelemetryBatchPayload,
    explicitTimestampMs?: number
  ): Promise<AdaptiveOrchestrationResult> {
    const nowMs = explicitTimestampMs ?? this.clock.now();
    const current = this.getSessionState(sessionId);

    const outcome = evaluateAdaptiveStateTransition(
      current,
      authoritativeSmoothedScore,
      nowMs,
      this.config
    );

    this.sessionStates.set(sessionId, outcome.sessionState);

    const serverTimestampIso = new Date(nowMs).toISOString();
    const socketPayloads = buildAdaptiveSocketPayloads(
      outcome,
      this.config,
      serverTimestampIso
    );

    const { persistedTransition, databaseAvailable } =
      await this.maybePersistOrchestrationEvent(outcome, batch);

    return {
      outcome,
      socketPayloads,
      persistedTransition,
      databaseAvailable,
    };
  }

  private async maybePersistOrchestrationEvent(
    outcome: AdaptiveEvaluationOutcome,
    batch?: TelemetryBatchPayload
  ): Promise<{ persistedTransition: boolean; databaseAvailable: boolean }> {
    if (!this.persistenceService || !outcome.shouldPersistTransition) {
      return { persistedTransition: false, databaseAvailable: true };
    }

    // Persist significant transitions: eligibility, recovery, alerts, or state changes
    const significantEvents = outcome.emittedEvents.filter(
      (ev) =>
        ev === "adaptation_eligible" ||
        ev === "friction_recovered" ||
        ev === "sustained_high_friction_alert" ||
        ev === "candidate_started" ||
        ev === "inactivity_candidate_reset"
    );

    if (
      significantEvents.length === 0 &&
      outcome.previousState === outcome.sessionState.state
    ) {
      return { persistedTransition: false, databaseAvailable: true };
    }

    try {
      const signals = AggregatedSignalsSchema.parse({
        hesitation_count: batch?.hesitationCount ?? 0,
        validation_errors: batch?.validationErrors ?? 0,
        repeated_clicks: batch?.repeatedClicks ?? 0,
        backtracking: batch?.backtracks ?? 0,
        cursor_anomaly_score: Math.round((batch?.cursorAnomalyScore ?? 0) * 100),
        observation_window_seconds: batch?.observationWindowSeconds ?? 30,
      });

      await this.persistenceService.recordFrictionEvent(
        outcome.sessionState.sessionId,
        {
          frictionScore: Math.round(outcome.score),
          frictionLevel: outcome.level,
          signals,
        }
      );

      return { persistedTransition: true, databaseAvailable: true };
    } catch (error) {
      logger.warn(
        "Graceful fallback: Failed to persist adaptive orchestration transition to Neon",
        {
          sessionId: outcome.sessionState.sessionId,
          state: outcome.sessionState.state,
          reason: error instanceof Error ? error.message : "Unknown DB error",
        }
      );
      return { persistedTransition: false, databaseAvailable: false };
    }
  }

  private evictAbandonedSessions(): void {
    if (this.sessionStates.size <= this.config.maxTrackedSessions) return;
    const now = this.clock.now();
    for (const [id, st] of this.sessionStates.entries()) {
      if (
        st.lastTelemetryAtMs !== null &&
        now - st.lastTelemetryAtMs > this.config.sessionTtlMs
      ) {
        this.sessionStates.delete(id);
      }
    }
  }
}