"use client";

import React from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGuidedSession, type GuidedAnswer } from "@/hooks/useGuidedSession";
import {
  GuidedSessionSchema,
  type GuidedSession,
  type GuidedStep,
} from "./guided-session.contract";

export interface GuidedSessionPanelProps {
  session: GuidedSession;
}

interface ApprovedFieldProps {
  step: GuidedStep;
  value: GuidedAnswer | undefined;
  onChange: (value: GuidedAnswer) => void;
}

/**
 * Approved component registry for guided sessions.
 * There is intentionally no `dangerouslySetInnerHTML` and no dynamic tag
 * creation here - only these five pre-vetted controls can ever render.
 */
function ApprovedField({ step, value, onChange }: ApprovedFieldProps) {
  const fieldId = `guided-field-${step.fieldId}`;
  const textValue = typeof value === "string" ? value : "";
  const checkedValue = value === true;
  const inputClassName =
    "w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/70";

  switch (step.component) {
    case "text":
      return (
        <input
          id={fieldId}
          data-testid={fieldId}
          type="text"
          value={textValue}
          placeholder={step.helperText}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        />
      );
    case "number":
      return (
        <input
          id={fieldId}
          data-testid={fieldId}
          type="number"
          value={textValue}
          placeholder={step.helperText}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        />
      );
    case "select":
      return (
        <select
          id={fieldId}
          data-testid={fieldId}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
          className={inputClassName}
        >
          <option value="">Choose an option</option>
          {(step.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "checkbox":
    case "confirm":
      return (
        <label
          htmlFor={fieldId}
          className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-200"
        >
          <input
            id={fieldId}
            data-testid={fieldId}
            type="checkbox"
            checked={checkedValue}
            onChange={(event) => onChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-emerald-500"
          />
          <span>{step.helperText ?? step.title}</span>
        </label>
      );
    default:
      return null;
  }
}

function GuidedSessionPanelInner({ session }: { session: GuidedSession }) {
  const {
    currentIndex,
    currentStep,
    answers,
    isComplete,
    progressPercent,
    setAnswer,
    next,
    back,
    reset,
  } = useGuidedSession(session);
  const answeredCount = Object.keys(answers).length;

  return (
    <Card data-testid="guided-session-panel" className="w-full">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            {session.title}
          </CardTitle>
          <p className="text-xs text-slate-400">
            {session.steps.length} small steps · answers stay in your browser
          </p>
        </div>
        <Badge
          variant={session.frictionLevel === "high" ? "warning" : "default"}
        >
          <ShieldCheck className="mr-1.5 h-3 w-3" />
          Guided mode · {session.frictionScore}/100
        </Badge>
      </CardHeader>

      <CardContent className="space-y-6">
        <div
          role="progressbar"
          aria-label="Guided session progress"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {isComplete ? (
          <div data-testid="guided-complete" className="space-y-4 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
            <h2 className="text-xl font-semibold text-white">
              Guided section complete
            </h2>
            <p className="text-sm text-slate-400">
              {answeredCount} of {session.steps.length} answers captured locally.
              No field values were sent to the AI engine.
            </p>
            <Button variant="outline" onClick={reset} data-testid="guided-reset">
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Start again
            </Button>
          </div>
        ) : currentStep ? (
          <div data-testid="guided-step" className="space-y-5">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                Step {currentIndex + 1} of {session.steps.length}
              </p>
              <h2 className="text-xl font-semibold text-white">
                {currentStep.title}
              </h2>
              {currentStep.helperText &&
                currentStep.component !== "checkbox" &&
                currentStep.component !== "confirm" && (
                  <p className="text-sm text-slate-400">
                    {currentStep.helperText}
                  </p>
                )}
            </div>

            <ApprovedField
              step={currentStep}
              value={answers[currentStep.fieldId]}
              onChange={(value) => setAnswer(currentStep.fieldId, value)}
            />

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                onClick={back}
                disabled={currentIndex === 0}
                data-testid="guided-back"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              <Button onClick={next} data-testid="guided-next">
                Next
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * Validates the structured JSON schema before anything is rendered.
 * Invalid schemas fail closed instead of producing an unsafe UI.
 */
export function GuidedSessionPanel({ session }: GuidedSessionPanelProps) {
  const parsed = GuidedSessionSchema.safeParse(session);

  if (!parsed.success) {
    return (
      <Card data-testid="guided-invalid-session" className="w-full">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-rose-400">
            Guided session rejected
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-400">
          The received schema did not pass Zod validation, so nothing was
          rendered.
        </CardContent>
      </Card>
    );
  }

  return <GuidedSessionPanelInner session={parsed.data} />;
}
