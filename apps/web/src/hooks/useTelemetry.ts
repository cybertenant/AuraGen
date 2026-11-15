"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  TelemetrySnapshot,
  TelemetrySnapshotSchema,
  ValidationErrorCategory,
  ValidationErrorSignalSchema,
  AggregatedSignals,
  AggregatedSignalsSchema,
} from "@auragen/shared";

export interface UseTelemetryOptions {
  enabled?: boolean;
  consentGranted?: boolean;
  observationWindowSeconds?: number;
  hesitationThresholdMs?: number;
  repeatedClickThresholdCount?: number;
  repeatedClickWindowMs?: number;
  pointerSampleIntervalMs?: number;
}

interface TimestampedEvent {
  timestamp: number;
  targetId: string;
}

interface DurationEvent extends TimestampedEvent {
  durationMs: number;
}

interface ValidationEvent extends TimestampedEvent {
  category: ValidationErrorCategory;
}

interface PointerAnomalySample {
  timestamp: number;
  velocityPxPerMs: number;
  isDirectionReversal: boolean;
  isBurst: boolean;
}

interface LastPointerPoint {
  x: number;
  y: number;
  timestamp: number;
  vx: number;
  vy: number;
}

interface ActiveFieldState {
  fieldId: string;
  startedAt: number;
  hesitationRecorded: boolean;
  timerId: ReturnType<typeof setTimeout> | null;
}

function resolveStableTargetId(target: EventTarget | null): {
  fieldId: string | null;
  actionId: string | null;
  sectionIndex: number | null;
} {
  if (!target || !(target instanceof HTMLElement)) {
    return { fieldId: null, actionId: null, sectionIndex: null };
  }

  const fieldEl = target.closest("[data-auragen-field]");
  const actionEl = target.closest("[data-auragen-action]");
  const sectionEl = target.closest("[data-auragen-section-index]");

  const fieldId =
    fieldEl?.getAttribute("data-auragen-field") ||
    (target instanceof HTMLInputElement ||
    target instanceof HTMLSelectElement ||
    target instanceof HTMLTextAreaElement
      ? target.id || null
      : null);

  const actionId =
    actionEl?.getAttribute("data-auragen-action") ||
    fieldId ||
    (target instanceof HTMLButtonElement ? target.id || null : null);

  const rawSecIdx = sectionEl?.getAttribute("data-auragen-section-index");
  const parsedSecIdx =
    rawSecIdx !== null && rawSecIdx !== undefined ? Number(rawSecIdx) : NaN;

  return {
    fieldId,
    actionId,
    sectionIndex: Number.isFinite(parsedSecIdx) ? parsedSecIdx : null,
  };
}

