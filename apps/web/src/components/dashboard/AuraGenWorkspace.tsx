"use client";

import React, { useState, useCallback } from "react";
import {
  Activity,
  Sparkles,
  ShieldCheck,
  Gauge,
  FileSpreadsheet,
  Zap,
  RotateCcw,
  Radio,
  Layers,
  Lock,
} from "lucide-react";
import type { CognitiveFrictionEvaluation } from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket";
import { PersistenceWorkbench } from "@/components/persistence/PersistenceWorkbench";
import { SchemaRegistryView } from "@/components/dashboard/SchemaRegistryView";
import { ZeroPiiGuardrailsView } from "@/components/dashboard/ZeroPiiGuardrailsView";

export type ActivePageTab =
  | "telemetry"
  | "application"
  | "schemas"
  | "guardrails";

export interface AuraGenWorkspaceProps {
  initialTab?: ActivePageTab;
}

export function AuraGenWorkspace({
  initialTab = "telemetry",
}: AuraGenWorkspaceProps) {
  const {
    connected,
    frictionScore: socketScore,
    frictionLevel: socketLevel,
    interactionStatus: socketInteractionStatus,
    adaptationStatus: socketAdaptationStatus,
    simulateHighFriction,
    resetFriction,
  } = useTelemetrySocket();

  const [activeTab, setActiveTab] = useState<ActivePageTab>(initialTab);
  const [liveEvaluation, setLiveEvaluation] =
    useState<CognitiveFrictionEvaluation | null>(null);
  const [simTriggerCount, setSimTriggerCount] = useState<number>(0);

  const handleEvaluationChange = useCallback(
    (evalResult: CognitiveFrictionEvaluation) => {
      setLiveEvaluation(evalResult);
    },
    []
  );

  // Merge Day 4 Cognitive Friction Engine score with Day 1 socket simulation fallback
  const engineScore = liveEvaluation ? Math.round(liveEvaluation.smoothedScore) : 0;
  const displayedScore = Math.max(engineScore, socketScore);
  const displayedLevel =
    displayedScore >= 65
      ? "high"
      : displayedScore >= 31
      ? "medium"
      : liveEvaluation?.level ?? socketLevel;

  const displayedInteractionStatus =
    displayedLevel === "high"
      ? "High Cognitive Load"
      : displayedLevel === "medium"
      ? "Elevated Friction"
      : socketInteractionStatus;

  const displayedAdaptationStatus =
    liveEvaluation?.thresholdStatus.isEligibleForAdaptation ||
    socketAdaptationStatus === "Adapting"
      ? "Adapting"
      : liveEvaluation?.thresholdStatus.state === "candidate"
      ? "Analyzing"
      : socketAdaptationStatus;

  const handleHeroSimulateHighFriction = () => {
    simulateHighFriction();
    setSimTriggerCount((c) => c + 1);
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800/80 bg-slate-950/95 px-4 py-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white">
              AuraGen
            </span>
            <p className="text-xs text-slate-400">Cognitive UI Engine</p>
          </div>
        </div>

        <nav
          className="space-y-1.5 flex-1"
          aria-label="Primary Sidebar Navigation"
        >
          <button
            type="button"
            onClick={() => setActiveTab("telemetry")}
            data-testid="nav-telemetry-overview"
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === "telemetry"
                ? "bg-slate-900 text-emerald-400 border border-slate-800 shadow-sm"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Gauge className="h-4 w-4" />
            Telemetry Overview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("application")}
            data-testid="nav-financial-application"
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === "application"
                ? "bg-slate-900 text-emerald-400 border border-slate-800 shadow-sm"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border border-transparent"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Financial Application
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("schemas")}
            data-testid="nav-schema-registry"
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === "schemas"
                ? "bg-slate-900 text-emerald-400 border border-slate-800 shadow-sm"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Layers className="h-4 w-4" />
            Schema Registry
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("guardrails")}
            data-testid="nav-zero-pii-guardrails"
            className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              activeTab === "guardrails"
                ? "bg-slate-900 text-emerald-400 border border-slate-800 shadow-sm"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border border-transparent"
            }`}
          >
            <Lock className="h-4 w-4" />
            Zero-PII Guardrails
          </button>
        </nav>

        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 text-xs text-slate-400 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-300">Socket Stream</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              {connected ? "Connected" : "Standby"}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            Cognitive Friction Engine &amp; Neon PostgreSQL persistence active.
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        <header className="border-b border-slate-800/80 bg-slate-950/75 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-400">
              AuraGen /
            </span>
            <span className="text-sm font-semibold text-emerald-400">
              {activeTab === "telemetry" && "Telemetry & Friction Overview"}
              {activeTab === "application" && "Financial Loan Application"}
              {activeTab === "schemas" && "Schema Registry"}
              {activeTab === "guardrails" && "Zero-PII Guardrails"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={connected ? "default" : "neutral"}>
              <Radio className="mr-1.5 h-3 w-3" />
              {connected ? "Telemetry Live" : "Local Mode"}
            </Badge>
            <Badge variant="neutral">Day 4 Friction Engine</Badge>
          </div>
        </header>

        <main className="flex-1 p-6 md:p-10 max-w-6xl w-full mx-auto">
          {activeTab === "telemetry" && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-800/80 pb-8">
                <div className="space-y-2 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Self-Healing Generative UI via Cognitive Load
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                    AuraGen Adaptive Control Center
                  </h1>
                  <p className="text-slate-400 text-sm md:text-base leading-relaxed">
                    Converts interaction telemetry into a smoothed 0–100
                    Interaction Friction Score and detects sustained cognitive
                    friction before synthesizing simplified UI workflows.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => setActiveTab("application")}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    Open Financial Application
                  </Button>
                  <Button
                    variant="amber"
                    size="lg"
                    onClick={handleHeroSimulateHighFriction}
                  >
                    <Zap className="mr-2 h-4 w-4" />
                    Simulate High Friction
                  </Button>
                  {displayedScore > 0 && (
                    <Button
                      variant="outline"
                      size="default"
                      onClick={resetFriction}
                      aria-label="Reset Friction"
                    >
                      <RotateCcw className="mr-1.5 h-4 w-4" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Core Telemetry Status Cards */}
              <section
                aria-label="Cognitive Telemetry Metrics"
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Interaction Friction Score</CardTitle>
                    <Gauge className="h-4 w-4 text-emerald-400" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline gap-3">
                      <span
                        data-testid="friction-score-value"
                        className="text-4xl font-bold tracking-tight text-white"
                      >
                        {displayedScore}
                      </span>
                      <span className="text-xs text-slate-400">
                        / 100 threshold
                      </span>
                      <Badge
                        variant={
                          displayedLevel === "high"
                            ? "danger"
                            : displayedLevel === "medium"
                            ? "warning"
                            : "default"
                        }
                        className="ml-auto"
                      >
                        {displayedLevel.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          displayedScore >= 65
                            ? "bg-rose-500"
                            : displayedScore >= 31
                            ? "bg-amber-400"
                            : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(100, displayedScore)}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-400">
                      Estimated Cognitive Load heuristic from hesitation, errors,
                      clicks, backtracking, and pointer jitter.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>Current Interaction Status</CardTitle>
                    <Activity className="h-4 w-4 text-sky-400" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        data-testid="interaction-status-value"
                        className="text-2xl font-semibold text-white"
                      >
                        {displayedInteractionStatus}
                      </span>
                      <Badge
                        variant={
                          displayedInteractionStatus === "Normal"
                            ? "default"
                            : "warning"
                        }
                      >
                        Active Session
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Tracks micro-interaction cadence across multi-part
                      institutional onboarding schedules.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle>AI Adaptation Status</CardTitle>
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        data-testid="adaptation-status-value"
                        className="text-2xl font-semibold text-white"
                      >
                        {displayedAdaptationStatus}
                      </span>
                      <Badge
                        variant={
                          displayedAdaptationStatus === "Waiting"
                            ? "neutral"
                            : "warning"
                        }
                      >
                        Gemini Schema Engine
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Awaits sustained high friction (&ge; 65 for 5s) before
                      synthesizing Zod-validated conversational UI schemas.
                    </p>
                  </CardContent>
                </Card>
              </section>

              {/* Integrated Day 4 Friction Engine + Day 3 Telemetry + Day 2 Persistence */}
              <PersistenceWorkbench
                onFrictionEvaluationChange={handleEvaluationChange}
                externalSimulationTrigger={simTriggerCount}
              />
            </div>
          )}

          {activeTab === "application" && (
            <div className="max-w-5xl mx-auto space-y-6">
              <div className="text-center space-y-2 max-w-2xl mx-auto pb-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Institutional Credit &amp; Treasury Onboarding
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white">
                  5-Section Financial Loan Application
                </h1>
                <p className="text-sm text-slate-400">
                  Complete the 5-step synthetic loan application below. Live
                  Cognitive Friction Engine scoring and Neon PostgreSQL draft
                  persistence are active.
                </p>
              </div>
              <PersistenceWorkbench
                onFrictionEvaluationChange={handleEvaluationChange}
                externalSimulationTrigger={simTriggerCount}
              />
            </div>
          )}

          {activeTab === "schemas" && <SchemaRegistryView />}
          {activeTab === "guardrails" && <ZeroPiiGuardrailsView />}
        </main>
      </div>
    </div>
  );
}