"use client";

import React from "react";
import type { RegisterOptions, FieldErrors } from "react-hook-form";
import type { FinancialLoanApplication } from "@auragen/shared";
import type { CanonicalFieldDefinition } from "../types/adaptive-ui.types";

export function buildCanonicalRegisterOptions(
  definition: CanonicalFieldDefinition
): RegisterOptions<FinancialLoanApplication> {
  const { required, label, validation } = definition;

  const options: RegisterOptions<FinancialLoanApplication> = {
    required: required ? `${label} is required` : false,
  };

  if (validation.valueAsNumber) {
    options.valueAsNumber = true;
  }
  if (validation.minLength !== undefined) {
    options.minLength = {
      value: validation.minLength,
      message: `${label} must be at least ${validation.minLength} characters`,
    };
  }
  if (validation.maxLength !== undefined) {
    options.maxLength = {
      value: validation.maxLength,
      message: `${label} must be at most ${validation.maxLength} characters`,
    };
  }
  if (validation.min !== undefined) {
    options.min = {
      value: validation.min,
      message: `${label} must be at least ${validation.min}`,
    };
  }
  if (validation.max !== undefined) {
    options.max = {
      value: validation.max,
      message: `${label} must be at most ${validation.max}`,
    };
  }
  if (validation.pattern) {
    options.pattern = {
      value: validation.pattern,
      message: validation.patternMessage || `Invalid ${label}`,
    };
  }

  return options;
}

export function getFieldErrorMessage(
  errors: FieldErrors<FinancialLoanApplication>,
  fieldId: keyof FinancialLoanApplication
): string | undefined {
  const err = errors[fieldId];
  return typeof err?.message === "string" ? err.message : undefined;
}

export function AdaptiveFieldShell({
  definition,
  helperText,
  errorMessage,
  density,
  children,
}: {
  definition: CanonicalFieldDefinition;
  helperText?: string;
  errorMessage?: string;
  density: "comfortable" | "compact";
  children: React.ReactNode;
}) {
  const inputId = `adaptive-field-${definition.fieldId}`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const effectiveHelper = helperText ?? definition.defaultHelperText;

  return (
    <div
      className={density === "compact" ? "space-y-1" : "space-y-1.5"}
      data-testid={`adaptive-field-wrapper-${definition.fieldId}`}
    >
      <label
        htmlFor={inputId}
        className="block text-xs font-medium text-slate-200"
      >
        {definition.label}
        {definition.required && (
          <span className="ml-1 text-rose-400" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children}

      {effectiveHelper && !errorMessage && (
        <p id={helperId} className="text-[11px] text-slate-400">
          {effectiveHelper}
        </p>
      )}

      {errorMessage && (
        <p
          id={errorId}
          role="alert"
          data-testid={`adaptive-error-${definition.fieldId}`}
          className="text-[11px] font-medium text-rose-400"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}