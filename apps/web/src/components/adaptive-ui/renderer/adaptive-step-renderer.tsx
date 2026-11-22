"use client";

import React from "react";
import {
  AdaptiveWizardStep,
  CanonicalFormDefinition,
} from "../types/adaptive-ui.types";
import { AdaptiveStepHeader } from "../components/adaptive-step-header";
import { AdaptiveFieldRenderer } from "./adaptive-field-renderer";

export function AdaptiveStepRenderer({
  step,
  stepIndex,
  totalSteps,
  formDefinition,
  density,
  disabled,
}: {
  step: AdaptiveWizardStep;
  stepIndex: number;
  totalSteps: number;
  formDefinition: CanonicalFormDefinition;
  density: "comfortable" | "compact";
  disabled?: boolean;
}) {
  return (
    <div
      className={density === "compact" ? "space-y-3" : "space-y-4"}
      data-testid={`adaptive-step-container-${step.id}`}
    >
      <AdaptiveStepHeader
        stepNumber={stepIndex + 1}
        totalSteps={totalSteps}
        title={step.title}
        description={step.description}
      />

      <div
        className={
          density === "compact"
            ? "grid grid-cols-1 md:grid-cols-2 gap-3"
            : "space-y-4"
        }
      >
        {step.fields.map((fieldRef) => (
          <AdaptiveFieldRenderer
            key={fieldRef.fieldId}
            fieldRef={fieldRef}
            formDefinition={formDefinition}
            density={density}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}