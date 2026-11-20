import type {
  AdaptiveOrchestrationState,
  FrictionLevel,
} from "@auragen/shared";

export interface Clock {
  now(): number;
}

export const SystemClock: Clock = {
  now: () => Date.now(),
};

export interface AdaptiveSessionState {
  sessionId: string;
  state: AdaptiveOrchestrationState;
  candidateStartedAtMs: number | null;
  lastEligibilityAtMs: number | null;
  cooldownExpiresAtMs: number | null;
  episodeTriggered: boolean;
  lastTelemetryAtMs: number | null;
  lastScore: number;
  lastLevel: FrictionLevel;
}

export type AdaptiveTransitionEventType =
  | "candidate_started"
  | "sustained_high_friction_alert"
  | "adaptation_eligible"
  | "adaptation_deferred"
  | "friction_recovered"
  | "inactivity_candidate_reset";

export interface AdaptiveEvaluationOutcome {
  sessionState: AdaptiveSessionState;
  previousState: AdaptiveOrchestrationState;
  score: number;
  level: FrictionLevel;
  durationMs: number;
  requiredDurationMs: number;
  cooldownRemainingMs: number;
  resetReason: "none" | "recovered_below_threshold" | "inactivity_gap_exceeded";
  emittedEvents: AdaptiveTransitionEventType[];
  deferralReason?: "cooldown_active" | "episode_already_triggered_awaiting_recovery";
  alertMessage?: string;
  shouldPersistTransition: boolean;
}