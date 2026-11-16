"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  CognitiveFrictionEngine,
  CognitiveFrictionEvaluation,
  TelemetrySnapshot,
  TelemetrySnapshotSchema,
  AggregatedSignalsSchema,
} from "@auragen/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type FrictionSimulationScenario =
  | "normal"
  | "moderate"
  | "high_friction"
  | "spike_and_recovery";

export interface UseCognitiveFrictionEngineOptions {
  telemetryMetrics: TelemetrySnapshot;
  sessionId?: string | null;
  enablePersistence?: boolean;
  persistenceIntervalMs?: number;
  onSnapshotPersisted?: () => void;
}

export function useCognitiveFrictionEngine({
  telemetryMetrics,
  sessionId = null,
  enablePersistence = true,
  persistenceIntervalMs = 10000,
  onSnapshotPersisted,
}: UseCognitiveFrictionEngineOptions) {
  const engineRef = useRef<CognitiveFrictionEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new CognitiveFrictionEngine();
  }

  const [simulationOverride, setSimulationOverride] =
    useState<TelemetrySnapshot | null>(null);
  const [activeScenarioName, setActiveScenarioName] =
    useState<FrictionSimulationScenario | null>(null);

  const [persistenceStatus, setPersistenceStatus] = useState<{
    lastPersistedAt: string | null;
    lastPersistedScore: number | null;
    error: string | null;
    totalSavedCount: number;
  }>({
    lastPersistedAt: null,
    lastPersistedScore: null,
    error: null,
    totalSavedCount: 0,
  });

  const activeTelemetry = simulationOverride ?? telemetryMetrics;
  const activeTelemetryRef = useRef<TelemetrySnapshot>(activeTelemetry);
  activeTelemetryRef.current = activeTelemetry;

  const [evaluation, setEvaluation] = useState<CognitiveFrictionEvaluation>(() =>
    engineRef.current!.evaluate(activeTelemetry, Date.now())
  );

  // Track throttling state for Neon PostgreSQL writes
  const lastDbWriteAtRef = useRef<number>(0);
  const lastDbWrittenScoreRef = useRef<number | null>(null);
  const simulationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onSnapshotPersistedRef = useRef(onSnapshotPersisted);
  onSnapshotPersistedRef.current = onSnapshotPersisted;

  const clearSimulationTimers = useCallback(() => {
    simulationTimersRef.current.forEach((id) => clearTimeout(id));
    simulationTimersRef.current = [];
  }, []);

  const persistSnapshotToNeon = useCallback(
    async (
      currentEval: CognitiveFrictionEvaluation,
      snapshot: TelemetrySnapshot,
      force = false
    ) => {
      if (!enablePersistence || !sessionId) return;

      const now = Date.now();
      const roundedScore = Math.round(currentEval.smoothedScore);
      const prevWrittenScore = lastDbWrittenScoreRef.current;

      // Avoid writing zero baseline unless forced
      if (!force && roundedScore === 0 && prevWrittenScore === null) {
        return;
      }

      // Avoid duplicate records for unchanged scores
      if (!force && prevWrittenScore === roundedScore) {
        return;
      }

      const elapsedSinceLastWrite = now - lastDbWriteAtRef.current;
      const isSignificantDelta =
        prevWrittenScore !== null && Math.abs(roundedScore - prevWrittenScore) >= 12;
      const isEligibilityTrigger =
        currentEval.thresholdStatus.shouldTriggerAdaptationEvent;

      if (
        !force &&
        !isEligibilityTrigger &&
        !isSignificantDelta &&
        elapsedSinceLastWrite < persistenceIntervalMs
      ) {
        return;
      }

      lastDbWriteAtRef.current = now;
      lastDbWrittenScoreRef.current = roundedScore;

      try {
        const aggregatedSignals = AggregatedSignalsSchema.parse({
          hesitation_count: snapshot.hesitationCount,
          validation_errors: snapshot.validationErrors,
          repeated_clicks: snapshot.repeatedClicks,
          backtracking: snapshot.backtracks,
          cursor_anomaly_score: Math.round(snapshot.cursorAnomalyScore * 100),
          observation_window_seconds: snapshot.observationWindowSeconds,
        });

        const res = await fetch(
          `${API_BASE}/api/sessions/${sessionId}/friction-events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              frictionScore: roundedScore,
              frictionLevel: currentEval.level,
              signals: aggregatedSignals,
            }),
          }
        );

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(
            errBody.message || `Persistence HTTP ${res.status}`
          );
        }

        setPersistenceStatus((prev) => ({
          lastPersistedAt: new Date().toISOString(),
          lastPersistedScore: roundedScore,
          error: null,
          totalSavedCount: prev.totalSavedCount + 1,
        }));

        onSnapshotPersistedRef.current?.();
      } catch (err) {
        // Graceful degradation: engine & dashboard continue operating if Neon is offline
        setPersistenceStatus((prev) => ({
          ...prev,
          error:
            err instanceof Error
              ? err.message
              : "Database temporarily unavailable",
        }));
      }
    },
    [enablePersistence, persistenceIntervalMs, sessionId]
  );

  const syncEvaluationState = useCallback((nextEval: CognitiveFrictionEvaluation) => {
    setEvaluation((prev) => {
      if (
        prev.rawScore === nextEval.rawScore &&
        prev.smoothedScore === nextEval.smoothedScore &&
        prev.level === nextEval.level &&
        prev.thresholdStatus.state === nextEval.thresholdStatus.state &&
        prev.thresholdStatus.isEligibleForAdaptation ===
          nextEval.thresholdStatus.isEligibleForAdaptation &&
        prev.thresholdStatus.shouldTriggerAdaptationEvent ===
          nextEval.thresholdStatus.shouldTriggerAdaptationEvent
      ) {
        return prev;
      }
      return nextEval;
    });
  }, []);

  // Re-evaluate immediately whenever active telemetry changes
  useEffect(() => {
    const nextEval = engineRef.current!.evaluate(activeTelemetry, Date.now());
    syncEvaluationState(nextEval);
    void persistSnapshotToNeon(nextEval, activeTelemetry);
  }, [activeTelemetry, persistSnapshotToNeon, syncEvaluationState]);

  // Continuous 1-second evaluation tick so sustained 5s high-friction timers and cooldowns progress accurately
  useEffect(() => {
    const intervalId = setInterval(() => {
      const currentSnap = activeTelemetryRef.current;
      const nextEval = engineRef.current!.evaluate(currentSnap, Date.now());
      syncEvaluationState(nextEval);
      void persistSnapshotToNeon(nextEval, currentSnap);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [persistSnapshotToNeon, syncEvaluationState]);

  // Cleanup simulation timers on unmount
  useEffect(() => {
    return () => clearSimulationTimers();
  }, [clearSimulationTimers]);

  /**
   * Injects deterministic telemetry snapshots through the SAME scoring pipeline
   * (never forces raw scores directly to 100).
   */
  const runSimulationScenario = useCallback(
    (scenario: FrictionSimulationScenario) => {
      clearSimulationTimers();
      setActiveScenarioName(scenario);

      if (scenario === "normal") {
        setSimulationOverride(
          TelemetrySnapshotSchema.parse({
            observationWindowSeconds: 30,
            fieldFocusCount: 3,
            hesitationCount: 0,
            totalFieldFocusDurationMs: 4200,
            validationErrors: 0,
            repeatedClicks: 1,
            backtracks: 0,
            cursorAnomalyScore: 0.12,
          })
        );
        return;
      }

      if (scenario === "moderate") {
        setSimulationOverride(
          TelemetrySnapshotSchema.parse({
            observationWindowSeconds: 30,
            fieldFocusCount: 6,
            hesitationCount: 2,
            totalFieldFocusDurationMs: 18500,
            validationErrors: 1,
            repeatedClicks: 2,
            backtracks: 1,
            cursorAnomalyScore: 0.45,
          })
        );
        return;
      }

      if (scenario === "high_friction") {
        // Inject realistic multi-signal high-friction telemetry (rawScore ~ 87.33)
        // Exponential smoothing (0.65 prev + 0.35 raw) climbs smoothly over ~3s above 65
        // and sustains >= 65 for 5s to fire adaptation eligibility.
        setSimulationOverride(
          TelemetrySnapshotSchema.parse({
            observationWindowSeconds: 30,
            fieldFocusCount: 9,
            hesitationCount: 3,
            totalFieldFocusDurationMs: 28000,
            validationErrors: 3,
            repeatedClicks: 3,
            backtracks: 2,
            cursorAnomalyScore: 0.72,
          })
        );
        return;
      }

      if (scenario === "spike_and_recovery") {
        // Phase 1: High telemetry spike
        setSimulationOverride(
          TelemetrySnapshotSchema.parse({
            observationWindowSeconds: 30,
            fieldFocusCount: 8,
            hesitationCount: 3,
            totalFieldFocusDurationMs: 25000,
            validationErrors: 3,
            repeatedClicks: 4,
            backtracks: 2,
            cursorAnomalyScore: 0.85,
          })
        );

        // Phase 2: After 2.5s (before 5s sustained eligibility), user recovers to calm interaction
        const recoveryTimer = setTimeout(() => {
          setSimulationOverride(
            TelemetrySnapshotSchema.parse({
              observationWindowSeconds: 30,
              fieldFocusCount: 4,
              hesitationCount: 0,
              totalFieldFocusDurationMs: 3000,
              validationErrors: 0,
              repeatedClicks: 0,
              backtracks: 0,
              cursorAnomalyScore: 0.05,
            })
          );
        }, 2500);
        simulationTimersRef.current.push(recoveryTimer);
      }
    },
    [clearSimulationTimers]
  );

  const clearSimulation = useCallback(() => {
    clearSimulationTimers();
    setSimulationOverride(null);
    setActiveScenarioName(null);
  }, [clearSimulationTimers]);

  const resetFrictionEngine = useCallback(() => {
    clearSimulation();
    engineRef.current!.reset();
    lastDbWrittenScoreRef.current = null;
    const freshEval = engineRef.current!.evaluate(telemetryMetrics, Date.now());
    setEvaluation(freshEval);
  }, [clearSimulation, telemetryMetrics]);

  return {
    evaluation,
    activeScenarioName,
    isSimulationActive: simulationOverride !== null,
    persistenceStatus,
    runSimulationScenario,
    clearSimulation,
    resetFrictionEngine,
  };
}