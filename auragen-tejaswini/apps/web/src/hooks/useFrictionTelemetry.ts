"use client";

import { useMemo, useRef, useState } from "react";
import {
  FrictionSignalsSchema,
  computeFrictionScore,
  frictionLevel,
  type FrictionSignals,
} from "@tejaswini/shared";

const EMPTY_SIGNALS: FrictionSignals = FrictionSignalsSchema.parse({});

/** Collects aggregated, privacy-safe interaction signals in the browser. */
export function useFrictionTelemetry() {
  const [signals, setSignals] = useState<FrictionSignals>(EMPTY_SIGNALS);
  const focusStartedAt = useRef<number | null>(null);

  const score = useMemo(() => computeFrictionScore(signals), [signals]);
  const level = frictionLevel(score);

  const recordHesitation = (durationMs: number) =>
    setSignals((previous) => ({
      ...previous,
      hesitationMs: Math.min(600000, previous.hesitationMs + Math.max(0, durationMs)),
    }));

  const recordValidationError = () =>
    setSignals((previous) => ({
      ...previous,
      validationErrors: Math.min(100, previous.validationErrors + 1),
    }));

  const recordBacktrack = () =>
    setSignals((previous) => ({
      ...previous,
      backtracks: Math.min(100, previous.backtracks + 1),
    }));

  const recordClick = () =>
    setSignals((previous) => ({
      ...previous,
      repeatedClicks: Math.min(100, previous.repeatedClicks + 1),
    }));

  const beginFocus = () => {
    focusStartedAt.current = Date.now();
  };

  const endFocus = () => {
    if (focusStartedAt.current !== null) {
      recordHesitation(Date.now() - focusStartedAt.current);
      focusStartedAt.current = null;
    }
  };

  const simulateHighFriction = () =>
    setSignals(
      FrictionSignalsSchema.parse({
        hesitationMs: 45000,
        validationErrors: 4,
        backtracks: 4,
        repeatedClicks: 5,
      })
    );

  const reset = () => setSignals(EMPTY_SIGNALS);

  return {
    signals,
    score,
    level,
    recordValidationError,
    recordBacktrack,
    recordClick,
    beginFocus,
    endFocus,
    simulateHighFriction,
    reset,
  };
}
