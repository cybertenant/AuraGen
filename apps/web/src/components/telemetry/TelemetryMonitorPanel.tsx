"use client";

import React from "react";
import {
  Eye,
  Clock,
  MousePointerClick,
  AlertOctagon,
  Undo2,
  Move,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { TelemetrySnapshot, ValidationErrorCategory } from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface TelemetryMonitorPanelProps {
  metrics: TelemetrySnapshot;
  consentGranted: boolean;
  onToggleConsent: (granted: boolean) => void;
  onSimulateValidationError: (
    fieldId: string,
    category: ValidationErrorCategory
  ) => void;
  onSimulateBacktrack: () => void;
  onSimulateCursorAnomaly: () => void;
  onResetTelemetry: () => void;
}

export function TelemetryMonitorPanel({
  metrics,
  consentGranted,
  onToggleConsent,
  onSimulateValidationError,
  onSimulateBacktrack,
  onSimulateCursorAnomaly,
  onResetTelemetry,
}: TelemetryMonitorPanelProps) {
  return (
    <Card className="border-slate-800/90 bg-slate-900/70">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-400" />
            <CardTitle className="text-slate-100 font-semibold text-base">
              Day 3: Real-Time Privacy-Conscious Telemetry Inspector
            </CardTitle>
            <Badge variant={consentGranted ? "default" : "neutral"}>
              {consentGranted ? "Analytics Consent Active" : "Telemetry Paused"}
            </Badge>
          </div>
          <p className="text-xs text-slate-400">
            Observes interaction cadence inside a rolling{" "}
            <span
              data-testid="telemetry-window-seconds"
              className="text-slate-200 font-semibold"
            >
              {metrics.observationWindowSeconds}s
            </span>{" "}
            window. Zero keystrokes, field values, or raw mouse coordinates are
            collected.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggleConsent(!consentGranted)}
            data-testid="toggle-telemetry-consent-btn"
          >
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
            {consentGranted ? "Pause Telemetry" : "Enable Telemetry"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onResetTelemetry}
            data-testid="reset-telemetry-btn"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset Window
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-5 space-y-5">
        {/* 6 Live Signal Metric Boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Field Focuses</span>
              <Eye className="h-3.5 w-3.5 text-sky-400" />
            </div>
            <div
              data-testid="metric-field-focus-count"
              className="text-2xl font-bold text-white"
            >
              {metrics.fieldFocusCount}
            </div>
            <p className="text-[11px] text-slate-500">
              {(metrics.totalFieldFocusDurationMs / 1000).toFixed(1)}s total
              focus
            </p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Hesitations</span>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div
              data-testid="metric-hesitation-count"
              className="text-2xl font-bold text-white"
            >
              {metrics.hesitationCount}
            </div>
            <p className="text-[11px] text-slate-500">&gt; 8s field dwell</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Repeated Clicks</span>
              <MousePointerClick className="h-3.5 w-3.5 text-orange-400" />
            </div>
            <div
              data-testid="metric-repeated-clicks"
              className="text-2xl font-bold text-white"
            >
              {metrics.repeatedClicks}
            </div>
            <p className="text-[11px] text-slate-500">&ge; 3 clicks / 2s</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Validation Errors</span>
              <AlertOctagon className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <div
              data-testid="metric-validation-errors"
              className="text-2xl font-bold text-white"
            >
              {metrics.validationErrors}
            </div>
            <p className="text-[11px] text-slate-500">Category-only logs</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Backtracks</span>
              <Undo2 className="h-3.5 w-3.5 text-purple-400" />
            </div>
            <div
              data-testid="metric-backtracks"
              className="text-2xl font-bold text-white"
            >
              {metrics.backtracks}
            </div>
            <p className="text-[11px] text-slate-500">Section/Step reversals</p>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/80 p-3 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Cursor Anomaly</span>
              <Move className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div
              data-testid="metric-cursor-anomaly"
              className="text-2xl font-bold text-white"
            >
              {metrics.cursorAnomalyScore.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-500">Normalized [0..1]</p>
          </div>
        </div>

        {/* Development Simulation Controls */}
        <div className="rounded-lg border border-slate-800/90 bg-slate-950/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-white">Dev Signal Simulator:</strong>{" "}
              Trigger synthetic interaction signals or interact with the form
              fields below.
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!consentGranted}
              onClick={() =>
                onSimulateValidationError("requestedFacilityUsd", "range")
              }
              data-testid="sim-validation-error-btn"
            >
              + Validation Error
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!consentGranted}
              onClick={onSimulateBacktrack}
              data-testid="sim-backtrack-btn"
            >
              + Step Backtrack
            </Button>
            <Button
              type="button"
              variant="amber"
              size="sm"
              disabled={!consentGranted}
              onClick={onSimulateCursorAnomaly}
              data-testid="sim-cursor-anomaly-btn"
            >
              + Cursor Jitter Burst
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}