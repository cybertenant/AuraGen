import { describe, it, expect } from "vitest";
import {
  clamp01,
  normalizeTelemetrySignals,
  calculateRawFrictionScore,
  classifyFrictionLevel,
  computeSmoothedFrictionScore,
  SustainedFrictionThresholdMachine,
  CognitiveFrictionEngine,
} from "../index.js";

describe("Day 4: Cognitive Friction Engine — Normalization & Scoring", () => {
  it("produces a raw and smoothed score of 0 when telemetry is all zeros", () => {
    const engine = new CognitiveFrictionEngine();
    const res = engine.evaluate(
      {
        observationWindowSeconds: 30,
        fieldFocusCount: 0,
        hesitationCount: 0,
        totalFieldFocusDurationMs: 0,
        validationErrors: 0,
        repeatedClicks: 0,
        backtracks: 0,
        cursorAnomalyScore: 0,
      },
      1000
    );

    expect(res.rawScore).toBe(0);
    expect(res.smoothedScore).toBe(0);
    expect(res.level).toBe("low");
    expect(res.thresholdStatus.isEligibleForAdaptation).toBe(false);
  });

  it("calculates exact individual contributions for hesitation, validationErrors, repeatedClicks, backtracking, and cursorAnomaly", () => {
    // Max hesitation (3 -> H=1.0 -> 25 pts)
    const hOnly = calculateRawFrictionScore({ hesitationCount: 3 });
    expect(hOnly.signals.hesitation).toBe(1);
    expect(hOnly.contributions.hesitation).toBe(25);
    expect(hOnly.rawScore).toBe(25);

    // Max validation errors (3 -> E=1.0 -> 30 pts)
    const eOnly = calculateRawFrictionScore({ validationErrors: 3 });
    expect(eOnly.signals.validationErrors).toBe(1);
    expect(eOnly.contributions.validationErrors).toBe(30);
    expect(eOnly.rawScore).toBe(30);

    // Max repeated clicks (4 -> R=1.0 -> 20 pts)
    const rOnly = calculateRawFrictionScore({ repeatedClicks: 4 });
    expect(rOnly.signals.repeatedClicks).toBe(1);
    expect(rOnly.contributions.repeatedClicks).toBe(20);
    expect(rOnly.rawScore).toBe(20);

    // Max backtracking (3 -> B=1.0 -> 15 pts)
    const bOnly = calculateRawFrictionScore({ backtracks: 3 });
    expect(bOnly.signals.backtracking).toBe(1);
    expect(bOnly.contributions.backtracking).toBe(15);
    expect(bOnly.rawScore).toBe(15);

    // Max cursor anomaly (1.0 -> M=1.0 -> 10 pts)
    const mOnly = calculateRawFrictionScore({ cursorAnomalyScore: 1 });
    expect(mOnly.signals.cursorAnomaly).toBe(1);
    expect(mOnly.contributions.cursorAnomaly).toBe(10);
    expect(mOnly.rawScore).toBe(10);
  });

  it("combines multiple signals accurately using CLS = 100 * (0.25H + 0.30E + 0.20R + 0.15B + 0.10M)", () => {
    // H = 2/3, E = 3/3 = 1, R = 3/4 = 0.75, B = 1/3, M = 0.50
    // Expected = 100 * (0.25*(2/3) + 0.30*1 + 0.20*0.75 + 0.15*(1/3) + 0.10*0.50)
    //          = 16.6675 + 30 + 15 + 5.00 + 5.00 = 71.67
    const res = calculateRawFrictionScore({
      hesitationCount: 2,
      validationErrors: 3,
      repeatedClicks: 3,
      backtracks: 1,
      cursorAnomalyScore: 0.5,
    });

    expect(res.rawScore).toBeCloseTo(71.67, 1);
    expect(classifyFrictionLevel(res.rawScore)).toBe("high");
  });

  it("clamps inputs above allowed bounds and safely handles NaN and Infinity without breaking", () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
    expect(clamp01(-5)).toBe(0);
    expect(clamp01(42)).toBe(1);

    const normalized = normalizeTelemetrySignals({
      hesitationCount: 999,
      validationErrors: NaN,
      repeatedClicks: Infinity,
      backtracks: -10,
      cursorAnomalyScore: 5.5,
    });

    expect(normalized.hesitation).toBe(1);
    expect(normalized.validationErrors).toBe(0);
    expect(normalized.repeatedClicks).toBe(0);
    expect(normalized.backtracking).toBe(0);
    expect(normalized.cursorAnomaly).toBe(1);

    const scoreRes = calculateRawFrictionScore({
      hesitationCount: 999,
      validationErrors: 999,
      repeatedClicks: 999,
      backtracks: 999,
      cursorAnomalyScore: 999,
    });
    expect(scoreRes.rawScore).toBe(100);
  });

  it("classifies LOW (0-30), MEDIUM (31-64), and HIGH (65-100) levels accurately", () => {
    expect(classifyFrictionLevel(0)).toBe("low");
    expect(classifyFrictionLevel(30)).toBe("low");
    expect(classifyFrictionLevel(31)).toBe("medium");
    expect(classifyFrictionLevel(64)).toBe("medium");
    expect(classifyFrictionLevel(65)).toBe("high");
    expect(classifyFrictionLevel(100)).toBe("high");
  });
});

