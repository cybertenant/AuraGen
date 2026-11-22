"use client";

import React from "react";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AdaptiveNavigation({
  canGoPrevious,
  isLastStep,
  nextLabel,
  previousLabel,
  submitLabel,
  disabled,
  onPrevious,
  onNext,
  onSubmitDraft,
}: {
  canGoPrevious: boolean;
  isLastStep: boolean;
  nextLabel: string;
  previousLabel: string;
  submitLabel: string;
  disabled?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmitDraft: () => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80"
      data-testid="adaptive-navigation"
    >
      <Button
        type="button"
        variant="secondary"
        disabled={!canGoPrevious || disabled}
        onClick={onPrevious}
        data-testid="adaptive-prev-btn"
      >
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {previousLabel}
      </Button>

      {!isLastStep ? (
        <Button
          type="button"
          disabled={disabled}
          onClick={onNext}
          data-testid="adaptive-next-btn"
        >
          {nextLabel}
          <ArrowRight className="ml-1.5 h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          disabled={disabled}
          onClick={onSubmitDraft}
          data-testid="adaptive-submit-btn"
        >
          <Save className="mr-1.5 h-4 w-4" />
          {submitLabel}
        </Button>
      )}
    </div>
  );
}