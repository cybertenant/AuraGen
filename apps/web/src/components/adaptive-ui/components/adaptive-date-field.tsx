"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import type { FinancialLoanApplication } from "@auragen/shared";
import type { AdaptiveFieldComponentProps } from "../registry/component-types";
import {
  AdaptiveFieldShell,
  buildCanonicalRegisterOptions,
  getFieldErrorMessage,
} from "./adaptive-field-shell";

export function AdaptiveDateField({
  definition,
  helperText,
  density,
  disabled,
}: AdaptiveFieldComponentProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<FinancialLoanApplication>();

  const errorMessage = getFieldErrorMessage(errors, definition.fieldId);
  const inputId = `adaptive-field-${definition.fieldId}`;

  return (
    <AdaptiveFieldShell
      definition={definition}
      helperText={helperText}
      errorMessage={errorMessage}
      density={density}
    >
      <input
        id={inputId}
        type="date"
        disabled={disabled}
        required={definition.required}
        aria-required={definition.required}
        aria-invalid={Boolean(errorMessage)}
        data-auragen-field={definition.fieldId}
        data-testid={`adaptive-input-${definition.fieldId}`}
        className={`w-full rounded-lg border bg-slate-950 px-3 ${
          density === "compact" ? "py-1.5 text-xs" : "py-2 text-sm"
        } text-slate-100 focus:outline-none focus:ring-2 ${
          errorMessage
            ? "border-rose-500/70 focus:ring-rose-500/40"
            : "border-slate-800 focus:border-emerald-500/60 focus:ring-emerald-500/30"
        } disabled:opacity-50`}
        {...register(
          definition.fieldId,
          buildCanonicalRegisterOptions(definition)
        )}
      />
    </AdaptiveFieldShell>
  );
}