describe("Day 4: Cognitive Friction Engine — Exponential Smoothing", () => {
  it("initializes first reading directly from rawScore and dampens subsequent spikes with 0.65/0.35 weights", () => {
    // First reading: raw = 20 -> smoothed = 20
    const first = computeSmoothedFrictionScore(20, null);
    expect(first).toBe(20);

    // Sudden spike to 100 -> 0.65 * 20 + 0.35 * 100 = 13 + 35 = 48
    const second = computeSmoothedFrictionScore(100, first);
    expect(second).toBe(48);

    // Sustained 100 -> 0.65 * 48 + 0.35 * 100 = 31.2 + 35 = 66.2
    const third = computeSmoothedFrictionScore(100, second);
    expect(third).toBe(66.2);
  });

  it("keeps smoothed scores strictly bounded within [0, 100] even with invalid inputs", () => {
    expect(computeSmoothedFrictionScore(150, 120)).toBe(100);
    expect(computeSmoothedFrictionScore(-50, -10)).toBe(0);
    expect(computeSmoothedFrictionScore(NaN, 50)).toBe(32.5);
  });
});

describe("Day 4: Sustained High-Friction Threshold State Machine", () => {
  it("does not trigger on low (20) or medium (58) friction", () => {
    const machine = new SustainedFrictionThresholdMachine();

    const r1 = machine.evaluate(20, 1000);
    expect(r1.isEligibleForAdaptation).toBe(false);
    expect(r1.shouldTriggerAdaptationEvent).toBe(false);

    const r2 = machine.evaluate(58, 10000);
    expect(r2.isEligibleForAdaptation).toBe(false);
    expect(r2.shouldTriggerAdaptationEvent).toBe(false);
  });

  it("does not trigger on a short high-friction spike (< 5 seconds)", () => {
    const machine = new SustainedFrictionThresholdMachine();

    // T=1000ms: score enters >= 65 -> candidate
    const t1 = machine.evaluate(75, 1000);
    expect(t1.state).toBe("candidate");
    expect(t1.shouldTriggerAdaptationEvent).toBe(false);

    // T=4500ms (only 3.5s elapsed): still candidate
    const t2 = machine.evaluate(80, 4500);
    expect(t2.state).toBe("candidate");
    expect(t2.shouldTriggerAdaptationEvent).toBe(false);

    // T=5000ms: drops below recovery threshold (55) -> resets candidate!
    const t3 = machine.evaluate(40, 5000);
    expect(t3.state).toBe("idle");
    expect(t3.isEligibleForAdaptation).toBe(false);
  });

  it("triggers adaptation eligibility after 5 continuous seconds >= 65 and enforces a 60s cooldown", () => {
    const machine = new SustainedFrictionThresholdMachine();

    // T=1000ms: candidate starts
    const t0 = machine.evaluate(70, 1000);
    expect(t0.state).toBe("candidate");
    expect(t0.shouldTriggerAdaptationEvent).toBe(false);

    // T=6000ms (5000ms sustained): triggers once!
    const t5s = machine.evaluate(72, 6000);
    expect(t5s.shouldTriggerAdaptationEvent).toBe(true);
    expect(t5s.isEligibleForAdaptation).toBe(true);

    // T=7000ms (1s into cooldown, still high friction): must NOT re-trigger event
    const t6s = machine.evaluate(85, 7000);
    expect(t6s.state).toBe("cooldown");
    expect(t6s.shouldTriggerAdaptationEvent).toBe(false);
    expect(t6s.cooldownRemainingMs).toBe(59000);
  });

  it("allows a new high-friction episode to trigger after 60s cooldown AND recovery below 55", () => {
    const machine = new SustainedFrictionThresholdMachine();

    // Episode 1
    machine.evaluate(80, 1000);
    const ep1Trigger = machine.evaluate(80, 6000);
    expect(ep1Trigger.shouldTriggerAdaptationEvent).toBe(true);

    // Cooldown ends at 66000ms, user still high at 70000ms (has NOT recovered below 55)
    const stillHighAfterCooldown = machine.evaluate(80, 70000);
    expect(stillHighAfterCooldown.shouldTriggerAdaptationEvent).toBe(false);

    // User recovers below 55 at 72000ms
    const recovered = machine.evaluate(30, 72000);
    expect(recovered.state).toBe("idle");
    expect(recovered.isEligibleForAdaptation).toBe(false);

    // Episode 2 begins at 80000ms and sustains 5s until 85000ms -> triggers again!
    machine.evaluate(78, 80000);
    const ep2Trigger = machine.evaluate(82, 85000);
    expect(ep2Trigger.shouldTriggerAdaptationEvent).toBe(true);
    expect(ep2Trigger.isEligibleForAdaptation).toBe(true);
  });
});