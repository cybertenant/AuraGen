"use client";

import React, { useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket";

export default function AuraGenDashboardPage() {
  const {
    connected,
    frictionScore,
    frictionLevel,
    interactionStatus,
    adaptationStatus,
    simulateHighFriction,
    resetFriction,
  } = useTelemetrySocket();

  const [formPreviewBanner, setFormPreviewBanner] = useState(false);

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-800/80 bg-slate-950/90 px-4 py-6">
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

        <nav className="space-y-1.5 flex-1">
          <a
            href="#dashboard"
            className="flex items-center gap-3 rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-emerald-400 border border-slate-800"
          >
            <Gauge className="h-4 w-4" />
            Telemetry Overview
          </a>
          <a
            href="#application"
            onClick={(e) => {
              e.preventDefault();
              setFormPreviewBanner(true);
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Financial Application
          </a>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500">
            <Layers className="h-4 w-4" />
            Schema Registry
          </div>
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500">
            <Lock className="h-4 w-4" />
            Zero-PII Guardrails
          </div>
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
            Real-time WebSocket pipeline ready for Day 4+ interaction telemetry.
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Header */}
        <header className="border-b border-slate-800/80 bg-slate-950/75 backdrop-blur sticky top-0 z-10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-400">
              Workspace /
            </span>
            <span className="text-sm font-semibold text-slate-100">
              Institutional Credit & Treasury Onboarding
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={connected ? "default" : "neutral"}>
              <Radio className="mr-1.5 h-3 w-3" />
              {connected ? "Telemetry Live" : "Local Mode"}
            </Badge>
            <Badge variant="neutral">Day 1 Foundation</Badge>
          </div>
        </header>

        {/* Dashboard Body */}
        <main className="flex-1 p-6 md:p-10 max-w-6xl w-full mx-auto space-y-8">
          {/* Hero Section */}
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
                Monitors hesitation, repeated clicks, validation loops, and
                backtracking on complex financial disclosures—automatically
                morphing high-friction forms into guided conversational steps.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => setFormPreviewBanner(true)}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Open Financial Application
              </Button>
              <Button
                variant="amber"
                size="lg"
                onClick={simulateHighFriction}
              >
                <Zap className="mr-2 h-4 w-4" />
                Simulate High Friction
              </Button>
              {frictionScore > 0 && (
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
            {/* Card 1: Cognitive Friction Score */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Cognitive Friction Score</CardTitle>
                <Gauge className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span
                    data-testid="friction-score-value"
                    className="text-4xl font-bold tracking-tight text-white"
                  >
                    {frictionScore}
                  </span>
                  <span className="text-xs text-slate-400">/ 100 threshold</span>
                  <Badge
                    variant={
                      frictionLevel === "high"
                        ? "danger"
                        : frictionLevel === "medium"
                        ? "warning"
                        : "default"
                    }
                    className="ml-auto"
                  >
                    {frictionLevel.toUpperCase()}
                  </Badge>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      frictionScore >= 70
                        ? "bg-rose-500"
                        : frictionScore >= 40
                        ? "bg-amber-400"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(100, frictionScore)}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  Real-time composite index of user hesitation, field thrashing,
                  and validation errors.
                </p>
              </CardContent>
            </Card>

            {/* Card 2: Current Interaction Status */}
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
                    {interactionStatus}
                  </span>
                  <Badge
                    variant={
                      interactionStatus === "Normal" ? "default" : "warning"
                    }
                  >
                    Active Session
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tracks micro-interaction cadence across multi-part institutional
                  onboarding schedules.
                </p>
              </CardContent>
            </Card>

            {/* Card 3: AI Adaptation Status */}
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
                    {adaptationStatus}
                  </span>
                  <Badge
                    variant={
                      adaptationStatus === "Waiting" ? "neutral" : "warning"
                    }
                  >
                    Gemini Schema Engine
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Awaits sustained high friction before synthesizing Zod-validated
                  conversational UI schemas.
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Interactive Feedback Banner when "Open Financial Application" is clicked */}
          {formPreviewBanner && (
            <Card className="border-emerald-500/30 bg-emerald-950/10">
              <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Module Queued</Badge>
                    <h4 className="text-sm font-semibold text-white">
                      Complex Commercial Credit & Tax Compliance Form
                    </h4>
                  </div>
                  <p className="text-xs text-slate-400">
                    Day 1 Foundation active. Full multi-section React Hook Form
                    with field-level cognitive sensors will be mounted in upcoming
                    stages.
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setFormPreviewBanner(false)}
                >
                  Dismiss Preview
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}