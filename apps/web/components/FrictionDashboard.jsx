"use client";

import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { useFriction } from "@/context/FrictionContext";
import { SECTION_LABELS } from "@/friction/frictionConfig.js";
import FrictionScoreCard from "@/components/FrictionScoreCard";
import SectionFrictionList from "@/components/SectionFrictionList";
import InteractionLog from "@/components/InteractionLog";

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function FrictionDashboard() {
  const { score, status, sections, stats, log, notifications, thresholds, windowMs, dismissNotification, reset } =
    useFriction();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Friction monitor</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Developer view. Tracks interaction patterns (clicks, pauses, errors, navigation) per section. A high score
            means a section may be hard to use. It does not show how a person feels, and no field values are recorded.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Reset metrics
        </button>
      </div>

      {notifications.length > 0 ? (
        <ul className="space-y-2" aria-label="High-friction notifications">
          {notifications.map((n) => (
            <li
              key={n.id}
              role="status"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="font-semibold">
                  High friction detected in {SECTION_LABELS[n.sectionId]} (score {n.frictionScore})
                </p>
                <p className="mt-0.5 text-xs text-red-700">
                  {n.metrics.repeatedClicks} repeated clicks, {n.metrics.hesitationEvents} hesitations,{" "}
                  {n.metrics.validationErrors} validation errors, {n.metrics.backtracks} backtracks. In a later phase
                  this event will start the AI adaptation.
                </p>
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer text-red-700">Event payload</summary>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-white p-3 text-[11px] text-slate-700">
                    {JSON.stringify(
                      {
                        event: n.event,
                        sectionId: n.sectionId,
                        frictionScore: n.frictionScore,
                        frictionLevel: n.frictionLevel,
                        metrics: n.metrics,
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </div>
              <button
                type="button"
                onClick={() => dismissNotification(n.id)}
                className="rounded-md p-1 text-red-700 hover:bg-red-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <FrictionScoreCard
        title="Overall friction score"
        score={score}
        level={status}
        thresholds={thresholds}
        caption={`Highest section score. Rolling window: ${Math.round(windowMs / 1000)} s.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Repeated clicks" value={stats.totalRepeatedClicks} hint="All session" />
        <StatCard label="Average hesitation" value={formatSeconds(stats.averageHesitationMs)} hint="Per field visit" />
        <StatCard label="Validation errors" value={stats.totalValidationErrors} hint="All session" />
        <StatCard label="Backtracks" value={stats.backtrackCount} hint={`${stats.navigationChanges} section changes`} />
        <StatCard label="Help opens" value={stats.helpInteractions} hint="All session" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionFrictionList sections={sections} />
        <InteractionLog log={log} />
      </div>
    </div>
  );
}
