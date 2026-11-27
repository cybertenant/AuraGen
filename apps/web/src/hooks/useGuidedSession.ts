"use client";

import { useCallback, useMemo, useState } from "react";
import {
  buildSanitizedGuidedContext,
  type GuidedSession,
  type GuidedStep,
  type SanitizedGuidedContext,
} from "@/components/guided/guided-session.contract";

export type GuidedAnswer = string | boolean;

export interface UseGuidedSessionResult {
  currentIndex: number;
  currentStep: GuidedStep | null;
  answers: Readonly<Record<string, GuidedAnswer>>;
  isComplete: boolean;
  progressPercent: number;
  sanitizedContext: SanitizedGuidedContext;
  setAnswer: (fieldId: string, value: GuidedAnswer) => void;
  next: () => void;
  back: () => void;
  reset: () => void;
}

/**
 * Client-local state machine for the guided conversational flow.
 *
 * Answers stay in browser memory only. `sanitizedContext` is the sole value
 * exposed for any downstream AI call and it never contains an answer.
 */
export function useGuidedSession(session: GuidedSession): UseGuidedSessionResult {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, GuidedAnswer>>({});

  const currentStep = session.steps[currentIndex] ?? null;
  const isComplete = currentIndex >= session.steps.length;
  const progressPercent = Math.round(
    (Math.min(currentIndex, session.steps.length) / session.steps.length) * 100
  );

  const sanitizedContext = useMemo(
    () => buildSanitizedGuidedContext(session, currentIndex),
    [session, currentIndex]
  );

  const setAnswer = useCallback((fieldId: string, value: GuidedAnswer) => {
    setAnswers((previous) => ({ ...previous, [fieldId]: value }));
  }, []);

  const next = useCallback(() => {
    setCurrentIndex((index) => Math.min(index + 1, session.steps.length));
  }, [session.steps.length]);

  const back = useCallback(() => {
    setCurrentIndex((index) => Math.max(index - 1, 0));
  }, []);

  const reset = useCallback(() => {
    setCurrentIndex(0);
    setAnswers({});
  }, []);

  return {
    currentIndex,
    currentStep,
    answers,
    isComplete,
    progressPercent,
    sanitizedContext,
    setAnswer,
    next,
    back,
    reset,
  };
}