export function useTelemetry(options: UseTelemetryOptions = {}) {
  const {
    enabled = true,
    consentGranted = true,
    observationWindowSeconds = 30,
    hesitationThresholdMs = 8000,
    repeatedClickThresholdCount = 3,
    repeatedClickWindowMs = 2000,
    pointerSampleIntervalMs = 60,
  } = options;

  const isTrackingActive = enabled && consentGranted;
  const windowMs = observationWindowSeconds * 1000;

  const containerElementRef = useRef<HTMLElement | null>(null);
  const [boundContainer, setBoundContainer] = useState<HTMLElement | null>(null);

  const containerRef = useCallback((node: HTMLElement | null) => {
    containerElementRef.current = node;
    setBoundContainer(node);
  }, []);

  // Rolling window event stores in refs to avoid high-frequency React re-renders
  const focusEventsRef = useRef<TimestampedEvent[]>([]);
  const focusDurationsRef = useRef<DurationEvent[]>([]);
  const hesitationEventsRef = useRef<TimestampedEvent[]>([]);
  const repeatedClickEventsRef = useRef<TimestampedEvent[]>([]);
  const validationEventsRef = useRef<ValidationEvent[]>([]);
  const backtrackEventsRef = useRef<TimestampedEvent[]>([]);
  const pointerSamplesRef = useRef<PointerAnomalySample[]>([]);

  // Active state trackers
  const activeFieldRef = useRef<ActiveFieldState | null>(null);
  const clickHistoryByTargetRef = useRef(new Map<string, number[]>());
  const highestSectionVisitedRef = useRef<number | null>(null);
  const currentSectionIndexRef = useRef<number | null>(null);
  const lastPointerRef = useRef<LastPointerPoint | null>(null);

  const [metrics, setMetrics] = useState<TelemetrySnapshot>(() =>
    TelemetrySnapshotSchema.parse({
      observationWindowSeconds,
      fieldFocusCount: 0,
      hesitationCount: 0,
      totalFieldFocusDurationMs: 0,
      validationErrors: 0,
      repeatedClicks: 0,
      backtracks: 0,
      cursorAnomalyScore: 0,
    })
  );

  const computeCursorAnomalyScore = useCallback(
    (samples: PointerAnomalySample[]): number => {
      if (samples.length < 3) return 0;

      const reversals = samples.filter((s) => s.isDirectionReversal).length;
      const bursts = samples.filter((s) => s.isBurst).length;
      const avgVelocity =
        samples.reduce((acc, s) => acc + s.velocityPxPerMs, 0) / samples.length;

      const reversalRatio = Math.min(
        1,
        reversals / Math.max(4, samples.length * 0.45)
      );
      const burstFactor = Math.min(1, bursts / 5);
      const velocityFactor = Math.min(1, avgVelocity / 3.5);

      const rawScore =
        reversalRatio * 0.45 + burstFactor * 0.35 + velocityFactor * 0.2;
      return Number(Math.min(1, Math.max(0, rawScore)).toFixed(2));
    },
    []
  );

  const pruneAndSyncMetrics = useCallback((): TelemetrySnapshot => {
    const now = Date.now();
    const cutoff = now - windowMs;

    focusEventsRef.current = focusEventsRef.current.filter(
      (e) => e.timestamp >= cutoff
    );
    focusDurationsRef.current = focusDurationsRef.current.filter(
      (e) => e.timestamp >= cutoff
    );
    hesitationEventsRef.current = hesitationEventsRef.current.filter(
      (e) => e.timestamp >= cutoff
    );
    repeatedClickEventsRef.current = repeatedClickEventsRef.current.filter(
      (e) => e.timestamp >= cutoff
    );
    validationEventsRef.current = validationEventsRef.current.filter(
      (e) => e.timestamp >= cutoff
    );
    backtrackEventsRef.current = backtrackEventsRef.current.filter(
      (e) => e.timestamp >= cutoff
    );
    pointerSamplesRef.current = pointerSamplesRef.current.filter(
      (s) => s.timestamp >= cutoff
    );

    const totalFieldFocusDurationMs = focusDurationsRef.current.reduce(
      (sum, item) => sum + item.durationMs,
      0
    );

    const cursorAnomalyScore = computeCursorAnomalyScore(
      pointerSamplesRef.current
    );

    const nextSnapshot = TelemetrySnapshotSchema.parse({
      observationWindowSeconds,
      fieldFocusCount: focusEventsRef.current.length,
      hesitationCount: hesitationEventsRef.current.length,
      totalFieldFocusDurationMs: Math.round(totalFieldFocusDurationMs),
      validationErrors: validationEventsRef.current.length,
      repeatedClicks: repeatedClickEventsRef.current.length,
      backtracks: backtrackEventsRef.current.length,
      cursorAnomalyScore,
    });

    setMetrics((prev) => {
      if (
        prev.observationWindowSeconds === nextSnapshot.observationWindowSeconds &&
        prev.fieldFocusCount === nextSnapshot.fieldFocusCount &&
        prev.hesitationCount === nextSnapshot.hesitationCount &&
        prev.totalFieldFocusDurationMs === nextSnapshot.totalFieldFocusDurationMs &&
        prev.validationErrors === nextSnapshot.validationErrors &&
        prev.repeatedClicks === nextSnapshot.repeatedClicks &&
        prev.backtracks === nextSnapshot.backtracks &&
        prev.cursorAnomalyScore === nextSnapshot.cursorAnomalyScore
      ) {
        return prev;
      }
      return nextSnapshot;
    });

    return nextSnapshot;
  }, [computeCursorAnomalyScore, observationWindowSeconds, windowMs]);

  const clearActiveFieldTimer = useCallback(() => {
    if (activeFieldRef.current?.timerId) {
      clearTimeout(activeFieldRef.current.timerId);
      activeFieldRef.current.timerId = null;
    }
  }, []);

  const recordValidationError = useCallback(
    (fieldId: string, errorCategory: ValidationErrorCategory = "custom") => {
      if (!isTrackingActive) return;

      const parsed = ValidationErrorSignalSchema.safeParse({
        fieldId: fieldId.trim() || "unknown_field",
        errorCategory,
        timestamp: Date.now(),
        errorCount: 1,
      });

      if (!parsed.success) return;

      validationEventsRef.current.push({
        targetId: parsed.data.fieldId,
        category: parsed.data.errorCategory,
        timestamp: parsed.data.timestamp,
      });

      pruneAndSyncMetrics();
    },
    [isTrackingActive, pruneAndSyncMetrics]
  );

  const recordBacktrack = useCallback(
    (targetStepOrSection = "wizard_step_back") => {
      if (!isTrackingActive) return;

      backtrackEventsRef.current.push({
        targetId: targetStepOrSection,
        timestamp: Date.now(),
      });

      pruneAndSyncMetrics();
    },
    [isTrackingActive, pruneAndSyncMetrics]
  );

  const simulateCursorAnomalyBurst = useCallback(() => {
    if (!isTrackingActive) return;
    const now = Date.now();
    for (let i = 0; i < 8; i++) {
      pointerSamplesRef.current.push({
        timestamp: now - i * 40,
        velocityPxPerMs: 3.2,
        isDirectionReversal: true,
        isBurst: true,
      });
    }
    pruneAndSyncMetrics();
  }, [isTrackingActive, pruneAndSyncMetrics]);

  const resetTelemetry = useCallback(() => {
    clearActiveFieldTimer();
    activeFieldRef.current = null;
    focusEventsRef.current = [];
    focusDurationsRef.current = [];
    hesitationEventsRef.current = [];
    repeatedClickEventsRef.current = [];
    validationEventsRef.current = [];
    backtrackEventsRef.current = [];
    pointerSamplesRef.current = [];
    clickHistoryByTargetRef.current.clear();
    highestSectionVisitedRef.current = null;
    currentSectionIndexRef.current = null;
    lastPointerRef.current = null;

    setMetrics(
      TelemetrySnapshotSchema.parse({
        observationWindowSeconds,
        fieldFocusCount: 0,
        hesitationCount: 0,
        totalFieldFocusDurationMs: 0,
        validationErrors: 0,
        repeatedClicks: 0,
        backtracks: 0,
        cursorAnomalyScore: 0,
      })
    );
  }, [clearActiveFieldTimer, observationWindowSeconds]);

  const getTelemetrySnapshot = useCallback((): TelemetrySnapshot => {
    if (!isTrackingActive) {
      return TelemetrySnapshotSchema.parse({
        observationWindowSeconds,
        fieldFocusCount: 0,
        hesitationCount: 0,
        totalFieldFocusDurationMs: 0,
        validationErrors: 0,
        repeatedClicks: 0,
        backtracks: 0,
        cursorAnomalyScore: 0,
      });
    }
    return pruneAndSyncMetrics();
  }, [isTrackingActive, observationWindowSeconds, pruneAndSyncMetrics]);

  const toDatabaseAggregatedSignals = useCallback((): AggregatedSignals => {
    const snap = getTelemetrySnapshot();
    return AggregatedSignalsSchema.parse({
      hesitation_count: snap.hesitationCount,
      validation_errors: snap.validationErrors,
      repeated_clicks: snap.repeatedClicks,
      backtracking: snap.backtracks,
      cursor_anomaly_score: Math.round(snap.cursorAnomalyScore * 100),
      observation_window_seconds: snap.observationWindowSeconds,
    });
  }, [getTelemetrySnapshot]);

  useEffect(() => {
    if (!isTrackingActive) {
      clearActiveFieldTimer();
      return;
    }

    const rootTarget: HTMLElement | Document =
      boundContainer ?? containerElementRef.current ?? document;

    const handleFocusIn = (event: Event) => {
      const { fieldId, sectionIndex } = resolveStableTargetId(event.target);
      if (!fieldId) return;

      const now = Date.now();

      if (sectionIndex !== null) {
        if (
          currentSectionIndexRef.current !== null &&
          sectionIndex < currentSectionIndexRef.current
        ) {
          backtrackEventsRef.current.push({
            targetId: `section_${currentSectionIndexRef.current}_to_${sectionIndex}`,
            timestamp: now,
          });
        }
        currentSectionIndexRef.current = sectionIndex;
        if (
          highestSectionVisitedRef.current === null ||
          sectionIndex > highestSectionVisitedRef.current
        ) {
          highestSectionVisitedRef.current = sectionIndex;
        }
      }

      clearActiveFieldTimer();

      focusEventsRef.current.push({
        targetId: fieldId,
        timestamp: now,
      });

      const timerId = setTimeout(() => {
        if (
          activeFieldRef.current &&
          activeFieldRef.current.fieldId === fieldId &&
          !activeFieldRef.current.hesitationRecorded
        ) {
          activeFieldRef.current.hesitationRecorded = true;
          hesitationEventsRef.current.push({
            targetId: fieldId,
            timestamp: Date.now(),
          });
          pruneAndSyncMetrics();
        }
      }, hesitationThresholdMs);

      activeFieldRef.current = {
        fieldId,
        startedAt: now,
        hesitationRecorded: false,
        timerId,
      };

      pruneAndSyncMetrics();
    };

    const handleFocusOut = (event: Event) => {
      const { fieldId } = resolveStableTargetId(event.target);
      const active = activeFieldRef.current;
      if (!active || (fieldId && active.fieldId !== fieldId)) return;

      const now = Date.now();
      const durationMs = Math.max(0, now - active.startedAt);
      clearActiveFieldTimer();

      focusDurationsRef.current.push({
        targetId: active.fieldId,
        timestamp: now,
        durationMs,
      });

      if (durationMs >= hesitationThresholdMs && !active.hesitationRecorded) {
        hesitationEventsRef.current.push({
          targetId: active.fieldId,
          timestamp: now,
        });
      }

      activeFieldRef.current = null;
      pruneAndSyncMetrics();
    };

    const handleClick = (event: Event) => {
      const { actionId } = resolveStableTargetId(event.target);
      if (!actionId) return;

      const now = Date.now();
      const existingClicks: number[] =
        clickHistoryByTargetRef.current.get(actionId) ?? [];
      const recentClicks = existingClicks.filter(
        (ts: number) => now - ts <= repeatedClickWindowMs
      );
      recentClicks.push(now);
      clickHistoryByTargetRef.current.set(actionId, recentClicks);

      if (recentClicks.length >= repeatedClickThresholdCount) {
        repeatedClickEventsRef.current.push({
          targetId: actionId,
          timestamp: now,
        });
        clickHistoryByTargetRef.current.set(actionId, []);
        pruneAndSyncMetrics();
      }
    };

    const handlePointerMove = (event: Event) => {
      const pointerEvent = event as PointerEvent & {
        pageX?: number;
        pageY?: number;
      };
      if (pointerEvent.pointerType === "touch") return;

      const now = Date.now();
      const prev = lastPointerRef.current;

      const x =
        typeof pointerEvent.clientX === "number"
          ? pointerEvent.clientX
          : typeof pointerEvent.pageX === "number"
          ? pointerEvent.pageX
          : 0;
      const y =
        typeof pointerEvent.clientY === "number"
          ? pointerEvent.clientY
          : typeof pointerEvent.pageY === "number"
          ? pointerEvent.pageY
          : 0;

      if (!prev) {
        lastPointerRef.current = { x, y, timestamp: now, vx: 0, vy: 0 };
        return;
      }

      const dt = now - prev.timestamp;
      if (dt < pointerSampleIntervalMs) {
        return;
      }

      const dx = x - prev.x;
      const dy = y - prev.y;
      const distance = Math.hypot(dx, dy);
      const velocityPxPerMs = distance / Math.max(1, dt);

      const vx = dx / Math.max(1, dt);
      const vy = dy / Math.max(1, dt);

      let isDirectionReversal = false;
      const prevMag = Math.hypot(prev.vx, prev.vy);
      const currMag = Math.hypot(vx, vy);
      if (prevMag > 0.35 && currMag > 0.35) {
        const cosine = (prev.vx * vx + prev.vy * vy) / (prevMag * currMag);
        if (cosine < -0.5) {
          isDirectionReversal = true;
        }
      }

      const isBurst = velocityPxPerMs > 2.4 && isDirectionReversal;

      pointerSamplesRef.current.push({
        timestamp: now,
        velocityPxPerMs: Math.min(100, velocityPxPerMs),
        isDirectionReversal,
        isBurst,
      });

      lastPointerRef.current = { x, y, timestamp: now, vx, vy };

      if (isBurst || pointerSamplesRef.current.length >= 3) {
        pruneAndSyncMetrics();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearActiveFieldTimer();
        activeFieldRef.current = null;
        lastPointerRef.current = null;
      }
    };

    rootTarget.addEventListener("focusin", handleFocusIn);
    rootTarget.addEventListener("focusout", handleFocusOut);
    rootTarget.addEventListener("click", handleClick);
    rootTarget.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const rollingIntervalId = setInterval(() => {
      pruneAndSyncMetrics();
    }, 1000);

    return () => {
      clearActiveFieldTimer();
      clearInterval(rollingIntervalId);
      rootTarget.removeEventListener("focusin", handleFocusIn);
      rootTarget.removeEventListener("focusout", handleFocusOut);
      rootTarget.removeEventListener("click", handleClick);
      rootTarget.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    boundContainer,
    clearActiveFieldTimer,
    hesitationThresholdMs,
    isTrackingActive,
    pointerSampleIntervalMs,
    pruneAndSyncMetrics,
    repeatedClickThresholdCount,
    repeatedClickWindowMs,
  ]);

  return {
    containerRef,
    metrics,
    isTrackingActive,
    recordValidationError,
    recordBacktrack,
    simulateCursorAnomalyBurst,
    resetTelemetry,
    getTelemetrySnapshot,
    toDatabaseAggregatedSignals,
  };
}