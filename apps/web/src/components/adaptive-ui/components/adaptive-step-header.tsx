"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export function AdaptiveStepHeader({
  stepNumber,
  totalSteps,
  title,
  description,
  isReviewStep = false,
}: {
  stepNumber: number;
  totalSteps: number;
  title: string;
  description?: string;
  isReviewStep?: boolean;
}) {
  return (
    <div
      className="space-y-1 border-b border-slate-800/80 pb-3"
      data-testid="adaptive-step-header"
    >
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
        <Sparkles className="h-3.5 w-3.5" />
        <span>
          {isReviewStep
            ? "Final Application Review"
            : `Guided Step ${stepNumber} of ${totalSteps}`}
        </span>
      </div>
      <h3
        className="text-base font-bold text-white"
        data-testid="adaptive-step-title"
      >
        {title}
      </h3>
      {description && (
        <p className="text-xs text-slate-400" data-testid="adaptive-step-description">
          {description}
        </p>
      )}
    </div>
  );
}