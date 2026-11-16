"use client";

import React from "react";
import {
  Gauge,
  Sparkles,
  Zap,
  RotateCcw,
  Activity,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Database,
  Info,
} from "lucide-react";
import type { CognitiveFrictionEvaluation } from "@auragen/shared";
import type { FrictionSimulationScenario } from "@/hooks/useCognitiveFrictionEngine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface CognitiveFrictionPanelProps {
  evaluation: CognitiveFrictionEvaluation;
  activeScenarioName: FrictionSimulationScenario | null;
  isSimulationActive: boolean;
  persistenceStatus: {
    lastPersistedAt: string | null;
    lastPersistedScore: number | null;
    error: string | null;
    totalSavedCount: number;
  };
  onRunSimulation: (scenario: FrictionSimulationScenario) => void;
  onClearSimulation: () => void;
  onResetEngine: () => void;
}

const IS_DEV_MODE = process.env.NODE_ENV !== "production";

export function CognitiveFrictionPanel({
  evaluation,
  activeScenarioName,
  isSimulationActive,
  persistenceStatus,
  onRunSimulation,
  onClearSimulation,
  onResetEngine,
}: CognitiveFrictionPanelProps) {
  const {
    rawScore,
    smoothedScore,
    level,
    signals,
    contributions,
    thresholdStatus,
  } = evaluation;

  // SVG Circular Gauge math
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference - (Math.min(100, Math.max(0, smoothedScore)) / 100) * circumference;

  const gaugeStrokeColor =
    level === "high"
      ? "#f43f5e"
      : level === "medium"
      ? "#f59e0b"
      : "#10b981";

  const signalRows = [
    {
      key: "validationErrors",
      label: "Validation Errors (30% weight)",
      normalized: signals.validationErrors,
      points: contributions.validationErrors,
      maxPoints: 30,
      barColor: "bg-rose-500",
    },
    {
      key: "hesitation",
      label: "Field Hesitation (25% weight)",
      normalized: signals.hesitation,
      points: contributions.hesitation,
      maxPoints: 25,
      barColor: "bg-amber-400",
    },
    {
      key: "repeatedClicks",
      label: "Repeated Clicks (20% weight)",
      normalized: signals.repeatedClicks,
      points: contributions.repeatedClicks,
      maxPoints: 20,
      barColor: "bg-orange-400",
    },
    {
      key: "backtracking",
      label: "Section Backtracking (15% weight)",
      normalized: signals.backtracking,
      points: contributions.backtracking,
      maxPoints: 15,
      barColor: "bg-purple-400",
    },
    {
      key: "cursorAnomaly",
      label: "Cursor Anomaly (10% weight)",
      normalized: signals.cursorAnomaly,
      points: contributions.cursorAnomaly,
      maxPoints: 10,
      barColor: "bg-sky-400",
    },
  ];

  return (
    <Card
      className="border-slate-800/90 bg-slate-900/75"
      data-testid="cognitive-friction-engine-panel"
    >
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-emerald-400" />
            <CardTitle className="text-slate-100 font-semibold text-base">
              Day 4: Cognitive Friction Engine & Real-Time Scoring
            </CardTitle>
            <Badge
              variant={
                level === "high"
                  ? "danger"
                  : level === "medium"
                  ? "warning"
                  : "default"
              }
              data-testid="engine-friction-level-badge"
            >
              {level.toUpperCase()} FRICTION
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Deterministic weighted heuristic (0–100) with exponential smoothing
            (α = 0.35) and sustained 5s adaptation threshold detection.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSimulationActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClearSimulation}
              data-testid="exit-simulation-btn"
            >
              Return to Live Telemetry
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onResetEngine}
            data-testid="reset-friction-engine-btn"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset Engine
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Top Row: Circular Gauge + Raw/Smoothed Metrics + Adaptation Eligibility */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Circular Score Gauge (4 cols) */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/85 p-5">
            <div className="relative flex items-center justify-center">
              <svg className="h-36 w-36 -rotate-90" viewBox="0 0 128 128">
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="transparent"
                  stroke="#1e293b"
                  strokeWidth="10"
                />
                <circle
                  cx="64"
                  cy="64"
                  r={radius}
                  fill="transparent"
                  stroke={gaugeStrokeColor}
                  strokeWidth="10"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-500 ease-out"
                />
              </svg>
              <div className="absolute flex flex-col items-center text-center">
                <span
                  data-testid="engine-smoothed-score"
                  className="text-3xl font-bold tracking-tight text-white"
                >
                  {Math.round(smoothedScore)}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-slate-400">
                  Smoothed
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-4 text-xs">
              <div className="text-center">
                <span className="text-slate-500 block text-[11px]">
                  Raw Score
                </span>
                <span
                  data-testid="engine-raw-score"
                  className="font-mono font-semibold text-slate-200"
                >
                  {rawScore.toFixed(1)}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div className="text-center">
                <span className="text-slate-500 block text-[11px]">
                  Smoothed Exact
                </span>
                <span className="font-mono font-semibold text-emerald-400">
                  {smoothedScore.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* 5 Weighted Signal Contributions (5 cols) */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-950/85 p-5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span className="flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-400" />
                Weighted Signal Contributions
              </span>
              <span className="text-slate-400 font-mono">Max 100 pts</span>
            </div>

            <div className="space-y-2.5">
              {signalRows.map((row) => (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">{row.label}</span>
                    <span
                      data-testid={`contribution-${row.key}`}
                      className="font-mono text-slate-200"
                    >
                      {row.points.toFixed(1)} pts{" "}
                      <span className="text-slate-500">
                        (norm {row.normalized.toFixed(2)})
                      </span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${row.barColor}`}
                      style={{
                        width: `${Math.min(
                          100,
                          (row.points / row.maxPoints) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sustained High-Friction & Adaptation Eligibility Card (3 cols) */}
          <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-slate-950/85 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  Adaptation Gate
                </span>
                <Badge
                  variant={
                    thresholdStatus.isEligibleForAdaptation
                      ? "warning"
                      : thresholdStatus.state === "candidate"
                      ? "default"
                      : "neutral"
                  }
                  data-testid="adaptation-eligibility-badge"
                >
                  {thresholdStatus.isEligibleForAdaptation
                    ? "ELIGIBLE"
                    : thresholdStatus.state === "candidate"
                    ? "SUSTAINING"
                    : "MONITORING"}
                </Badge>
              </div>

              <p
                data-testid="adaptation-eligibility-status-text"
                className="text-xs text-slate-300 leading-relaxed"
              >
                {thresholdStatus.isEligibleForAdaptation
                  ? "High friction sustained ≥ 5s. Session marked eligible for future Gemini UI adaptation (AI generation paused until Day 8)."
                  : thresholdStatus.state === "candidate"
                  ? `Score ≥ 65 detected. Sustaining for ${(
                      thresholdStatus.remainingSustainedMs / 1000
                    ).toFixed(1)}s more before eligibility.`
                  : "Awaiting sustained score ≥ 65 for 5 continuous seconds (recovery reset < 55)."}
              </p>
            </div>

            <div className="space-y-1.5 border-t border-slate-800/80 pt-3 text-[11px] text-slate-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> State Machine:
                </span>
                <span className="font-mono text-slate-200">
                  {thresholdStatus.state}
                </span>
              </div>
              {thresholdStatus.cooldownRemainingMs > 0 && (
                <div className="flex items-center justify-between text-amber-300">
                  <span>Cooldown Remaining:</span>
                  <span className="font-mono">
                    {Math.ceil(thresholdStatus.cooldownRemainingMs / 1000)}s
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-1">
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-emerald-400" /> Neon Sync:
                </span>
                <span className="font-mono text-slate-300">
                  {persistenceStatus.totalSavedCount} saved
                </span>
              </div>
              {persistenceStatus.error && (
                <p className="text-[10px] text-amber-400">
                  Offline resilient: {persistenceStatus.error}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Development-Only Deterministic Simulation Bar */}
        {IS_DEV_MODE && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Zap className="h-4 w-4 text-amber-400" />
                <span>
                  Deterministic Friction Engine Simulator (Dev Mode Only)
                </span>
                {activeScenarioName && (
                  <Badge variant="warning">
                    Scenario: {activeScenarioName.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Injects deterministic telemetry through the real scoring,
                smoothing, and 5s threshold pipeline.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onRunSimulation("normal")}
                data-testid="sim-scenario-normal-btn"
              >
                Normal Interaction
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onRunSimulation("moderate")}
                data-testid="sim-scenario-moderate-btn"
              >
                Moderate Friction
              </Button>
              <Button
                type="button"
                size="sm"
                variant="amber"
                onClick={() => onRunSimulation("high_friction")}
                data-testid="sim-scenario-high-btn"
              >
                High Friction Episode
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onRunSimulation("spike_and_recovery")}
                data-testid="sim-scenario-spike-btn"
              >
                Spike &amp; Recovery
              </Button>
            </div>
          </div>
        )}

        {/* Ethical & Heuristic Transparency Disclaimer */}
        <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3.5 py-2.5 flex items-start gap-2.5 text-[11px] text-slate-400">
          <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-300">
              Interaction Friction Score (Estimated Cognitive Load):
            </strong>{" "}
            This metric is an interaction-behavior heuristic derived from form
            hesitation, validation retries, repeated clicks, backtracking, and
            pointer jitter. It is used solely to simplify complex UI layouts and
            is not a clinical or psychological measurement.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}