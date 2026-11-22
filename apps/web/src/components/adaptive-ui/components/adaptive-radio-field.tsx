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

export function AdaptiveRadioField({
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

  return (
    <AdaptiveFieldShell
      definition={definition}
      helperText={helperText}
      errorMessage={errorMessage}
      density={density}
    >
      <div
        role="radiogroup"
        aria-label={definition.label}
        className={`grid grid-cols-1 sm:grid-cols-2 ${
          density === "compact" ? "gap-1.5" : "gap-2.5"
        }`}
      >
        {(definition.options ?? []).map((opt) => {
          const optionId = `adaptive-field-${definition.fieldId}-${String(opt.value)}`;
          const checked = String(field.value ?? "") === String(opt.value);
          return (
            <label
              key={String(opt.value)}
              htmlFor={optionId}
              className={`flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-950/90 ${
                density === "compact" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2.5 text-xs"
              } text-slate-200 cursor-pointer hover:border-emerald-500/40`}
            >
              <input
                id={optionId}
                name={field.name}
                type="radio"
                value={String(opt.value)}
                checked={checked}
                onChange={() => field.onChange(opt.value)}
                onBlur={field.onBlur}
                disabled={disabled}
                data-auragen-field={definition.fieldId}
                data-testid={`adaptive-radio-${definition.fieldId}-${String(opt.value)}`}
                className="h-3.5 w-3.5 accent-emerald-500"
              />
              <span>{opt.label}</span>
            </label>
          );
        })}
      </div>
    </AdaptiveFieldShell>
  );
}