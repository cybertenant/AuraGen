"use client";

import { useState } from "react";
import {
  GeneratedUiSchema,
  type GeneratedUi,
} from "@tejaswini/shared";
import {
  ApprovedFieldRenderer,
  type FieldValue,
} from "./ApprovedFieldRenderer";

/** Guardrail 1: validate the structured JSON before anything is rendered. */
export function GuidedView({ rawUi }: { rawUi: unknown }) {
  const parsed = GeneratedUiSchema.safeParse(rawUi);

  if (!parsed.success) {
    return (
      <div
        data-testid="guided-rejected"
        className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300"
      >
        Generated schema was rejected. Nothing was rendered.
      </div>
    );
  }

  return <GuidedFlow ui={parsed.data} />;
}

function GuidedFlow({ ui }: { ui: GeneratedUi }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, FieldValue>>({});
  const step = ui.steps[stepIndex];
  const isComplete = stepIndex >= ui.steps.length;

  if (isComplete || !step) {
    return (
      <div data-testid="guided-complete" className="space-y-2">
        <h2 className="text-lg font-semibold text-emerald-400">All done</h2>
        <p className="text-sm text-slate-400">
          {Object.keys(answers).length} answers captured locally. Your values
          were never sent to the AI engine.
        </p>
      </div>
    );
  }

  return (
    <section data-testid="guided-flow" className="space-y-5">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-emerald-400">
          Step {stepIndex + 1} of {ui.steps.length}
        </p>
        <h2 className="text-xl font-semibold text-white">{step.title}</h2>
        {step.helperText && (
          <p className="text-sm text-slate-400">{step.helperText}</p>
        )}
      </div>

      {step.fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <label htmlFor={`field-${field.id}`} className="block text-sm text-slate-300">
            {field.label}
          </label>
          <ApprovedFieldRenderer
            field={field}
            value={answers[field.id]}
            onChange={(value) =>
              setAnswers((previous) => ({ ...previous, [field.id]: value }))
            }
          />
        </div>
      ))}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          data-testid="guided-back"
          disabled={stepIndex === 0}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          data-testid="guided-next"
          onClick={() => setStepIndex((index) => index + 1)}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950"
        >
          Next
        </button>
      </div>
    </section>
  );
}
