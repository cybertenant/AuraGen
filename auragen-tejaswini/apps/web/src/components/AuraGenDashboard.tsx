"use client";

import { useState } from "react";
import { Gauge, RotateCcw, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useFrictionTelemetry } from "@/hooks/useFrictionTelemetry";
import { GuidedView } from "./GuidedView";

const FIELD_IDS = ["annualIncome", "loanPurpose", "syntheticDataDeclaration"];

export function AuraGenDashboard() {
  const telemetry = useFrictionTelemetry();
  const [rawUi, setRawUi] = useState<unknown>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestAdaptation() {
    setLoading(true);
    setError("");
    try {
      const base =
        process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:4000";
      const response = await fetch(`${base}/api/adaptations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only aggregated signals and field IDs are sent - never values.
        body: JSON.stringify({
          sessionId: "demo-session",
          signals: telemetry.signals,
          fieldIds: FIELD_IDS,
        }),
      });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = (await response.json()) as { ui: unknown };
      setRawUi(data.ui);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Adaptation failed");
    } finally {
      setLoading(false);
    }
  }

  const barColor =
    telemetry.level === "high"
      ? "bg-rose-500"
      : telemetry.level === "medium"
      ? "bg-amber-400"
      : "bg-emerald-500";

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-12">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" />
          Guardrails: validated JSON · approved components · zero PII
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          AuraGen Control Center
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Interact with the form below. AuraGen measures aggregated interaction
          friction and, when it is sustained, replaces the form with a guided
          step-by-step experience.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center justify-between text-sm text-slate-400">
            Friction score <Gauge className="h-4 w-4 text-emerald-400" />
          </div>
          <p data-testid="friction-score" className="mt-2 text-3xl font-bold text-white">
            {telemetry.score}
            <span className="ml-1 text-sm font-normal text-slate-500">/100</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all ${barColor}`}
              style={{ width: `${telemetry.score}%` }}
            />
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Friction level</p>
          <p data-testid="friction-level" className="mt-2 text-2xl font-semibold capitalize text-white">
            {telemetry.level}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-sm text-slate-400">Adaptation</p>
          <p className="mt-2 text-2xl font-semibold text-white">
            {rawUi ? "Guided" : "Full form"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Available at score ≥ 65
          </p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={telemetry.simulateHighFriction}
          className="inline-flex items-center rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-300 ring-1 ring-amber-500/30"
        >
          <Zap className="mr-2 h-4 w-4" /> Simulate friction
        </button>
        <button
          type="button"
          onClick={requestAdaptation}
          disabled={loading}
          className="inline-flex items-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? "Generating…" : "Generate guided UI"}
        </button>
        <button
          type="button"
          onClick={() => {
            telemetry.reset();
            setRawUi(null);
          }}
          className="inline-flex items-center rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200"
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Reset
        </button>
      </div>

      {error && <p className="text-sm text-rose-400">{error}</p>}

      {rawUi ? (
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <GuidedView rawUi={rawUi} />
        </section>
      ) : (
        <section className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <h2 className="text-lg font-semibold text-white">
            Institutional loan application
          </h2>
          <div className="space-y-2">
            <label htmlFor="annualIncome" className="block text-sm text-slate-300">
              Annual income (USD)
            </label>
            <input
              id="annualIncome"
              type="number"
              onFocus={telemetry.beginFocus}
              onBlur={telemetry.endFocus}
              onChange={telemetry.recordClick}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="loanPurpose" className="block text-sm text-slate-300">
              Loan purpose
            </label>
            <select
              id="loanPurpose"
              onFocus={telemetry.beginFocus}
              onBlur={telemetry.endFocus}
              onChange={telemetry.recordClick}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">Choose one</option>
              <option value="working_capital">Working capital</option>
              <option value="equipment">Equipment</option>
            </select>
          </div>
          <label className="flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              onClick={telemetry.recordClick}
              onChange={telemetry.recordValidationError}
            />
            I confirm the data is synthetic
          </label>
        </section>
      )}
    </main>
  );
}
