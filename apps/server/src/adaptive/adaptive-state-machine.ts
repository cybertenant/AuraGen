import type { FrictionLevel } from "@auragen/shared";
import {
  AdaptiveThresholdConfig,
  DEFAULT_ADAPTIVE_CONFIG,
} from "./adaptive.config.js";
import {
  AdaptiveEvaluationOutcome,
  AdaptiveSessionState,
  AdaptiveTransitionEventType,
} from "./adaptive.types.js";

export function classifyFrictionLevel(
  score: number,
  config: AdaptiveThresholdConfig = DEFAULT_ADAPTIVE_CONFIG
): FrictionLevel {
  if (score >= config.highFrictionThreshold) return "high";
  if (score > config.lowMaxScore) return "medium";
  return "low";
}

export function createInitialAdaptiveSessionState(
  sessionId: string
): AdaptiveSessionState {
  return {
    sessionId,
    state: "MONITORING",
    candidateStartedAtMs: null,
    lastEligibilityAtMs: null,
    cooldownExpiresAtMs: null,
    episodeTriggered: false,
    lastTelemetryAtMs: null,
    lastScore: 0,
    lastLevel: "low",
  };
}

/**
 * Pure, deterministic state transition evaluator for Adaptive Friction Threshold Orchestration.
 *
 * Guarantees:
 * - Rejects invalid/NaN/out-of-range scores without mutating state.
 * - Uses server-supplied timestamps (`nowMs`), never client clocks.
 * - Prevents false positives from inactivity gaps (`maxObservationGapMs`): a single high reading
 *   followed by silence resets the unconfirmed candidate instead of triggering adaptation.
 * - Enforces hysteresis: triggers candidate at >= highFrictionThreshold (65), holds candidate
 *   through the sticky band [55, 64], and resets/recovers only when < recoveryThreshold (55).
 * - Emits `adaptation_eligible` at most once per high-friction episode and enforces `cooldownDurationMs` (60s).
 */
