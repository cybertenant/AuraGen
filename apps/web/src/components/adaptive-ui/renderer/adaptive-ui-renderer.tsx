"use client";

import React, { useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type {
  FinancialLoanApplication,
  ValidationErrorCategory,
} from "@auragen/shared";
import {
  AdaptiveUISchema,
  CanonicalFormDefinition,
} from "../types/adaptive-ui.types";
import { validateAdaptiveUISchema } from "../schemas/adaptive-ui.schema";
import { AdaptiveProgress } from "../components/adaptive-progress";
import { AdaptiveStepRenderer } from "./adaptive-step-renderer";
import { AdaptiveStepHeader } from "../components/adaptive-step-header";
import { AdaptiveNavigation } from "../components/adaptive-navigation";

export interface AdaptiveUIRendererProps {
  schema: AdaptiveUISchema | unknown;
  formDefinition: CanonicalFormDefinition;
  disabled?: boolean;
  onSaveDraft?: (values: FinancialLoanApplication) => Promise<void> | void;
  onValidationError?: (
    fieldId: string,
    category: ValidationErrorCategory
  ) => void;
  onBacktrack?: (reason: string) => void;
}

class AdaptiveRendererErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message || "Unexpected adaptive rendering failure.",
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          data-testid="adaptive-renderer-error-boundary"
          className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200 space-y-1"
        >
          <p className="font-semibold">
            Adaptive UI fallback triggered — preserving original form state.
          </p>
          {process.env.NODE_ENV !== "production" && (
            <p className="text-[11px] text-rose-300">{this.state.message}</p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

function AdaptiveUIRendererInner({
  schema,
  formDefinition,
  disabled = false,
  onSaveDraft,
  onValidationError,
  onBacktrack,
}: AdaptiveUIRendererProps) {
  const validation = useMemo(
    () => validateAdaptiveUISchema(schema, formDefinition),
    [schema, formDefinition]
  );

  const formContext = useFormContext<FinancialLoanApplication>();
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  if (!validation.valid || !validation.schema) {
    return (
      <div
        role="alert"
        data-testid="adaptive-schema-invalid-fallback"
        className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-2 text-xs text-rose-200"
      >
        <div className="flex items-center gap-2 font-semibold text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Invalid Adaptive UI Schema Rejected — Standard Form Remains Active
          </span>
        </div>
        {process.env.NODE_ENV !== "production" && (
          <ul
            className="list-disc pl-5 space-y-1 text-[11px] text-rose-300"
            data-testid="adaptive-schema-validation-errors"
          >
            {validation.errors.map((err, i) => (
              <li key={`${err.path}-${i}`}>
                <code>{err.path}</code>: {err.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (!formContext) {
    return (
      <div
        role="alert"
        data-testid="adaptive-missing-form-context"
        className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200"
      >
        AdaptiveUIRenderer requires an active React Hook Form FormProvider.
      </div>
    );
  }

  const validSchema = validation.schema;
  // Total steps = schema wizard steps + 1 final review step
  const totalWizardSteps = validSchema.steps.length;
  const totalStepsWithReview = totalWizardSteps + 1;
  const safeStepIndex = Math.min(currentStepIndex, totalStepsWithReview - 1);
  const isReviewStep = safeStepIndex === totalWizardSteps;

  const stepTitles = [
    ...validSchema.steps.map((s) => s.title),
    "Final Review",
  ];

  const handleNext = async () => {
    if (isReviewStep) return;
    const activeStep = validSchema.steps[safeStepIndex];
    if (!activeStep) return;

    const fieldIds = activeStep.fields.map((f) => f.fieldId);
    const stepValid = await formContext.trigger(fieldIds);

    if (!stepValid) {
      const currentErrors = formContext.formState.errors;
      for (const fid of fieldIds) {
        if (currentErrors[fid]) {
          onValidationError?.(fid, "required");
        }
      }
      return;
    }

    setCurrentStepIndex((prev) => Math.min(totalStepsWithReview - 1, prev + 1));
  };

  const handlePrevious = () => {
    if (safeStepIndex <= 0) return;
    onBacktrack?.(`adaptive_wizard_backtrack_from_step_${safeStepIndex + 1}`);
    setCurrentStepIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSelectStep = async (targetIndex: number) => {
    if (targetIndex < safeStepIndex) {
      onBacktrack?.(`adaptive_wizard_pill_backtrack_${targetIndex + 1}`);
      setCurrentStepIndex(targetIndex);
      return;
    }
    if (targetIndex === safeStepIndex + 1) {
      await handleNext();
    }
  };

  const handleSubmitFinal = formContext.handleSubmit(async (values) => {
    await onSaveDraft?.(values);
  });

  const currentValues = formContext.getValues();

  return (
    <div
      className="rounded-xl border border-emerald-500/30 bg-slate-900/90 p-5 space-y-5"
      data-testid="adaptive-ui-renderer-root"
    >
      {/* Wizard Title & Description */}
      <div className="space-y-1">
        <h2
          className="text-lg font-bold text-white"
          data-testid="adaptive-wizard-title"
        >
          {validSchema.title}
        </h2>
        {validSchema.description && (
          <p className="text-xs text-slate-400">{validSchema.description}</p>
        )}
      </div>

      {/* Step Progress Indicator */}
      {validSchema.appearance.showProgress && (
        <AdaptiveProgress
          currentStepIndex={safeStepIndex}
          totalSteps={totalStepsWithReview}
          stepTitles={stepTitles}
          onSelectStep={(idx) => void handleSelectStep(idx)}
        />
      )}

      {/* Active Step OR Final Review Step */}
      {!isReviewStep ? (
        <AdaptiveStepRenderer
          step={validSchema.steps[safeStepIndex]!}
          stepIndex={safeStepIndex}
          totalSteps={totalStepsWithReview}
          formDefinition={formDefinition}
          density={validSchema.appearance.density}
          disabled={disabled}
        />
      ) : (
        <div
          className="space-y-4"
          data-testid="adaptive-final-review-step"
        >
          <AdaptiveStepHeader
            stepNumber={totalStepsWithReview}
            totalSteps={totalStepsWithReview}
            title="Review Your Completed Application"
            description="Confirm all canonical fields below before saving your draft to Neon PostgreSQL."
            isReviewStep
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-slate-800 bg-slate-950/90 p-4 text-xs">
            {formDefinition.fields.map((field) => {
              const rawVal = currentValues[field.fieldId];
              return (
                <div
                  key={field.fieldId}
                  className="space-y-0.5 border-b border-slate-800/60 pb-2"
                >
                  <div className="text-[11px] text-slate-400">
                    {field.label}
                  </div>
                  <div
                    className="font-medium text-slate-100 break-words"
                    data-testid={`adaptive-review-value-${field.fieldId}`}
                  >
                    {rawVal !== undefined && rawVal !== null && rawVal !== ""
                      ? String(rawVal)
                      : "—"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>
              All {formDefinition.fields.length} canonical fields verified and
              synchronized with the shared form state.
            </span>
          </div>
        </div>
      )}

      {/* Wizard Navigation Controls */}
      <AdaptiveNavigation
        canGoPrevious={safeStepIndex > 0}
        isLastStep={isReviewStep}
        nextLabel={validSchema.navigation.nextLabel}
        previousLabel={validSchema.navigation.previousLabel}
        submitLabel={validSchema.navigation.submitLabel}
        disabled={disabled}
        onPrevious={handlePrevious}
        onNext={() => void handleNext()}
        onSubmitDraft={() => void handleSubmitFinal()}
      />
    </div>
  );
}

export function AdaptiveUIRenderer(props: AdaptiveUIRendererProps) {
  return (
    <AdaptiveRendererErrorBoundary>
      <AdaptiveUIRendererInner {...props} />
    </AdaptiveRendererErrorBoundary>
  );
}