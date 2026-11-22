"use client";

import React, { useState, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import {
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  LayoutGrid,
  FileSpreadsheet,
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

export interface AdaptivePreviewWorkbenchProps {
  externalAdaptiveSchema: AdaptiveUISchema | null;
  disabled?: boolean;
  onSaveDraft?: (values: FinancialLoanApplication) => Promise<void> | void;
  onValidationError?: (
    fieldId: string,
    category: ValidationErrorCategory
  ) => void;
  onBacktrack?: (reason: string) => void;
  renderOriginalForm: () => React.ReactNode;
}

/**
 * Development-only Adaptive UI Preview & Shared Form-State Switcher.
 * Wraps the original 5-section financial form and AdaptiveUIRenderer inside the SAME
 * React Hook Form FormProvider so switching presentations never loses user input.
 */
export function AdaptivePreviewWorkbench({
  externalAdaptiveSchema,
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
  }, [previewAdaptiveMode, selectedFixtureId, formContext]);

  const selectedFixture = useMemo(
    () =>
      ADAPTIVE_DEVELOPMENT_FIXTURES.find((f) => f.id === selectedFixtureId) ??
      ADAPTIVE_DEVELOPMENT_FIXTURES[0]!,
    [selectedFixtureId]
  );

  const activeCandidateSchema: unknown =
    externalAdaptiveSchema ?? selectedFixture.schema;

  const validationSummary = useMemo(
    () =>
      validateAdaptiveUISchema(
        activeCandidateSchema,
        CANONICAL_FINANCIAL_LOAN_FORM
      ),
    [activeCandidateSchema]
  );

  if (isProduction && !externalAdaptiveSchema) {
    return <>{renderOriginalForm()}</>;
  }

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
                Day 7 Adaptive UI Preview (Manually Authored Development
                Fixtures)
              </span>
            </div>

            <div className="flex items-center gap-2">
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

          <p className="text-[11px] text-slate-400">
            Select a manually authored JSON fixture below and toggle between the{" "}
            <strong>Original 5-Section Form</strong> and{" "}
            <strong>Adaptive Wizard Renderer</strong>. Both views share the
            exact same React Hook Form state.
          </p>

          <div className="flex flex-wrap gap-2">
            {ADAPTIVE_DEVELOPMENT_FIXTURES.map((fixture) => {
              const active = fixture.id === selectedFixtureId;
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
                    setSelectedFixtureId(fixture.id);
                  }}
                  data-testid={`select-fixture-${fixture.id}`}
                >
                  {fixture.badge}: {fixture.name}
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <span className="text-[11px] text-slate-400">
              Selected: <strong className="text-slate-200">{selectedFixture.name}</strong> —{" "}
              {selectedFixture.summary}
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
          key={selectedFixtureId}
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