export function evaluateAdaptiveStateTransition(
  current: AdaptiveSessionState,
  rawScoreInput: number,
  nowMs: number,
  config: AdaptiveThresholdConfig = DEFAULT_ADAPTIVE_CONFIG
): AdaptiveEvaluationOutcome {
  // 1. Strict score validation: reject NaN, Infinity, or out-of-range values
  if (
    typeof rawScoreInput !== "number" ||
    !Number.isFinite(rawScoreInput) ||
    rawScoreInput < config.minScore ||
    rawScoreInput > config.maxScore
  ) {
    const cooldownRemainingMs =
      current.cooldownExpiresAtMs !== null
        ? Math.max(0, current.cooldownExpiresAtMs - nowMs)
        : 0;
    const durationMs =
      current.candidateStartedAtMs !== null
        ? Math.max(0, nowMs - current.candidateStartedAtMs)
        : 0;

    return {
      sessionState: { ...current },
      previousState: current.state,
      score: current.lastScore,
      level: current.lastLevel,
      durationMs,
      requiredDurationMs: config.sustainedDurationMs,
      cooldownRemainingMs,
      resetReason: "none",
      emittedEvents: [],
      shouldPersistTransition: false,
    };
  }

  const score = Number(rawScoreInput.toFixed(2));
  const level = classifyFrictionLevel(score, config);
  const previousState = current.state;

  const next: AdaptiveSessionState = {
    ...current,
    lastScore: score,
    lastLevel: level,
  };

  const emittedEvents: AdaptiveTransitionEventType[] = [];
  let resetReason: AdaptiveEvaluationOutcome["resetReason"] = "none";
  let deferralReason: AdaptiveEvaluationOutcome["deferralReason"];
  let alertMessage: string | undefined;

  // 2. Check inactivity gap before evaluating continuity of any unconfirmed candidate
  const observationGapMs =
    current.lastTelemetryAtMs !== null
      ? Math.max(0, nowMs - current.lastTelemetryAtMs)
      : 0;

  if (
    current.lastTelemetryAtMs !== null &&
    observationGapMs > config.maxObservationGapMs &&
    next.candidateStartedAtMs !== null
  ) {
    next.candidateStartedAtMs = null;
    next.state = "MONITORING";
    resetReason = "inactivity_gap_exceeded";
    emittedEvents.push("inactivity_candidate_reset");
    alertMessage =
      "Unconfirmed high-friction candidate reset due to observation inactivity gap.";
  }

  // Update server-authoritative last telemetry timestamp
  next.lastTelemetryAtMs = nowMs;

  // 3. Evaluate remaining cooldown
  let cooldownRemainingMs =
    next.cooldownExpiresAtMs !== null
      ? Math.max(0, next.cooldownExpiresAtMs - nowMs)
      : 0;

  if (next.cooldownExpiresAtMs !== null && cooldownRemainingMs === 0) {
    // Cooldown expired cleanly
    next.cooldownExpiresAtMs = null;
    if (next.state === "COOLDOWN") {
      next.state = next.episodeTriggered ? "MONITORING" : "RECOVERED";
    }
  }

  // 4. Hysteresis recovery check: score strictly below recoveryThreshold (< 55)
  if (score < config.recoveryThreshold) {
    const wasInEpisodeOrCandidate =
      next.state === "HIGH_FRICTION_CANDIDATE" ||
      next.state === "ADAPTATION_ELIGIBLE" ||
      next.episodeTriggered ||
      next.candidateStartedAtMs !== null;

    if (wasInEpisodeOrCandidate) {
      next.candidateStartedAtMs = null;
      next.episodeTriggered = false;
      next.state = cooldownRemainingMs > 0 ? "COOLDOWN" : "RECOVERED";
      resetReason = "recovered_below_threshold";
      emittedEvents.push("friction_recovered");
    } else if (next.state === "RECOVERED" && cooldownRemainingMs === 0) {
      next.state = "MONITORING";
    }

    return {
      sessionState: next,
      previousState,
      score,
      level,
      durationMs: 0,
      requiredDurationMs: config.sustainedDurationMs,
      cooldownRemainingMs,
      resetReason,
      emittedEvents,
      alertMessage,
      shouldPersistTransition:
        previousState !== next.state || emittedEvents.length > 0,
    };
  }

  // 5. Sticky hysteresis band [recoveryThreshold (55), highFrictionThreshold (65))
  // Scores 55..64 do NOT start a new candidate, nor do they reset an active candidate.
  if (score < config.highFrictionThreshold) {
    if (next.state === "RECOVERED" && cooldownRemainingMs === 0) {
      next.state = "MONITORING";
    }

    const durationMs =
      next.candidateStartedAtMs !== null
        ? Math.max(0, nowMs - next.candidateStartedAtMs)
        : 0;

    return {
      sessionState: next,
      previousState,
      score,
      level,
      durationMs,
      requiredDurationMs: config.sustainedDurationMs,
      cooldownRemainingMs,
      resetReason,
      emittedEvents,
      alertMessage,
      shouldPersistTransition:
        previousState !== next.state || emittedEvents.length > 0,
    };
  }

  // 6. High friction band: score >= highFrictionThreshold (65)
  if (next.candidateStartedAtMs === null) {
    next.candidateStartedAtMs = nowMs;
    if (cooldownRemainingMs === 0 && !next.episodeTriggered) {
      next.state = "HIGH_FRICTION_CANDIDATE";
      emittedEvents.push("candidate_started");
      alertMessage =
        "High interaction friction detected. Monitoring sustained duration before adaptation.";
    }
  }

  const durationMs = Math.max(0, nowMs - next.candidateStartedAtMs);

  // Check if sustained duration threshold (>= 5000ms) is reached
  if (durationMs >= config.sustainedDurationMs) {
    if (cooldownRemainingMs > 0) {
      next.state = "COOLDOWN";
      deferralReason = "cooldown_active";
      emittedEvents.push("adaptation_deferred");
    } else if (next.episodeTriggered) {
      // Continuously frustrated user who has not yet recovered below 55:
      // prevent unlimited repeated adaptation triggers for the same episode.
      next.state = "COOLDOWN";
      deferralReason = "episode_already_triggered_awaiting_recovery";
      emittedEvents.push("adaptation_deferred");
    } else {
      // All threshold conditions satisfied -> trigger adaptation eligibility once
      next.episodeTriggered = true;
      next.lastEligibilityAtMs = nowMs;
      next.cooldownExpiresAtMs =
        config.cooldownDurationMs > 0 ? nowMs + config.cooldownDurationMs : null;
      cooldownRemainingMs = config.cooldownDurationMs;
      // Transition to COOLDOWN immediately after eligibility notification so subsequent ticks are protected
      next.state = config.cooldownDurationMs > 0 ? "COOLDOWN" : "ADAPTATION_ELIGIBLE";

      emittedEvents.push("sustained_high_friction_alert");
      emittedEvents.push("adaptation_eligible");
      alertMessage =
        "Sustained high interaction friction confirmed. Session is eligible for adaptive UI simplification.";
    }
  } else if (cooldownRemainingMs > 0) {
    next.state = "COOLDOWN";
  } else if (!next.episodeTriggered) {
    next.state = "HIGH_FRICTION_CANDIDATE";
  }

  return {
    sessionState: next,
    previousState,
    score,
    level,
    durationMs,
    requiredDurationMs: config.sustainedDurationMs,
    cooldownRemainingMs,
    resetReason,
    emittedEvents,
    deferralReason,
    alertMessage,
    shouldPersistTransition:
      previousState !== next.state || emittedEvents.length > 0,
  };
}