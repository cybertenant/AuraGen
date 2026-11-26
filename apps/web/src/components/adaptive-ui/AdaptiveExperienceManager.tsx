"use client";

import React, { Component, ErrorInfo, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { CANONICAL_FINANCIAL_LOAN_FORM } from "./canonical/canonical-loan-form";
import { validateAdaptiveSchemaOnClient } from "./schemas/client-security-guard";
import { AdaptiveUIRenderer } from "./renderer/adaptive-ui-renderer";
import type { AdaptiveUISchema } from "./types/adaptive-ui.types";

export type AdaptiveExperienceMode =
  | "original"
  | "generating"
  | "pending_activation"
  | "adaptive"
  | "failed";

export interface IncomingAdaptationReadyPayload {
  sessionId: string;
  generationId: string;
  adaptationId: string;
  status: "validated";
  schemaVersion: number;
  schema: unknown;
  timestamp: string;
}

export interface AdaptiveExperienceManagerProps {
  sessionId: string | null;
  children: ReactNode;
  incomingReadyPayload?: IncomingAdaptationReadyPayload | null;
  isGenerating?: boolean;
  generationErrorMessage?: string | null;
  onConfirmRendered?: (ack: {
    sessionId: string;
    adaptationId: string;
    generationId: string;
    schemaVersion: 1;
    rendered: true;
  }) => void;
  onModeChange?: (mode: AdaptiveExperienceMode) => void;
}

interface ErrorBoundaryProps {
  onErrorFallback: (error: Error) => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class AdaptiveRendererErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, _info: ErrorInfo): void {
    this.props.onErrorFallback(error);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

/**
 * AdaptiveExperienceManager (Day 11).
 * Orchestrates seamless, non-destructive transitions between the original
 * 17-field financial loan form and the AI-generated adaptive wizard inside
 * the SAME React Hook Form <FormProvider> context.
 */
export function AdaptiveExperienceManager({
  sessionId,
  children,
  incomingReadyPayload,
  isGenerating = false,
  generationErrorMessage = null,
  onConfirmRendered,
  onModeChange,
}: AdaptiveExperienceManagerProps) {
  const formContext = useFormContext();
  const [mode, setMode] = useState<AdaptiveExperienceMode>("original");
  const [validatedSchema, setValidatedSchema] = useState<AdaptiveUISchema | null>(
    null
  );
  const [activeAdaptationMeta, setActiveAdaptationMeta] = useState<{
    adaptationId: string;
    generationId: string;
    schemaVersion: 1;
  } | null>(null);
  const [statusBannerMessage, setStatusBannerMessage] = useState<string | null>(
    null
  );
  const [isInputFocused, setIsInputFocused] = useState(false);

  const dismissedAdaptationIdsRef = useRef<Set<string>>(new Set());
  const confirmedRenderedIdsRef = useRef<Set<string>>(new Set());

  const updateMode = useCallback(
    (next: AdaptiveExperienceMode) => {
      setMode(next);
      onModeChange?.(next);
    },
    [onModeChange]
  );

  // Track focus inside the form so we never interrupt active typing
  const handleFocusCapture = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
      setIsInputFocused(true);
    }
  }, []);

  const handleBlurCapture = useCallback(() => {
    setIsInputFocused(false);
  }, []);

  useEffect(() => {
    if (isGenerating && mode === "original") {
      updateMode("generating");
      setStatusBannerMessage(
        "AuraGen detected sustained friction and is preparing a simplified layout..."
      );
    }
  }, [isGenerating, mode, updateMode]);

  useEffect(() => {
    if (generationErrorMessage) {
      updateMode("failed");
      setStatusBannerMessage(generationErrorMessage);
    }
  }, [generationErrorMessage, updateMode]);

  // Receive adaptation:ready, run client defense-in-depth validation, and stage pending_activation
  useEffect(() => {
    if (!incomingReadyPayload) return;
    if (
      sessionId &&
      incomingReadyPayload.sessionId &&
      incomingReadyPayload.sessionId !== sessionId
    ) {
      return;
    }
    if (dismissedAdaptationIdsRef.current.has(incomingReadyPayload.adaptationId)) {
      return;
    }

    const guard = validateAdaptiveSchemaOnClient(incomingReadyPayload.schema);
    if (!guard.valid) {
      updateMode("failed");
      setStatusBannerMessage(
        `Adaptive layout blocked by client security guard (${guard.statusLabel}). Original form preserved.`
      );
      return;
    }

    setValidatedSchema(incomingReadyPayload.schema as AdaptiveUISchema);
    setActiveAdaptationMeta({
      adaptationId: incomingReadyPayload.adaptationId,
      generationId: incomingReadyPayload.generationId,
      schemaVersion: 1,
    });
    updateMode("pending_activation");
    setStatusBannerMessage(
      "AuraGen has prepared a simpler version of this form."
    );
  }, [incomingReadyPayload, sessionId, updateMode]);

  const handleActivateAdaptiveUI = useCallback(() => {
    if (!validatedSchema || !activeAdaptationMeta) return;
    if (formContext?.formState?.isSubmitting) {
      return;
    }
    updateMode("adaptive");
    setStatusBannerMessage(
      "Simplified adaptive wizard active. All form entries are synchronized."
    );

    if (
      sessionId &&
      onConfirmRendered &&
      !confirmedRenderedIdsRef.current.has(activeAdaptationMeta.adaptationId)
    ) {
      confirmedRenderedIdsRef.current.add(activeAdaptationMeta.adaptationId);
      onConfirmRendered({
        sessionId,
        adaptationId: activeAdaptationMeta.adaptationId,
        generationId: activeAdaptationMeta.generationId,
        schemaVersion: 1,
        rendered: true,
      });
    }
  }, [
    validatedSchema,
    activeAdaptationMeta,
    formContext,
    updateMode,
    sessionId,
    onConfirmRendered,
  ]);

  const handleDismissAdaptiveUI = useCallback(() => {
    if (activeAdaptationMeta) {
      dismissedAdaptationIdsRef.current.add(activeAdaptationMeta.adaptationId);
    }
    updateMode("original");
    setStatusBannerMessage(null);
  }, [activeAdaptationMeta, updateMode]);

  const handleSwitchToOriginal = useCallback(() => {
    updateMode("original");
    setStatusBannerMessage(
      "Returned to standard 5-section loan form. All edits preserved."
    );
  }, [updateMode]);

  const handleRendererFailure = useCallback(() => {
    updateMode("failed");
    setStatusBannerMessage(
      "Adaptive renderer encountered an error. Restored standard loan form with all values preserved."
    );
  }, [updateMode]);

  return (
    <div
      className="space-y-4"
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
      data-adaptive-mode={mode}
    >
      {/* Non-intrusive Adaptive Experience Status & Safe Activation Bar */}
      {(mode !== "original" || statusBannerMessage || validatedSchema) && (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-slate-100 shadow-sm"
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 font-medium">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <span>
                {mode === "generating" && "Preparing Adaptive Layout"}
                {mode === "pending_activation" &&
                  "AuraGen has prepared a simpler version of this form."}
                {mode === "adaptive" && "Adaptive Guided Wizard Active"}
                {mode === "failed" && "Standard Form Preserved"}
                {mode === "original" &&
                  validatedSchema &&
                  "Standard Loan Form Active"}
              </span>
              {activeAdaptationMeta && (
                <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
                  v{activeAdaptationMeta.schemaVersion} ·{" "}
                  {activeAdaptationMeta.adaptationId.slice(0, 8)}
                </span>
              )}
            </div>
            {statusBannerMessage && mode !== "pending_activation" && (
              <p className="text-xs text-slate-300">{statusBannerMessage}</p>
            )}
            {mode === "pending_activation" && isInputFocused && (
              <p className="text-xs text-amber-300">
                Waiting for you to finish editing the current field before switching...
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mode === "pending_activation" && (
              <>
                <button
                  type="button"
                  onClick={handleActivateAdaptiveUI}
                  className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                >
                  Activate Simplified Form
                </button>
                <button
                  type="button"
                  onClick={handleDismissAdaptiveUI}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  Dismiss
                </button>
              </>
            )}

            {mode === "adaptive" && (
              <button
                type="button"
                onClick={handleSwitchToOriginal}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                Switch to Original Form
              </button>
            )}

            {mode === "original" && validatedSchema && activeAdaptationMeta && (
              <button
                type="button"
                onClick={handleActivateAdaptiveUI}
                className="rounded-md bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-400"
              >
                Resume Simplified Wizard
              </button>
            )}
          </div>
        </div>
      )}

      {/* Render either the validated Day 7 Dynamic React Renderer or the Original Form */}
      {mode === "adaptive" && validatedSchema ? (
        <AdaptiveRendererErrorBoundary onErrorFallback={handleRendererFailure}>
          <AdaptiveUIRenderer schema={validatedSchema} formDefinition={CANONICAL_FINANCIAL_LOAN_FORM} />
        </AdaptiveRendererErrorBoundary>
      ) : (
        children
      )}
    </div>
  );
}