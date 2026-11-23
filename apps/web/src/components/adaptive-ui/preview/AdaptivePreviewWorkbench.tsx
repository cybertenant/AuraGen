"use client";

import React, { useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  FileSpreadsheet,
  Sparkles,
  Loader2,
  Database,
} from "lucide-react";
import type {
  FinancialLoanApplication,
  ValidationErrorCategory,
} from "@auragen/shared";
import { CANONICAL_FINANCIAL_LOAN_FORM } from "../canonical/canonical-loan-form";
import {
  ADAPTIVE_DEVELOPMENT_FIXTURES,
  AdaptiveFixtureDefinition,
} from "../fixtures/adaptive-fixtures";
import { validateAdaptiveUISchema } from "../schemas/adaptive-ui.schema";
import { AdaptiveUIRenderer } from "../renderer/adaptive-ui-renderer";
import { AdaptiveUISchema } from "../types/adaptive-ui.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type PresentationGoalOption =
  | "simplify_cognitive_load"
  | "conversational_guided"
  | "compact_executive";

export type GenerationUiStatus =
  | "Ready"
  | "Generating"
  | "Validating"
  | "Generated"
  | "Failed"
  | "API Unavailable"
  | "Rate Limit Reached"
  | "Persistence Failed";

export interface GeneratedLayoutMetadata {
  model: string;
  providerType: string;
  generationTimeMs: number;
  persisted: boolean;
  persistenceError?: string | null;
}

export interface AdaptivePreviewWorkbenchProps {
  sessionId?: string | null;
  latestFrictionScore?: number;
  externalAdaptiveSchema: AdaptiveUISchema | null;
  onAdaptiveSchemaGenerated?: (schema: AdaptiveUISchema | null) => void;
  disabled?: boolean;
  onSaveDraft?: (values: FinancialLoanApplication) => Promise<void> | void;
  onValidationError?: (
    fieldId: string,
    category: ValidationErrorCategory
  ) => void;
  onBacktrack?: (reason: string) => void;
  renderOriginalForm: () => React.ReactNode;
}

