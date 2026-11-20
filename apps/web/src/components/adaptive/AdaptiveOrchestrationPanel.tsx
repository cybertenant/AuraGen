"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Activity,
  FlaskConical,
  PauseCircle,
} from "lucide-react";
import {
  CognitiveFrictionEngine,
  FrictionLevel,
  TelemetrySnapshot,
  AdaptiveOrchestrationState,
  FrictionStatePayload,
  AdaptationEligiblePayload,
  FrictionRecoveredPayload,
} from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type AdaptiveScenarioId =
  | "normal_user"
  | "temporary_spike"
  | "sustained_high_friction"
  | "recovery"
  | "cooldown"
  | "new_friction_episode"
  | "inactive_user";

export interface AdaptiveOrchestrationPanelProps {
  serverAdaptiveState: FrictionStatePayload | null;
  serverLastEligible: AdaptationEligiblePayload | null;
  serverLastRecovered: FrictionRecoveredPayload | null;
  liveFrictionScore: number;
  liveFrictionLevel: FrictionLevel;
  sessionId: string | null;
  onDispatchTelemetryBatch?: (batch: TelemetrySnapshot) => void;
}

const STATE_MESSAGES: Record<AdaptiveOrchestrationState, string> = {
  MONITORING: "Your application experience is running normally.",
  HIGH_FRICTION_CANDIDATE:
    "AuraGen has noticed repeated interaction difficulty. Evaluating whether assistance is needed.",
  ADAPTATION_ELIGIBLE:
    "AuraGen has determined that a simplified experience may help.",
  COOLDOWN: "Adaptation cooldown is active.",
  RECOVERED:
    "Your interaction friction has returned below the recovery threshold.",
};

const HIGH_BATCH: TelemetrySnapshot = {
  observationWindowSeconds: 30,
  fieldFocusCount: 6,
  hesitationCount: 3,
  totalFieldFocusDurationMs: 14500,
  validationErrors: 3,
  repeatedClicks: 4,
  backtracks: 3,
  cursorAnomalyScore: 0.9,
};

const LOW_BATCH: TelemetrySnapshot = {
  observationWindowSeconds: 30,
  fieldFocusCount: 3,
  hesitationCount: 0,
  totalFieldFocusDurationMs: 2200,
  validationErrors: 0,
  repeatedClicks: 0,
  backtracks: 0,
  cursorAnomalyScore: 0.05,
};

