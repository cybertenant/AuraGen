"use client";

import React from "react";
import { useFormContext, useController } from "react-hook-form";
import type { FinancialLoanApplication } from "@auragen/shared";
import type { AdaptiveFieldComponentProps } from "../registry/component-types";
import {
  AdaptiveFieldShell,
  buildCanonicalRegisterOptions,
  getFieldErrorMessage,
} from "./adaptive-field-shell";

export function AdaptiveEmailField({
  definition,
  helperText,
  placeholder,
  density,
  disabled,
}: AdaptiveFieldComponentProps) {
  const {
    control,
    getValues,
    formState: { errors },
  } = useFormContext<FinancialLoanApplication>();

  const { field } = useController({
    name: definition.fieldId,
    control,
    defaultValue: getValues(definition.fieldId),
    rules: buildCanonicalRegisterOptions(definition),
  });

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
        name={field.name}
        ref={field.ref}
        type="email"
        value={typeof field.value === "string" ? field.value : ""}
        onChange={field.onChange}
        onBlur={field.onBlur}
        disabled={disabled}
        required={definition.required}
        aria-required={definition.required}
        aria-invalid={Boolean(errorMessage)}
        placeholder={placeholder ?? definition.placeholder}
        data-auragen-field={definition.fieldId}
        data-testid={`adaptive-input-${definition.fieldId}`}
        className={`w-full rounded-lg border bg-slate-950 px-3 ${
          density === "compact" ? "py-1.5 text-xs" : "py-2 text-sm"
        } text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 ${
          errorMessage
            ? "border-rose-500/70 focus:ring-rose-500/40"
            : "border-slate-800 focus:border-emerald-500/60 focus:ring-emerald-500/30"
        } disabled:opacity-50`}
      />
    </AdaptiveFieldShell>
  );
}