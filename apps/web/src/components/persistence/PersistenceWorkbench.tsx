"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Database,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type {
  SessionRecord,
  FormDraftRecord,
  FrictionEventRecord,
  FrictionLevel,
  FinancialLoanApplication,
  CognitiveFrictionEvaluation,
} from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTelemetry } from "@/hooks/useTelemetry";
import { useSocket } from "@/hooks/useSocket";
import { useCognitiveFrictionEngine } from "@/hooks/useCognitiveFrictionEngine";
import { TelemetryMonitorPanel } from "@/components/telemetry/TelemetryMonitorPanel";
import { ConnectionStatusPanel } from "@/components/telemetry/connection-status";
import { CognitiveFrictionPanel } from "@/components/friction/CognitiveFrictionPanel";
import {
  FinancialLoanApplicationForm,
  DEFAULT_LOAN_APPLICATION_VALUES,
} from "@/components/persistence/FinancialLoanApplicationForm";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const SESSION_STORAGE_KEY = "auragen_demo_session_id";

export interface PersistenceWorkbenchProps {
  onFrictionEvaluationChange?: (evaluation: CognitiveFrictionEvaluation) => void;
  externalSimulationTrigger?: number;
}

export function PersistenceWorkbench({
  onFrictionEvaluationChange,
  externalSimulationTrigger = 0,
}: PersistenceWorkbenchProps = {}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionRecord | null>(null);
  const [initialLoanValues, setInitialLoanValues] = useState<
    Partial<FinancialLoanApplication>
  >(DEFAULT_LOAN_APPLICATION_VALUES);
  const [draftMeta, setDraftMeta] = useState<FormDraftRecord | null>(null);
  const [frictionHistory, setFrictionHistory] = useState<FrictionEventRecord[]>(
    []
  );

  const [consentGranted, setConsentGranted] = useState<boolean>(true);

  const {
    containerRef,
    metrics,
    recordValidationError,
    recordBacktrack,
    simulateCursorAnomalyBurst,
    resetTelemetry,
    toDatabaseAggregatedSignals,
  } = useTelemetry({
    enabled: true,
    consentGranted,
    observationWindowSeconds: 30,
  });

  // Day 5 Real-Time Socket.IO Hook
  const {
    connected: socketConnected,
    connectionStatus,
    joinedSessionId,
    sendTelemetry,
    latestFriction,
    lastTelemetryAck,
    socketError,
    activityLog,
  } = useSocket(sessionId);

  const refreshHistoryOnly = useCallback(async (activeId: string) => {
    try {
      const historyRes = await fetch(
        `${API_BASE}/api/sessions/${activeId}/friction-events?limit=10`
      );
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setFrictionHistory(historyData.events || []);
      }
    } catch {
      // Ignore transient network errors during background history refresh
    }
  }, []);

  // Local preview engine (used as immediate local preview and fallback when socket is disconnected)
  // When socket is connected to a joined session, the backend socket server handles DB persistence.
  const isServerAuthoritativeActive = Boolean(
    socketConnected && joinedSessionId
  );

  const {
    evaluation: localEvaluation,
    activeScenarioName,
    isSimulationActive,
    persistenceStatus,
    runSimulationScenario,
    clearSimulation,
    resetFrictionEngine,
  } = useCognitiveFrictionEngine({
    telemetryMetrics: metrics,
    sessionId,
    enablePersistence: !isServerAuthoritativeActive,
    persistenceIntervalMs: 10000,
    onSnapshotPersisted: () => {
      if (sessionId) {
        void refreshHistoryOnly(sessionId);
      }
    },
  });

  // Prefer server-authoritative friction calculation when connected and available
  const authoritativeEvaluation: CognitiveFrictionEvaluation = useMemo(() => {
    if (isServerAuthoritativeActive && latestFriction && !isSimulationActive) {
      return {
        rawScore: latestFriction.rawScore,
        smoothedScore: latestFriction.smoothedScore,
        level: latestFriction.level,
        signals: latestFriction.signals,
        contributions: latestFriction.contributions,
        thresholdStatus: latestFriction.thresholdStatus,
        evaluatedAt: new Date(latestFriction.timestamp).getTime(),
      };
    }
    return localEvaluation;
  }, [
    isServerAuthoritativeActive,
    isSimulationActive,
    latestFriction,
    localEvaluation,
  ]);

  // Refresh Neon history list when backend socket persists a snapshot
  useEffect(() => {
    if (lastTelemetryAck?.persistedToDatabase && sessionId) {
      void refreshHistoryOnly(sessionId);
    }
  }, [lastTelemetryAck, refreshHistoryOnly, sessionId]);

  // Transmit batched telemetry over Socket.IO when meaningful interaction changes occur or every 5s
  const lastSentSignatureRef = useRef<string>("");
  useEffect(() => {
    if (!socketConnected || !joinedSessionId) return;

    const sig = `${metrics.fieldFocusCount}:${metrics.hesitationCount}:${metrics.validationErrors}:${metrics.repeatedClicks}:${metrics.backtracks}:${metrics.cursorAnomalyScore.toFixed(2)}`;
    const isInitialZero =
      metrics.fieldFocusCount === 0 &&
      metrics.hesitationCount === 0 &&
      metrics.validationErrors === 0 &&
      metrics.repeatedClicks === 0 &&
      metrics.backtracks === 0 &&
      metrics.cursorAnomalyScore === 0;

    if (!isInitialZero && sig !== lastSentSignatureRef.current) {
      lastSentSignatureRef.current = sig;
      sendTelemetry(metrics);
    }
  }, [joinedSessionId, metrics, sendTelemetry, socketConnected]);

  useEffect(() => {
    if (!socketConnected || !joinedSessionId) return;
    const intervalId = setInterval(() => {
      const hasActivity =
        metrics.fieldFocusCount > 0 ||
        metrics.hesitationCount > 0 ||
        metrics.validationErrors > 0 ||
        metrics.repeatedClicks > 0 ||
        metrics.backtracks > 0 ||
        metrics.cursorAnomalyScore > 0;
      if (hasActivity) {
        sendTelemetry(metrics);
      }
    }, 6000);

    return () => clearInterval(intervalId);
  }, [joinedSessionId, metrics, sendTelemetry, socketConnected]);

  useEffect(() => {
    onFrictionEvaluationChange?.(authoritativeEvaluation);
  }, [authoritativeEvaluation, onFrictionEvaluationChange]);

  useEffect(() => {
    if (externalSimulationTrigger > 0) {
      runSimulationScenario("high_friction");
    }
  }, [externalSimulationTrigger, runSimulationScenario]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [statusBanner, setStatusBanner] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const loadSessionData = useCallback(async (activeSessionId: string) => {
    setIsLoading(true);
    setStatusBanner(null);
    try {
      const sessionRes = await fetch(
        `${API_BASE}/api/sessions/${activeSessionId}`
      );
      if (!sessionRes.ok) {
        const errBody = await sessionRes.json().catch(() => ({}));
        throw new Error(
          errBody.message || `Failed to load session (${sessionRes.status})`
        );
      }
      const sessionData = await sessionRes.json();
      setSessionMeta(sessionData.session);

      const draftRes = await fetch(
        `${API_BASE}/api/sessions/${activeSessionId}/draft`
      );
      if (draftRes.ok) {
        const draftData = await draftRes.json();
        setDraftMeta(draftData.draft);
        const savedForm = (draftData.draft.formData ?? {}) as Record<
          string,
          unknown
        >;

        setInitialLoanValues({
          ...DEFAULT_LOAN_APPLICATION_VALUES,
          ...(savedForm as Partial<FinancialLoanApplication>),
          fullName:
            typeof savedForm.fullName === "string"
              ? savedForm.fullName
              : typeof savedForm.entityLegalName === "string"
              ? savedForm.entityLegalName
              : DEFAULT_LOAN_APPLICATION_VALUES.fullName,
          employerOrEntityName:
            typeof savedForm.employerOrEntityName === "string"
              ? savedForm.employerOrEntityName
              : typeof savedForm.entityLegalName === "string"
              ? savedForm.entityLegalName
              : DEFAULT_LOAN_APPLICATION_VALUES.employerOrEntityName,
          requestedLoanAmount:
            typeof savedForm.requestedLoanAmount === "number"
              ? savedForm.requestedLoanAmount
              : typeof savedForm.requestedFacilityUsd === "number"
              ? savedForm.requestedFacilityUsd
              : DEFAULT_LOAN_APPLICATION_VALUES.requestedLoanAmount,
        });
      } else if (draftRes.status === 404) {
        setDraftMeta(null);
      }

      const historyRes = await fetch(
        `${API_BASE}/api/sessions/${activeSessionId}/friction-events?limit=10`
      );
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setFrictionHistory(historyData.events || []);
      }

      setStatusBanner({
        type: "info",
        message: `Synchronized session ${activeSessionId.slice(0, 8)}... with Neon PostgreSQL.`,
      });
    } catch (err) {
      setStatusBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Could not reach backend persistence API.",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const storedId =
      typeof window !== "undefined"
        ? window.localStorage.getItem(SESSION_STORAGE_KEY)
        : null;
    if (storedId) {
      setSessionId(storedId);
      void loadSessionData(storedId);
    }
  }, [loadSessionData]);

  const handleCreateSession = async () => {
    setIsLoading(true);
    setStatusBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to create session");
      }

      const newId: string = data.session.id;
      window.localStorage.setItem(SESSION_STORAGE_KEY, newId);
      setSessionId(newId);
      setSessionMeta(data.session);
      setDraftMeta(null);
      setFrictionHistory([]);
      setStatusBanner({
        type: "success",
        message: `Created new Neon PostgreSQL session (${newId}).`,
      });
    } catch (err) {
      setStatusBanner({
        type: "error",
        message:
          err instanceof Error ? err.message : "Failed to create session",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveLoanDraft = async (values: FinancialLoanApplication) => {
    if (!sessionId) {
      setStatusBanner({
        type: "error",
        message: "Create an AuraGen session first before saving a draft.",
      });
      return;
    }

    setIsLoading(true);
    setStatusBanner(null);
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData: {
            ...values,
            entityLegalName: values.employerOrEntityName,
            requestedFacilityUsd: values.requestedLoanAmount,
          },
          schemaVersion: (draftMeta?.schemaVersion ?? 0) + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to save form draft");
      }

      setDraftMeta(data.draft);
      setStatusBanner({
        type: "success",
        message: `Saved 5-section loan draft (Schema v${data.draft.schemaVersion}) to Neon PostgreSQL.`,
      });
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: err instanceof Error ? err.message : "Draft save failed",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordFrictionPreset = async (
    preset: "low" | "medium" | "high" | "live_telemetry"
  ) => {
    if (!sessionId) {
      setStatusBanner({
        type: "error",
        message: "Create an AuraGen session first before logging friction.",
      });
      return;
    }

    const liveSignals = toDatabaseAggregatedSignals();

    const payloads: Record<
      "low" | "medium" | "high" | "live_telemetry",
      {
        frictionScore: number;
        frictionLevel: FrictionLevel;
        signals: typeof liveSignals;
      }
    > = {
      low: {
        frictionScore: 18,
        frictionLevel: "low",
        signals: {
          hesitation_count: 1,
          validation_errors: 0,
          repeated_clicks: 0,
          backtracking: 0,
          cursor_anomaly_score: 12,
          observation_window_seconds: 10,
        },
      },
      medium: {
        frictionScore: 54,
        frictionLevel: "medium",
        signals: {
          hesitation_count: 3,
          validation_errors: 1,
          repeated_clicks: 2,
          backtracking: 1,
          cursor_anomaly_score: 48,
          observation_window_seconds: 10,
        },
      },
      high: {
        frictionScore: 86,
        frictionLevel: "high",
        signals: {
          hesitation_count: 6,
          validation_errors: 3,
          repeated_clicks: 5,
          backtracking: 4,
          cursor_anomaly_score: 82,
          observation_window_seconds: 10,
        },
      },
      live_telemetry: {
        frictionScore: Math.round(authoritativeEvaluation.smoothedScore),
        frictionLevel: authoritativeEvaluation.level,
        signals: liveSignals,
      },
    };

    setIsLoading(true);
    setStatusBanner(null);
    try {
      const selectedPayload = payloads[preset];
      const res = await fetch(
        `${API_BASE}/api/sessions/${sessionId}/friction-events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selectedPayload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to record friction event");
      }

      await refreshHistoryOnly(sessionId);

      setStatusBanner({
        type: "success",
        message: `Persisted ${preset.toUpperCase()} friction event (score ${data.event.frictionScore}) in Neon.`,
      });
    } catch (err) {
      setStatusBanner({
        type: "error",
        message:
          err instanceof Error
            ? err.message
            : "Failed to persist friction event",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      ref={containerRef}
      aria-label="Day 2, Day 3, Day 4 & Day 5 Real-Time Telemetry, Friction Engine and Persistence Workbench"
      className="space-y-6 pt-4 border-t border-slate-800/80"
    >
      {/* Day 5 Socket.IO Connection Status & Live Activity Stream */}
      <ConnectionStatusPanel
        connectionStatus={connectionStatus}
        sessionId={sessionId}
        lastTelemetryAck={lastTelemetryAck}
        socketError={socketError}
        activityLog={activityLog}
      />

      {/* Day 4 Cognitive Friction Engine & Real-Time Scoring Panel */}
      <CognitiveFrictionPanel
        evaluation={authoritativeEvaluation}
        activeScenarioName={activeScenarioName}
        isSimulationActive={isSimulationActive}
        persistenceStatus={persistenceStatus}
        onRunSimulation={runSimulationScenario}
        onClearSimulation={clearSimulation}
        onResetEngine={() => {
          resetTelemetry();
          resetFrictionEngine();
        }}
      />

      {/* Day 3 Live Telemetry Monitor Panel */}
      <TelemetryMonitorPanel
        metrics={metrics}
        consentGranted={consentGranted}
        onToggleConsent={setConsentGranted}
        onSimulateValidationError={(fieldId, category) =>
          recordValidationError(fieldId, category)
        }
        onSimulateBacktrack={() => recordBacktrack("simulated_wizard_backtrack")}
        onSimulateCursorAnomaly={simulateCursorAnomalyBurst}
        onResetTelemetry={() => {
          resetTelemetry();
          resetFrictionEngine();
        }}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">
              5-Section Financial Loan Application &amp; Neon Persistence
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Built with React Hook Form (15 fields across 5 sections),{" "}
            <code>data-auragen-field</code> telemetry sensors, Socket.IO batch
            streaming, and Neon <code>form_drafts</code> persistence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleCreateSession}
            disabled={isLoading}
            data-auragen-action="create-session"
            data-testid="create-session-btn"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="mr-2 h-4 w-4" />
            )}
            Create New Session
          </Button>

          {sessionId && (
            <Button
              variant="secondary"
              onClick={() => void loadSessionData(sessionId)}
              disabled={isLoading}
              data-auragen-action="reload-session"
              data-testid="reload-session-btn"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload from Neon
            </Button>
          )}
        </div>
      </div>

      {/* Security & Synthetic Data Notice */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex items-start gap-3 text-xs text-amber-200/90">
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Zero-PII Telemetry Guardrail:</span>{" "}
          Interaction sensors track focus duration, click cadence, and
          validation categories using stable field IDs—never recording typed
          characters, financial figures, or raw cursor trajectories.
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusBanner && (
        <div
          role="status"
          data-testid="persistence-status-banner"
          className={`rounded-lg border px-4 py-3 text-xs flex items-center gap-2.5 ${
            statusBanner.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : statusBanner.type === "error"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
              : "border-sky-500/40 bg-sky-500/10 text-sky-300"
          }`}
        >
          {statusBanner.type === "error" ? (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{statusBanner.message}</span>
        </div>
      )}

      {/* Grid: 5-Section Financial Loan Application + Aggregated Friction History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="lg:col-span-7">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <CardTitle className="text-slate-100 font-semibold text-base">
                Institutional &amp; Commercial Financial Loan Application
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                Active Session:{" "}
                <code
                  data-testid="active-session-id"
                  className="text-emerald-400 font-mono"
                >
                  {sessionId ?? "None (Click Create New Session)"}
                </code>
              </p>
            </div>
            <div className="flex items-center gap-2">
              {draftMeta ? (
                <Badge variant="default">
                  Saved Draft v{draftMeta.schemaVersion}
                </Badge>
              ) : (
                <Badge variant="neutral">
                  {sessionMeta ? "Unsaved Draft" : "No Session"}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <FinancialLoanApplicationForm
              initialValues={initialLoanValues}
              disabled={isLoading}
              onSaveDraft={handleSaveLoanDraft}
              onValidationError={(fieldId, category) =>
                recordValidationError(fieldId, category)
              }
              onBacktrack={(reason) => recordBacktrack(reason)}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-800/80 pb-4">
            <div>
              <CardTitle className="text-slate-100 font-semibold text-base">
                Aggregated Friction History (friction_events)
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                Stores windowed signal aggregates in Neon PostgreSQL.
              </p>
            </div>
            <Badge variant="neutral">{frictionHistory.length} Records</Badge>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={isLoading || !sessionId}
                onClick={() => void handleRecordFrictionPreset("live_telemetry")}
                data-auragen-action="persist-live-telemetry"
                data-testid="persist-live-telemetry-btn"
              >
                Persist Engine Score ({Math.round(authoritativeEvaluation.smoothedScore)})
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={isLoading || !sessionId}
                onClick={() => void handleRecordFrictionPreset("low")}
                data-auragen-action="log-low-friction"
                data-testid="log-low-friction-btn"
              >
                + Preset Low (18)
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={isLoading || !sessionId}
                onClick={() => void handleRecordFrictionPreset("medium")}
                data-auragen-action="log-medium-friction"
                data-testid="log-medium-friction-btn"
              >
                + Preset Medium (54)
              </Button>
              <Button
                variant="amber"
                size="sm"
                disabled={isLoading || !sessionId}
                onClick={() => void handleRecordFrictionPreset("high")}
                data-auragen-action="log-high-friction"
                data-testid="log-high-friction-btn"
              >
                + Preset High (86)
              </Button>
            </div>

            <div
              data-testid="friction-history-list"
              className="space-y-2.5 max-h-80 overflow-y-auto pr-1"
            >
              {frictionHistory.length === 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-500">
                  No friction events recorded for this session yet.
                </div>
              ) : (
                frictionHistory.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="font-semibold text-white">
                          Score: {ev.frictionScore}/100
                        </span>
                        <Badge
                          variant={
                            ev.frictionLevel === "high"
                              ? "danger"
                              : ev.frictionLevel === "medium"
                              ? "warning"
                              : "default"
                          }
                        >
                          {ev.frictionLevel.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Hesitations: {ev.signals.hesitation_count} · Errors:{" "}
                        {ev.signals.validation_errors} · Clicks:{" "}
                        {ev.signals.repeated_clicks} · Backtracks:{" "}
                        {ev.signals.backtracking}
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono">
                      #{ev.id}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}