"use client";

import React from "react";

export function AdaptiveProgress({
  currentStepIndex,
  totalSteps,
  stepTitles,
  onSelectStep,
}: {
  currentStepIndex: number;
  totalSteps: number;
  stepTitles: string[];
  onSelectStep?: (index: number) => void;
}) {
  const percent = Math.min(
    100,
    Math.round(((currentStepIndex + 1) / Math.max(1, totalSteps)) * 100)
  );

  return (
    <div className="space-y-2.5" data-testid="adaptive-progress">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Step{" "}
          <strong className="text-white" data-testid="adaptive-progress-step">
            {currentStepIndex + 1}
          </strong>{" "}
          of {totalSteps}
        </span>
        <span data-testid="adaptive-progress-percent">{percent}% Complete</span>
      </div>

      <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {stepTitles.map((title, idx) => {
          const active = idx === currentStepIndex;
          const completed = idx < currentStepIndex;
          return (
            <button
              key={`${title}-${idx}`}
              type="button"
              onClick={() => onSelectStep?.(idx)}
              data-testid={`adaptive-progress-pill-${idx}`}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                active
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : completed
                  ? "bg-slate-800/90 text-slate-200 border border-slate-700"
                  : "bg-slate-950/60 text-slate-500 border border-slate-800/80"
              }`}
            >
              {idx + 1}. {title}
            </button>
          );
        })}
      </div>
    </div>
  );
}