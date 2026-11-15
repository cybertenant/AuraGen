"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Database,
  Save,
  RefreshCw,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Loader2,
  ShieldAlert,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import type {
  SessionRecord,
  FormDraftRecord,
  FrictionEventRecord,
  FrictionLevel,
} from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTelemetry } from "@/hooks/useTelemetry";
import { TelemetryMonitorPanel } from "@/components/telemetry/TelemetryMonitorPanel";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const SESSION_STORAGE_KEY = "auragen_demo_session_id";

interface SyntheticFormState {
  entityLegalName: string;
  requestedFacilityUsd: number;
  debtServiceCoverageRatio: string;
  collateralClassification: string;
  treasuryContactCode: string;
}

const DEFAULT_SYNTHETIC_FORM: SyntheticFormState = {
  entityLegalName: "Vanguard Meridian Synth Corp",
  requestedFacilityUsd: 450000,
  debtServiceCoverageRatio: "1.42",
  collateralClassification: "Tier-1 Commercial Receivables",
  treasuryContactCode: "SYNTH-TR-904",
};

export function PersistenceWorkbench() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionMeta, setSessionMeta] = useState<SessionRecord | null>(null);
  const [formState, setFormState] = useState<SyntheticFormState>(
    DEFAULT_SYNTHETIC_FORM
  );
  const [draftMeta, setDraftMeta] = useState<FormDraftRecord | null>(null);
  const [frictionHistory, setFrictionHistory] = useState<FrictionEventRecord[]>(
    []
  );

  const [activeFormStep, setActiveFormStep] = useState<number>(1);
  const [consentGranted, setConsentGranted] = useState<boolean>(true);
  const [validationNotice, setValidationNotice] = useState<string | null>(null);

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

      // Load Draft if one exists
      const draftRes = await fetch(
        `${API_BASE}/api/sessions/${activeSessionId}/draft`
      );
      if (draftRes.ok) {
        const draftData = await draftRes.json();
        setDraftMeta(draftData.draft);
        const savedForm = draftData.draft.formData as Partial<SyntheticFormState>;
        setFormState({
          entityLegalName:
            savedForm.entityLegalName ?? DEFAULT_SYNTHETIC_FORM.entityLegalName,
          requestedFacilityUsd:
            Number(savedForm.requestedFacilityUsd) ||
            DEFAULT_SYNTHETIC_FORM.requestedFacilityUsd,
          debtServiceCoverageRatio:
            savedForm.debtServiceCoverageRatio ??
            DEFAULT_SYNTHETIC_FORM.debtServiceCoverageRatio,
          collateralClassification:
            savedForm.collateralClassification ??
            DEFAULT_SYNTHETIC_FORM.collateralClassification,
          treasuryContactCode:
            savedForm.treasuryContactCode ??
            DEFAULT_SYNTHETIC_FORM.treasuryContactCode,
        });
      } else if (draftRes.status === 404) {
        setDraftMeta(null);
      }

      // Load Friction Event History
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

  // Restore session ID from browser storage on mount (never stores form values in storage)
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

  /**
   * Validates synthetic financial fields without recording user-entered values in telemetry
   */
  const validateFinancialForm = (): boolean => {
    setValidationNotice(null);

    if (!formState.entityLegalName || formState.entityLegalName.trim().length < 3) {
      recordValidationError("entityLegalName", "required");
      setValidationNotice("Entity Legal Name requires at least 3 characters.");
      return false;
    }

    if (
      !Number.isFinite(formState.requestedFacilityUsd) ||
      formState.requestedFacilityUsd < 10000 ||
      formState.requestedFacilityUsd > 50000000
    ) {
      recordValidationError("requestedFacilityUsd", "range");
      setValidationNotice(
        "Requested Facility must be between $10,000 and $50,000,000."
      );
      return false;
    }

    const dscr = Number(formState.debtServiceCoverageRatio);
    if (!Number.isFinite(dscr) || dscr < 1.0 || dscr > 10.0) {
      recordValidationError("debtServiceCoverageRatio", "ratio");
      setValidationNotice("Target DSCR Ratio must be a valid ratio between 1.00 and 10.00.");
      return false;
    }

    return true;
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateFinancialForm()) {
      return;
    }

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
          formData: formState,
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
        message: `Saved draft (Schema v${data.draft.schemaVersion}) to Neon PostgreSQL.`,
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

  const handleStepNavigation = (nextStep: number) => {
    if (nextStep < activeFormStep) {
      recordBacktrack(`step_${activeFormStep}_to_${nextStep}`);
    }
    setActiveFormStep(nextStep);
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
        // Day 4 will replace this provisional heuristic with the full Cognitive Friction Engine
        frictionScore: Math.min(
          100,
          liveSignals.hesitation_count * 15 +
            liveSignals.validation_errors * 20 +
            liveSignals.repeated_clicks * 15 +
            liveSignals.backtracking * 15 +
            Math.round(liveSignals.cursor_anomaly_score * 0.25)
        ),
        frictionLevel:
          liveSignals.validation_errors + liveSignals.hesitation_count >= 3
            ? "high"
            : liveSignals.validation_errors + liveSignals.repeated_clicks >= 1
            ? "medium"
            : "low",
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

      const historyRes = await fetch(
        `${API_BASE}/api/sessions/${sessionId}/friction-events?limit=10`
      );
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setFrictionHistory(historyData.events || []);
      }

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
      aria-label="Day 2 & Day 3 Persistence and Telemetry Workbench"
      className="space-y-6 pt-4 border-t border-slate-800/80"
    >
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
        onResetTelemetry={resetTelemetry}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">
              Neon PostgreSQL & Instrumented Financial Form Workbench
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            All form controls below are instrumented with{" "}
            <code>data-auragen-field</code> and <code>data-auragen-action</code>{" "}
            telemetry sensors.
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

      {/* Grid: Form Draft Persistence + Aggregated Friction History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Synthetic Financial Form Draft */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-200 font-semibold">
                Synthetic Commercial Credit Draft (form_drafts)
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
              <Badge variant="neutral">Step {activeFormStep} of 2</Badge>
              {draftMeta && (
                <Badge variant="default">
                  Schema v{draftMeta.schemaVersion}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {validationNotice && (
              <div
                role="alert"
                data-testid="form-validation-alert"
                className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
              >
                {validationNotice}
              </div>
            )}

            <form onSubmit={handleSaveDraft} className="space-y-4" noValidate>
              {/* Section 1: Entity & Facility Sizing */}
              <div
                data-auragen-section="entity_and_facility"
                data-auragen-section-index="1"
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="entityLegalName"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Synthetic Entity Legal Name
                  </label>
                  <input
                    id="entityLegalName"
                    data-auragen-field="entityLegalName"
                    type="text"
                    value={formState.entityLegalName}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        entityLegalName: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="requestedFacilityUsd"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Requested Facility (USD)
                    </label>
                    <input
                      id="requestedFacilityUsd"
                      data-auragen-field="requestedFacilityUsd"
                      type="number"
                      value={formState.requestedFacilityUsd}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          requestedFacilityUsd: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="debtServiceCoverageRatio"
                      className="block text-xs font-medium text-slate-300 mb-1"
                    >
                      Target DSCR Ratio
                    </label>
                    <input
                      id="debtServiceCoverageRatio"
                      data-auragen-field="debtServiceCoverageRatio"
                      type="text"
                      value={formState.debtServiceCoverageRatio}
                      onChange={(e) =>
                        setFormState((s) => ({
                          ...s,
                          debtServiceCoverageRatio: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Collateral & Treasury Metadata */}
              <div
                data-auragen-section="collateral_and_treasury"
                data-auragen-section-index="2"
                className="space-y-4 pt-2 border-t border-slate-800/60"
              >
                <div>
                  <label
                    htmlFor="collateralClassification"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Collateral Classification
                  </label>
                  <input
                    id="collateralClassification"
                    data-auragen-field="collateralClassification"
                    type="text"
                    value={formState.collateralClassification}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        collateralClassification: e.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Step Navigation & Submit Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activeFormStep === 1}
                    onClick={() => handleStepNavigation(1)}
                    data-auragen-action="wizard-prev-step"
                    data-testid="wizard-prev-step-btn"
                  >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                    Previous Section
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={activeFormStep === 2}
                    onClick={() => handleStepNavigation(2)}
                    data-auragen-action="wizard-next-step"
                    data-testid="wizard-next-step-btn"
                  >
                    Next Section
                    <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  data-auragen-action="submit"
                  data-testid="save-draft-btn"
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft to Neon
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Right Column: Aggregated Cognitive Friction Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-slate-200 font-semibold">
                Aggregated Friction Telemetry (friction_events)
              </CardTitle>
              <p className="text-xs text-slate-400 mt-1">
                Stores windowed signal aggregates (no raw mouse or keystroke
                streams).
              </p>
            </div>
            <Badge variant="neutral">{frictionHistory.length} Records</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={isLoading || !sessionId}
                onClick={() => void handleRecordFrictionPreset("live_telemetry")}
                data-auragen-action="persist-live-telemetry"
                data-testid="persist-live-telemetry-btn"
              >
                Persist Live Telemetry Snapshot
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
              className="space-y-2.5 max-h-64 overflow-y-auto pr-1"
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