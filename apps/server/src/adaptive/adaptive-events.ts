import type {
  FrictionStatePayload,
  FrictionAlertPayload,
  AdaptationEligiblePayload,
  AdaptationDeferredPayload,
  FrictionRecoveredPayload,
} from "@auragen/shared";
import { AdaptiveEvaluationOutcome } from "./adaptive.types.js";
import { AdaptiveThresholdConfig } from "./adaptive.config.js";

export interface BuiltAdaptiveSocketPayloads {
  frictionState: FrictionStatePayload;
  frictionAlerts: FrictionAlertPayload[];
  adaptationEligible: AdaptationEligiblePayload | null;
  adaptationDeferred: AdaptationDeferredPayload | null;
  frictionRecovered: FrictionRecoveredPayload | null;
}

export function buildAdaptiveSocketPayloads(
  outcome: AdaptiveEvaluationOutcome,
  config: AdaptiveThresholdConfig,
  serverTimestampIso: string
): BuiltAdaptiveSocketPayloads {
  const { sessionState, score, level, durationMs, requiredDurationMs, cooldownRemainingMs, resetReason, emittedEvents } =
    outcome;

  // Report ADAPTATION_ELIGIBLE as the state on the immediate eligibility emission
  // while the stored sessionState already advances into COOLDOWN to guard future ticks.
  const reportedState = emittedEvents.includes("adaptation_eligible")
    ? "ADAPTATION_ELIGIBLE"
    : sessionState.state;

  const frictionState: FrictionStatePayload = {
    sessionId: sessionState.sessionId,
    state: reportedState,
    frictionScore: score,
    frictionLevel: level,
    durationMs,
    requiredDurationMs,
    cooldownRemainingMs,
    episodeTriggered: sessionState.episodeTriggered,
    resetReason,
    timestamp: serverTimestampIso,
  };

  const frictionAlerts: FrictionAlertPayload[] = [];

  if (emittedEvents.includes("candidate_started")) {
    frictionAlerts.push({
      sessionId: sessionState.sessionId,
      alertType: "candidate_started",
      frictionScore: score,
      frictionLevel: level,
      durationMs,
      message:
        outcome.alertMessage ||
        "High friction candidate started; evaluating sustained duration.",
      timestamp: serverTimestampIso,
    });
  }

  if (emittedEvents.includes("sustained_high_friction_alert")) {
    frictionAlerts.push({
      sessionId: sessionState.sessionId,
      alertType: "sustained_high_friction",
      frictionScore: score,
      frictionLevel: level,
      durationMs,
      message:
        outcome.alertMessage ||
        "Sustained high interaction friction detected.",
      timestamp: serverTimestampIso,
    });
  }

  if (emittedEvents.includes("inactivity_candidate_reset")) {
    frictionAlerts.push({
      sessionId: sessionState.sessionId,
      alertType: "inactivity_candidate_reset",
      frictionScore: score,
      frictionLevel: level,
      durationMs: 0,
      message:
        outcome.alertMessage ||
        "Unconfirmed high-friction candidate reset due to inactivity.",
      timestamp: serverTimestampIso,
    });
  }

  const adaptationEligible: AdaptationEligiblePayload | null =
    emittedEvents.includes("adaptation_eligible")
      ? {
          sessionId: sessionState.sessionId,
          eligible: true,
          frictionScore: score,
          frictionLevel: level,
          reason: "sustained_high_interaction_friction",
          sustainedDurationMs: durationMs,
          cooldownDurationMs: config.cooldownDurationMs,
          timestamp: serverTimestampIso,
        }
      : null;

  const adaptationDeferred: AdaptationDeferredPayload | null =
    emittedEvents.includes("adaptation_deferred")
      ? {
          sessionId: sessionState.sessionId,
          deferred: true,
          frictionScore: score,
          frictionLevel: level,
          reason: outcome.deferralReason || "cooldown_active",
          cooldownRemainingMs,
          timestamp: serverTimestampIso,
        }
      : null;

  const frictionRecovered: FrictionRecoveredPayload | null =
    emittedEvents.includes("friction_recovered")
      ? {
          sessionId: sessionState.sessionId,
          recovered: true,
          frictionScore: score,
          frictionLevel: level,
          recoveryThreshold: config.recoveryThreshold,
          cooldownRemainingMs,
          timestamp: serverTimestampIso,
        }
      : null;

  return {
    frictionState,
    frictionAlerts,
    adaptationEligible,
    adaptationDeferred,
    frictionRecovered,
  };
}