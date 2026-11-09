"use client";

import { Check } from "lucide-react";

// variant="bar":   completion bar with percentage (dashboard)
// variant="steps": clickable stepper across form sections (form header)
export default function ProgressIndicator({
  variant = "bar",
  percentage = 0,
  steps = [],
  currentStep,
  onStepClick,
}) {
  if (variant === "bar") {
    return (
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-700">Completion</span>
          <span className="text-sm font-semibold text-blue-700">{percentage}%</span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Application completion"
        >
          <div className="h-full rounded-full bg-blue-600" style={{ width: `${percentage}%` }} />
        </div>
      </div>
    );
  }

  return (
    <nav aria-label="Application steps">
      <ol className="flex items-center gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStep;
          return (
            <li key={step.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onStepClick && onStepClick(step.id)}
                aria-current={isCurrent ? "step" : undefined}
                className={`flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isCurrent
                    ? "border-blue-600 bg-blue-600 text-white"
                    : step.complete
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                    isCurrent ? "bg-white/25" : step.complete ? "bg-emerald-600 text-white" : "bg-slate-200"
                  }`}
                >
                  {step.complete && !isCurrent ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                {step.shortLabel}
              </button>
              {index < steps.length - 1 ? <span className="h-px w-4 bg-slate-300" aria-hidden="true" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