export function AdaptivePreviewWorkbench({
  sessionId,
  latestFrictionScore = 0,
  externalAdaptiveSchema,
  onAdaptiveSchemaGenerated,
  disabled = false,
  onSaveDraft,
  onValidationError,
  onBacktrack,
  renderOriginalForm,
}: AdaptivePreviewWorkbenchProps) {
  const isProduction = process.env.NODE_ENV === "production";
  const formContext = useFormContext<FinancialLoanApplication>();

  const [selectedFixtureId, setSelectedFixtureId] = useState<
    AdaptiveFixtureDefinition["id"]
  >("personalized_wizard");
  const [previewAdaptiveMode, setPreviewAdaptiveMode] = useState<boolean>(false);
  const [activeSource, setActiveSource] = useState<"fixture" | "ai">("fixture");
  const [aiGeneratedSchema, setAiGeneratedSchema] =
    useState<AdaptiveUISchema | null>(null);
  const [presentationGoal, setPresentationGoal] =
    useState<PresentationGoalOption>("simplify_cognitive_load");
  const [generationStatus, setGenerationStatus] =
    useState<GenerationUiStatus>("Ready");
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMeta, setGenerationMeta] =
    useState<GeneratedLayoutMetadata | null>(null);

  const pendingSnapshotRef = React.useRef<FinancialLoanApplication | null>(null);

  const handleSwitchPresentation = (toAdaptive: boolean) => {
    if (formContext) {
      pendingSnapshotRef.current = formContext.getValues();
    }
    setPreviewAdaptiveMode(toAdaptive);
  };

  React.useEffect(() => {
    if (pendingSnapshotRef.current && formContext) {
      const snapshot = pendingSnapshotRef.current;
      pendingSnapshotRef.current = null;
      formContext.reset(snapshot);
    }
  }, [previewAdaptiveMode, selectedFixtureId, activeSource, formContext]);

  const selectedFixture = useMemo(
    () =>
      ADAPTIVE_DEVELOPMENT_FIXTURES.find((f) => f.id === selectedFixtureId) ??
      ADAPTIVE_DEVELOPMENT_FIXTURES[0]!,
    [selectedFixtureId]
  );

  const effectiveAiSchema = externalAdaptiveSchema ?? aiGeneratedSchema;
  const activeCandidateSchema: unknown =
    activeSource === "ai" && effectiveAiSchema
      ? effectiveAiSchema
      : selectedFixture.schema;

  const validationSummary = useMemo(
    () =>
      validateAdaptiveUISchema(
        activeCandidateSchema,
        CANONICAL_FINANCIAL_LOAN_FORM
      ),
    [activeCandidateSchema]
  );

  const handleGenerateAdaptiveLayout = async () => {
    if (!sessionId) {
      setGenerationStatus("Failed");
      setGenerationError("Active demo session is required before generating.");
      return;
    }

    setGenerationStatus("Generating");
    setGenerationError(null);

    try {
      const res = await fetch(`${API_BASE}/api/adaptations/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          presentationGoal,
          triggerScore: latestFrictionScore,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.success || !data?.schema) {
        const code = String(data?.errorCode ?? "");
        if (code === "MISSING_API_KEY" || res.status === 503) {
          setGenerationStatus("API Unavailable");
        } else if (
          code === "RATE_LIMIT_EXCEEDED" ||
          code === "QUOTA_EXHAUSTED" ||
          res.status === 429
        ) {
          setGenerationStatus("Rate Limit Reached");
        } else {
          setGenerationStatus("Failed");
        }
        setGenerationError(
          typeof data?.errorMessage === "string"
            ? data.errorMessage
            : typeof data?.message === "string"
            ? data.message
            : "Adaptive UI generation failed."
        );
        return;
      }

      setGenerationStatus("Validating");
      const clientValidation = validateAdaptiveUISchema(
        data.schema,
        CANONICAL_FINANCIAL_LOAN_FORM
      );

      if (!clientValidation.valid || !clientValidation.schema) {
        setGenerationStatus("Failed");
        setGenerationError(
          "Returned AI schema failed Day 7 client validation."
        );
        return;
      }

      if (formContext) {
        pendingSnapshotRef.current = formContext.getValues();
      }

      setAiGeneratedSchema(clientValidation.schema);
      onAdaptiveSchemaGenerated?.(clientValidation.schema);
      setActiveSource("ai");
      setPreviewAdaptiveMode(true);
      setGenerationMeta({
        model: String(data.model ?? "gemini-2.5-flash"),
        providerType: String(data.providerType ?? "gemini_live"),
        generationTimeMs: Number(data.generationTimeMs ?? 0),
        persisted: Boolean(data.persisted),
        persistenceError: data.persistenceError ?? null,
      });

      setGenerationStatus(
        data.persisted === false ? "Persistence Failed" : "Generated"
      );
    } catch {
      setGenerationStatus("API Unavailable");
      setGenerationError(
        "Backend adaptive generation service is unreachable."
      );
    }
  };

  if (isProduction && !externalAdaptiveSchema) {
    return <>{renderOriginalForm()}</>;
  }

  const isGenerating =
    generationStatus === "Generating" || generationStatus === "Validating";

  return (
    <div className="space-y-4" data-testid="adaptive-preview-container">
      {!isProduction && (
        <div
          className="rounded-xl border border-slate-800 bg-slate-950/90 p-4 space-y-3"
          data-testid="adaptive-dev-preview-toolbar"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">
                Adaptive UI Studio (Day 7 Fixtures & Day 8 Gemini LangChain
                Generator)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  generationStatus === "Generated"
                    ? "default"
                    : generationStatus === "Ready"
                    ? "neutral"
                    : generationStatus === "Generating" ||
                      generationStatus === "Validating"
                    ? "warning"
                    : "danger"
                }
                data-testid="ai-generation-status-badge"
              >
                {generationStatus}
              </Badge>

              {validationSummary.valid ? (
                <Badge
                  variant="default"
                  data-testid="adaptive-fixture-validation-badge"
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Schema Valid (17/17 Canonical Fields)
                </Badge>
              ) : (
                <Badge
                  variant="danger"
                  data-testid="adaptive-fixture-validation-badge"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  Schema Invalid
                </Badge>
              )}
            </div>
          </div>

          {/* Day 8: Controlled AI Adaptive Layout Generation Bar */}
          <div className="rounded-lg border border-emerald-500/20 bg-slate-900/70 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Gemini + LangChain Adaptive Layout Generator</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sends sanitized field metadata only (zero PII or financial
                values) to generate a validated wizard schema.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Presentation Goal"
                value={presentationGoal}
                onChange={(e) =>
                  setPresentationGoal(e.target.value as PresentationGoalOption)
                }
                disabled={isGenerating}
                data-testid="presentation-goal-select"
                className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="simplify_cognitive_load">
                  Simplify Cognitive Load
                </option>
                <option value="conversational_guided">
                  Conversational Guided Flow
                </option>
                <option value="compact_executive">
                  Compact Executive Layout
                </option>
              </select>

              <Button
                type="button"
                size="sm"
                disabled={isGenerating || disabled}
                onClick={() => void handleGenerateAdaptiveLayout()}
                data-testid="generate-adaptive-layout-btn"
              >
                {isGenerating ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isGenerating ? generationStatus : "Generate Adaptive Layout"}
              </Button>
            </div>
          </div>

          {generationError && (
            <div
              role="alert"
              data-testid="ai-generation-error-alert"
              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {generationError}
            </div>
          )}

          {generationMeta && (
            <div
              data-testid="ai-generation-metadata-bar"
              className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-300"
            >
              <span>
                Model: <strong className="text-white">{generationMeta.model}</strong>{" "}
                ({generationMeta.providerType})
              </span>
              <span>
                Latency:{" "}
                <strong className="text-white">
                  {generationMeta.generationTimeMs} ms
                </strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Database className="h-3 w-3 text-emerald-400" />
                Neon Persistence:{" "}
                <strong
                  className={
                    generationMeta.persisted
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                >
                  {generationMeta.persisted ? "Saved (validated)" : "Not Saved"}
                </strong>
              </span>
            </div>
          )}

          {/* Fixture Selector Buttons */}
          <div className="flex flex-wrap gap-2">
            {ADAPTIVE_DEVELOPMENT_FIXTURES.map((fixture) => {
              const active =
                activeSource === "fixture" && fixture.id === selectedFixtureId;
              return (
                <Button
                  key={fixture.id}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "secondary"}
                  onClick={() => {
                    if (formContext) {
                      pendingSnapshotRef.current = formContext.getValues();
                    }
                    setActiveSource("fixture");
                    setSelectedFixtureId(fixture.id);
                  }}
                  data-testid={`select-fixture-${fixture.id}`}
                >
                  {fixture.badge}: {fixture.name}
                </Button>
              );
            })}

            {effectiveAiSchema && (
              <Button
                type="button"
                size="sm"
                variant={activeSource === "ai" ? "amber" : "secondary"}
                onClick={() => {
                  if (formContext) {
                    pendingSnapshotRef.current = formContext.getValues();
                  }
                  setActiveSource("ai");
                  setPreviewAdaptiveMode(true);
                }}
                data-testid="select-ai-generated-schema-btn"
              >
                <Sparkles className="mr-1 h-3 w-3" />
                AI Generated Layout ({effectiveAiSchema.steps.length} Steps)
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400">
              {activeSource === "ai" && effectiveAiSchema ? (
                <>
                  Active Source:{" "}
                  <strong className="text-emerald-300">
                    AI Generated Schema ({effectiveAiSchema.title})
                  </strong>
                </>
              ) : (
                <>
                  Selected Fixture:{" "}
                  <strong className="text-slate-200">{selectedFixture.name}</strong>{" "}
                  — {selectedFixture.summary}
                </>
              )}
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={!previewAdaptiveMode ? "default" : "secondary"}
                onClick={() => handleSwitchPresentation(false)}
                data-testid="view-original-form-btn"
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                Original 5-Section Form
              </Button>

              <Button
                type="button"
                size="sm"
                variant={previewAdaptiveMode ? "amber" : "secondary"}
                onClick={() => handleSwitchPresentation(true)}
                data-testid="view-adaptive-wizard-btn"
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                Preview Adaptive Wizard
              </Button>
            </div>
          </div>
        </div>
      )}

      {previewAdaptiveMode || externalAdaptiveSchema ? (
        <AdaptiveUIRenderer
          key={
            activeSource === "ai" && effectiveAiSchema
              ? `ai-${effectiveAiSchema.title}`
              : selectedFixtureId
          }
          schema={activeCandidateSchema}
          formDefinition={CANONICAL_FINANCIAL_LOAN_FORM}
          disabled={disabled}
          onSaveDraft={onSaveDraft}
          onValidationError={onValidationError}
          onBacktrack={onBacktrack}
        />
      ) : (
        renderOriginalForm()
      )}
    </div>
  );
}