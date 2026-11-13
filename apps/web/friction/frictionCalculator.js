// Pure scoring functions. No DOM, no React, no timers: easy to test.
//
// Friction Score = 0.30 x Repeated Click Score
//                + 0.30 x Hesitation Score
//                + 0.25 x Validation Error Score
//                + 0.15 x Navigation Backtracking Score
//
// Each metric score is normalized to 0-100. Events inside the rolling window
// are weighted by age, so a section's score fades gradually instead of dropping at once.
// A high score signals possible difficulty with a section. It is not proof of how the user feels.

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function ageWeight(event, now, config) {
  const age = now - event.t;
  if (age < 0) return 1;
  if (!config.useDecay) return age <= config.windowMs ? 1 : 0;
  // Full weight for the first part of the window, then a linear fade to zero.
  const fadeStart = config.windowMs * config.decayStartFraction;
  if (age <= fadeStart) return 1;
  return Math.max(0, 1 - (age - fadeStart) / (config.windowMs - fadeStart));
}

const normalize = (value, saturation) => clamp((value / saturation) * 100, 0, 100);

export function calculateSectionMetrics(events, now, config) {
  const inWindow = (list) => list.filter((e) => now - e.t <= config.windowMs);
  const clicks = inWindow(events.click);
  const hesitations = inWindow(events.hesitation);
  const validations = inWindow(events.validation);
  const backtracks = inWindow(events.navigation).filter((e) => e.backtrack);
  const samples = inWindow(events.hesitationSample);
  const help = inWindow(events.help);

  // Repeated clicks: total clicks inside bursts.
  const clickWeighted = clicks.reduce((sum, e) => sum + e.count * ageWeight(e, now, config), 0);

  // Hesitation: an event at the threshold counts 1; longer stalls count more (up to 2).
  const hesitationWeighted = hesitations.reduce(
    (sum, e) =>
      sum + Math.min(2, e.durationMs / config.hesitation.thresholdMs) * ageWeight(e, now, config),
    0
  );

  // Validation: invalid attempts + repeats of the same field + inline errors.
  const vw = config.validation.weights;
  const attemptWeights = new Map(); // attemptId -> newest age weight
  const fieldAttempts = new Map(); // field -> list of attempt keys, to find repeats
  let inlineWeighted = 0;
  for (const e of validations) {
    const w = ageWeight(e, now, config);
    if (e.kind === "inline") {
      inlineWeighted += w;
      continue;
    }
    attemptWeights.set(e.attemptId, Math.max(attemptWeights.get(e.attemptId) || 0, w));
    const list = fieldAttempts.get(e.fieldId) || new Map();
    list.set(e.attemptId, Math.max(list.get(e.attemptId) || 0, w));
    fieldAttempts.set(e.fieldId, list);
  }
  let attemptWeighted = 0;
  for (const w of attemptWeights.values()) attemptWeighted += w;
  let repeatWeighted = 0;
  for (const list of fieldAttempts.values()) {
    const weights = [...list.values()].sort((a, b) => b - a);
    for (const w of weights.slice(1)) repeatWeighted += w; // every failure after the first
  }
  const validationWeighted =
    vw.attempt * attemptWeighted + vw.repeat * repeatWeighted + vw.inline * inlineWeighted;

  // Backtracking.
  const backtrackWeighted = backtracks.reduce((sum, e) => sum + ageWeight(e, now, config), 0);

  const components = {
    clicks: normalize(clickWeighted, config.clicks.saturation),
    hesitation: normalize(hesitationWeighted, config.hesitation.saturation),
    validation: normalize(validationWeighted, config.validation.saturation),
    navigation: normalize(backtrackWeighted, config.navigation.saturation),
  };

  const w = config.weights;
  const rawScore = clamp(
    w.clicks * components.clicks +
      w.hesitation * components.hesitation +
      w.validation * components.validation +
      w.navigation * components.navigation,
    0,
    100
  );

  const avgHesitationMs =
    samples.length === 0 ? 0 : samples.reduce((sum, e) => sum + e.durationMs, 0) / samples.length;

  return {
    rawScore,
    components,
    // Plain counts for the dashboard and the friction:detected event.
    metrics: {
      repeatedClicks: clicks.reduce((sum, e) => sum + e.count, 0),
      hesitationEvents: hesitations.length,
      validationErrors: validations.length,
      backtracks: backtracks.length,
      helpOpens: help.length,
      avgHesitationMs,
    },
  };
}

// Moves the displayed score toward the target: quickly up, slowly down.
export function smoothScore(previous, target, elapsedMs, smoothing) {
  if (elapsedMs <= 0) return previous;
  const tau = target > previous ? smoothing.riseTauMs : smoothing.fallTauMs;
  const alpha = 1 - Math.exp(-elapsedMs / tau);
  const next = previous + (target - previous) * alpha;
  return Math.abs(next - target) < 0.05 ? target : next;
}

export function calculateOverall(sectionScores, strategy = "max") {
  const values = Object.values(sectionScores);
  if (values.length === 0) return 0;
  if (strategy === "mean") return values.reduce((a, b) => a + b, 0) / values.length;
  return Math.max(...values);
}
