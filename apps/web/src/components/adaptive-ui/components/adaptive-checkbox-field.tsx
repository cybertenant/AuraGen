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

export function AdaptiveCheckboxField({
  definition,
  helperText,
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
      <label
        htmlFor={inputId}
        className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 cursor-pointer"
      >
        <input
          id={inputId}
          name={field.name}
          ref={field.ref}
          type="checkbox"
          checked={Boolean(field.value)}
          onChange={(e) => field.onChange(e.target.checked)}
          onBlur={field.onBlur}
          disabled={disabled}
          aria-required={definition.required}
          data-auragen-field={definition.fieldId}
          data-testid={`adaptive-input-${definition.fieldId}`}
          className="h-4 w-4 rounded accent-emerald-500"
        />
        <span>{definition.placeholder ?? definition.label}</span>
      </label>
    </AdaptiveFieldShell>
  );
}