export function AdaptiveOrchestrationPanel({
  serverAdaptiveState,
  serverLastEligible,
  serverLastRecovered,
  liveFrictionScore,
  liveFrictionLevel,
  sessionId,
  onDispatchTelemetryBatch,
}: AdaptiveOrchestrationPanelProps) {
  const isProduction = process.env.NODE_ENV === "production";

  // Local deterministic pipeline mirror for development scenario simulation
  // Uses the exact shared CognitiveFrictionEngine + identical hysteresis/sustained/cooldown rules
  const [simState, setSimState] = useState<{
    activeScenario: AdaptiveScenarioId | null;
    state: AdaptiveOrchestrationState;
    score: number;
    level: FrictionLevel;
    durationMs: number;
    cooldownRemainingMs: number;
    lastEligibleAt: string | null;
    recovered: boolean;
    summaryNote: string;
  } | null>(null);

  const simTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearSimTimers = useCallback(() => {
    for (const id of simTimersRef.current) {
      clearTimeout(id);
    }
    simTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearSimTimers();
  }, [clearSimTimers]);

  const runAdaptiveScenario = useCallback(
    (scenario: AdaptiveScenarioId) => {
      if (isProduction) return;
      clearSimTimers();

      const engine = new CognitiveFrictionEngine();
      let candidateStart: number | null = null;
      let episodeTriggered = false;
      let cooldownUntil: number | null = null;
      let lastObsAt: number | null = null;
      let lastEligibleAt: string | null = null;

      const stepEvaluate = (
        batch: TelemetrySnapshot,
        virtualNowMs: number,
        note: string
      ) => {
        const evalRes = engine.evaluate(batch, virtualNowMs);
        const score = evalRes.smoothedScore;
        const level = evalRes.level;
        let state: AdaptiveOrchestrationState = "MONITORING";
        let recovered = false;

        // Check inactivity gap (> 15,000ms)
        if (
          lastObsAt !== null &&
          virtualNowMs - lastObsAt > 15000 &&
          candidateStart !== null
        ) {
          candidateStart = null;
        }
        lastObsAt = virtualNowMs;

        let cooldownRemaining =
          cooldownUntil !== null ? Math.max(0, cooldownUntil - virtualNowMs) : 0;
        if (cooldownRemaining === 0) {
          cooldownUntil = null;
        }

        if (score < 55) {
          if (candidateStart !== null || episodeTriggered) {
            recovered = true;
            state = cooldownRemaining > 0 ? "COOLDOWN" : "RECOVERED";
          }
          candidateStart = null;
          episodeTriggered = false;
        } else if (score >= 65) {
          if (candidateStart === null) {
            candidateStart = virtualNowMs;
          }
          const elapsed = virtualNowMs - candidateStart;
          if (elapsed >= 5000) {
            if (cooldownRemaining > 0 || episodeTriggered) {
              state = "COOLDOWN";
            } else {
              episodeTriggered = true;
              cooldownUntil = virtualNowMs + 60000;
              cooldownRemaining = 60000;
              lastEligibleAt = new Date(virtualNowMs).toISOString();
              state = "ADAPTATION_ELIGIBLE";
            }
          } else {
            state = cooldownRemaining > 0 ? "COOLDOWN" : "HIGH_FRICTION_CANDIDATE";
          }
        } else {
          // Sticky hysteresis band [55, 64]
          state =
            cooldownRemaining > 0
              ? "COOLDOWN"
              : candidateStart !== null
              ? "HIGH_FRICTION_CANDIDATE"
              : "MONITORING";
        }

        const durationMs =
          candidateStart !== null ? Math.max(0, virtualNowMs - candidateStart) : 0;

        setSimState({
          activeScenario: scenario,
          state,
          score,
          level,
          durationMs,
          cooldownRemainingMs: cooldownRemaining,
          lastEligibleAt,
          recovered,
          summaryNote: note,
        });

        onDispatchTelemetryBatch?.(batch);
      };

      const base = Date.now();

      if (scenario === "normal_user") {
        stepEvaluate(
          { ...LOW_BATCH, hesitationCount: 1, cursorAnomalyScore: 0.2 },
          base,
          "Scenario A (Normal User): Friction stays around 15–25 in MONITORING."
        );
        return;
      }

      if (scenario === "temporary_spike") {
        stepEvaluate(
          HIGH_BATCH,
          base,
          "Scenario B (Temporary Spike): High spike started candidate..."
        );
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(
              LOW_BATCH,
              base + 2000,
              "Scenario B (Temporary Spike): Dropped below 55 before 5s — candidate reset, zero false triggers."
            );
          }, 300)
        );
        return;
      }

      if (scenario === "sustained_high_friction") {
        stepEvaluate(
          HIGH_BATCH,
          base,
          "Scenario C (Sustained Friction): Candidate started (0s / 5s)..."
        );
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(
              HIGH_BATCH,
              base + 5500,
              "Scenario C (Sustained Friction): Sustained >= 65 for >= 5s — ADAPTATION_ELIGIBLE emitted once!"
            );
          }, 350)
        );
        return;
      }

      if (scenario === "recovery") {
        stepEvaluate(HIGH_BATCH, base, "Scenario D: High friction candidate started...");
        simTimersRef.current.push(
          setTimeout(() => {
            engine.evaluate(LOW_BATCH, base + 2000);
            stepEvaluate(
              LOW_BATCH,
              base + 4000,
              "Scenario D (Recovery): Score dropped below 55 — RECOVERED and active episode reset."
            );
          }, 300)
        );
        return;
      }

      if (scenario === "cooldown") {
        stepEvaluate(HIGH_BATCH, base, "Scenario E: Episode 1 starting...");
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(
              HIGH_BATCH,
              base + 5500,
              "Scenario E: Episode 1 triggered ADAPTATION_ELIGIBLE (60s cooldown active)..."
            );
          }, 250)
        );
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(
              HIGH_BATCH,
              base + 15000,
              "Scenario E (Cooldown): High friction during 60s window — adaptation deferred (COOLDOWN)."
            );
          }, 550)
        );
        return;
      }

      if (scenario === "new_friction_episode") {
        stepEvaluate(HIGH_BATCH, base, "Scenario F: Episode 1 starting...");
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(
              HIGH_BATCH,
              base + 5500,
              "Scenario F: Episode 1 eligible; advancing clock past 60s cooldown & recovery..."
            );
          }, 200)
        );
        simTimersRef.current.push(
          setTimeout(() => {
            engine.evaluate(LOW_BATCH, base + 66000);
            stepEvaluate(
              LOW_BATCH,
              base + 68000,
              "Scenario F: Cooldown expired + user recovered below 55..."
            );
          }, 450)
        );
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(HIGH_BATCH, base + 70000, "Scenario F: New friction episode started...");
          }, 700)
        );
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(
              HIGH_BATCH,
              base + 76000,
              "Scenario F (New Episode): Sustained 5s after recovery + cooldown expiry — new ADAPTATION_ELIGIBLE triggered!"
            );
          }, 950)
        );
        return;
      }

      if (scenario === "inactive_user") {
        stepEvaluate(
          HIGH_BATCH,
          base,
          "Scenario G (Inactive User): Single high reading recorded..."
        );
        simTimersRef.current.push(
          setTimeout(() => {
            stepEvaluate(
              HIGH_BATCH,
              base + 20000,
              "Scenario G (Inactive User): >15s observation gap detected — unconfirmed candidate reset, no false adaptation."
            );
          }, 350)
        );
      }
    },
    [clearSimTimers, isProduction, onDispatchTelemetryBatch]
  );

  const displayedState: AdaptiveOrchestrationState =
    simState?.state ?? serverAdaptiveState?.state ?? "MONITORING";
  const displayedScore =
    simState?.score ?? serverAdaptiveState?.frictionScore ?? liveFrictionScore;
  const displayedLevel: FrictionLevel =
    simState?.level ?? serverAdaptiveState?.frictionLevel ?? liveFrictionLevel;
  const displayedDurationMs =
    simState?.durationMs ?? serverAdaptiveState?.durationMs ?? 0;
  const requiredDurationMs = serverAdaptiveState?.requiredDurationMs ?? 5000;
  const displayedCooldownMs =
    simState?.cooldownRemainingMs ??
    serverAdaptiveState?.cooldownRemainingMs ??
    0;
  const displayedEligibleAt =
    simState?.lastEligibleAt ?? serverLastEligible?.timestamp ?? null;
  const isRecovered =
    simState?.recovered ??
    (displayedState === "RECOVERED" || Boolean(serverLastRecovered?.recovered));

  const stateBadgeVariant =
    displayedState === "ADAPTATION_ELIGIBLE"
      ? "danger"
      : displayedState === "HIGH_FRICTION_CANDIDATE" ||
        displayedState === "COOLDOWN"
      ? "warning"
      : "default";

  return (
    <Card
      className="border-slate-800/90 bg-slate-900/80 shadow-lg"
      data-testid="adaptive-orchestration-panel"
    >
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-slate-100 text-base font-semibold">
              Day 6: Adaptive Friction Threshold Orchestration
            </CardTitle>
            <p className="text-xs text-slate-400">
              Hysteresis (Trigger &ge; 65 / Recovery &lt; 55) · 5s Sustained
              Candidate · 15s Inactivity Guard · 60s Cooldown
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={stateBadgeVariant}
            data-testid="adaptive-state-badge"
          >
            {displayedState}
          </Badge>
          <Badge variant="neutral" data-testid="adaptive-friction-level">
            Level: {displayedLevel.toUpperCase()} ({Math.round(displayedScore)}/100)
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* Human-readable Orchestration Status Banner */}
        <div
          role="status"
          data-testid="adaptive-status-message"
          className={`rounded-xl border p-4 flex items-start gap-3 text-xs ${
            displayedState === "ADAPTATION_ELIGIBLE"
              ? "border-rose-500/40 bg-rose-500/10 text-rose-200"
              : displayedState === "HIGH_FRICTION_CANDIDATE" ||
                displayedState === "COOLDOWN"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {displayedState === "ADAPTATION_ELIGIBLE" ? (
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
          ) : displayedState === "COOLDOWN" ? (
            <PauseCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <p className="font-semibold">{STATE_MESSAGES[displayedState]}</p>
            {simState?.summaryNote && (
              <p className="text-[11px] opacity-90" data-testid="adaptive-sim-note">
                {simState.summaryNote}
              </p>
            )}
          </div>
        </div>

        {/* 4 Telemetry & Decision Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Candidate Duration</span>
              <Activity className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div
              className="text-xl font-bold text-white"
              data-testid="adaptive-candidate-duration"
            >
              {(displayedDurationMs / 1000).toFixed(1)}s{" "}
              <span className="text-xs font-normal text-slate-500">
                / {(requiredDurationMs / 1000).toFixed(0)}s
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Continuous time &ge; 65
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Remaining Cooldown</span>
              <Clock className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <div
              className="text-xl font-bold text-white"
              data-testid="adaptive-cooldown-remaining"
            >
              {Math.ceil(displayedCooldownMs / 1000)}s
            </div>
            <p className="text-[11px] text-slate-500">
              60s anti-spam lockout
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Last Eligibility Event</span>
              <Sparkles className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <div
              className="text-sm font-semibold text-white pt-1"
              data-testid="adaptive-last-eligible"
            >
              {displayedEligibleAt
                ? new Date(displayedEligibleAt).toTimeString().slice(0, 8)
                : "None Triggered"}
            </div>
            <p className="text-[11px] text-slate-500">
              {sessionId
                ? `Session ${sessionId.slice(0, 8)}...`
                : "Local simulation scope"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Recovery Status</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div
              className="text-sm font-semibold text-white pt-1"
              data-testid="adaptive-recovery-status"
            >
              {isRecovered
                ? "Recovered (< 55)"
                : displayedScore >= 55 && displayedScore < 65
                ? "Hysteresis Hold (55–64)"
                : displayedScore >= 65
                ? "Elevated (>= 65)"
                : "Baseline (< 55)"}
            </div>
            <p className="text-[11px] text-slate-500">
              Hysteresis reset below 55
            </p>
          </div>
        </div>

        {/* Development-Only 7-Scenario Adaptive Simulator */}
        {!isProduction && (
          <div
            className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3"
            data-testid="adaptive-dev-simulator"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <FlaskConical className="h-4 w-4 text-emerald-400" />
                <span>
                  Development Adaptive Scenario Simulator (Real Scoring &amp;
                  State Pipeline)
                </span>
              </div>
              {simState && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearSimTimers();
                    setSimState(null);
                  }}
                  data-testid="adaptive-sim-clear-btn"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Clear Simulation
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => runAdaptiveScenario("normal_user")}
                data-testid="sim-adaptive-normal-btn"
              >
                A. Normal User
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => runAdaptiveScenario("temporary_spike")}
                data-testid="sim-adaptive-spike-btn"
              >
                B. Temporary Spike
              </Button>
              <Button
                type="button"
                size="sm"
                variant="amber"
                onClick={() => runAdaptiveScenario("sustained_high_friction")}
                data-testid="sim-adaptive-sustained-btn"
              >
                C. Sustained High Friction
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => runAdaptiveScenario("recovery")}
                data-testid="sim-adaptive-recovery-btn"
              >
                D. Recovery
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => runAdaptiveScenario("cooldown")}
                data-testid="sim-adaptive-cooldown-btn"
              >
                E. Cooldown
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => runAdaptiveScenario("new_friction_episode")}
                data-testid="sim-adaptive-new-episode-btn"
              >
                F. New Friction Episode
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => runAdaptiveScenario("inactive_user")}
                data-testid="sim-adaptive-inactive-btn"
              >
                G. Inactive User
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}