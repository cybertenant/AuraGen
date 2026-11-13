// Run with: npm run test:friction   (Node 20.19+ or 22.7+)
// Simulates the seven scenarios from the Phase 2 brief using a fake clock,
// so no browser is needed and nothing waits in real time.

import test from "node:test";
import assert from "node:assert/strict";
import { FrictionEngine } from "./frictionEngine.js";
import { FRICTION_CONFIG } from "./frictionConfig.js";

function createHarness() {
  let current = 1_000_000;
  let nextId = 1;
  const timers = new Map();

  const engine = new FrictionEngine({
    now: () => current,
    setTimeoutFn: (fn, ms) => {
      const id = nextId++;
      timers.set(id, { fn, at: current + ms });
      return id;
    },
    clearTimeoutFn: (id) => timers.delete(id),
  });

  const fired = [];
  engine.on("friction:detected", (payload) => fired.push(payload));

  // Moves time forward in 1 s steps, running due timers and recalculating each step.
  const advance = (ms) => {
    let remaining = ms;
    while (remaining > 0) {
      const step = Math.min(1000, remaining);
      current += step;
      remaining -= step;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= current) {
          timers.delete(id);
          timer.fn();
        }
      }
      engine.tick();
    }
  };

  const section = (id) => engine.getSnapshot().sections[id];
  const target = (sectionId, fieldId) => ({ sectionId, fieldId });
  return { engine, advance, section, target, fired };
}

test("1. normal form filling stays at low friction", () => {
  const h = createHarness();
  h.engine.navigate("personal");
  for (const field of ["fullName", "dateOfBirth", "email"]) {
    h.engine.handleFocus(h.target("personal", field));
    h.advance(2500);
    h.engine.handleInput(h.target("personal", field));
    h.advance(3000);
    h.engine.handleBlur(h.target("personal", field));
    h.engine.handleClick(h.target("personal", field));
    h.advance(500);
  }
  h.engine.navigate("employment");
  h.advance(10_000);

  assert.equal(h.section("personal").level, "low");
  assert.equal(h.engine.getSnapshot().overall.level, "low");
  assert.equal(h.section("personal").metrics.repeatedClicks, 0);
  assert.equal(h.fired.length, 0);
});

test("2. repeated clicks on one field raise the repeated-click metric", () => {
  const h = createHarness();
  const field = h.target("employment", "employmentType");
  h.engine.handleClick(field);
  h.advance(400);
  assert.equal(h.section("employment").metrics.repeatedClicks, 0); // one click is normal
  h.engine.handleClick(field);
  h.advance(400);
  assert.equal(h.section("employment").metrics.repeatedClicks, 0); // two clicks are still normal
  h.engine.handleClick(field);
  h.advance(300);
  h.engine.handleClick(field);
  h.advance(300);

  const employment = h.section("employment");
  assert.equal(employment.metrics.repeatedClicks, 4);
  assert.ok(employment.components.clicks > 0);
  assert.equal(h.engine.getSnapshot().stats.totalRepeatedClicks, 4);
  assert.ok(h.engine.getSnapshot().log[0].message.includes("Employment type"));
});

test("3. a long pause on one field raises the hesitation metric", () => {
  const h = createHarness();
  const field = h.target("financial", "monthlyIncome");
  h.engine.handleFocus(field);
  h.advance(FRICTION_CONFIG.hesitation.thresholdMs + 1000);
  assert.equal(h.section("financial").metrics.hesitationEvents, 1);

  h.advance(3000);
  h.engine.handleInput(field);
  const stats = h.engine.getSnapshot().stats;
  assert.equal(stats.hesitationEvents, 1); // the final duration replaces the early event
  assert.ok(stats.averageHesitationMs >= FRICTION_CONFIG.hesitation.thresholdMs);
  assert.ok(h.section("financial").components.hesitation > 0);
});

test("4. repeated invalid submissions raise the validation metric", () => {
  const h = createHarness();
  const fields = ["fullName", "email", "phone"];
  const submit = (attemptId) => {
    for (const fieldId of fields) {
      h.engine.recordValidation({ sectionId: "personal", fieldId, kind: "submit", attemptId });
    }
    h.advance(2000);
  };

  submit("a1");
  const afterOne = h.section("personal").components.validation;
  submit("a2");
  submit("a3");
  const afterThree = h.section("personal").components.validation;

  assert.ok(afterThree > afterOne);
  assert.equal(h.section("personal").metrics.validationErrors, 9);
  assert.equal(h.engine.getSnapshot().stats.totalValidationErrors, 9);
  assert.ok(h.section("personal").topErrorField.count >= 3);
  assert.equal(h.section("employment").metrics.validationErrors, 0); // counted per section
});

test("5. frequent navigation between sections raises the backtracking metric", () => {
  const h = createHarness();
  const route = ["personal", "employment", "personal", "employment", "financial", "employment", "personal"];
  for (const id of route) {
    h.engine.navigate(id);
    h.advance(1500);
  }
  const stats = h.engine.getSnapshot().stats;
  assert.equal(stats.backtrackCount, 3);
  assert.ok(stats.navigationChanges >= 6);
  assert.ok(h.section("employment").metrics.backtracks >= 2);
  assert.ok(h.section("employment").components.navigation > 0);
});

test("6. combined signals reach high friction and emit one event", () => {
  const h = createHarness();
  const field = h.target("employment", "employmentType");

  for (let i = 0; i < 6; i += 1) {
    h.engine.handleClick(field);
    h.advance(250);
  }
  for (const fieldId of ["jobTitle", "organization", "yearsExperience"]) {
    h.engine.handleFocus(h.target("employment", fieldId));
    h.advance(FRICTION_CONFIG.hesitation.thresholdMs + 500);
    h.engine.handleBlur(h.target("employment", fieldId));
  }
  for (const attemptId of ["a1", "a2", "a3"]) {
    for (const fieldId of ["jobTitle", "organization", "yearsExperience"]) {
      h.engine.recordValidation({ sectionId: "employment", fieldId, kind: "submit", attemptId });
    }
    h.advance(500);
  }
  h.advance(8000);

  const employment = h.section("employment");
  assert.ok(employment.score >= FRICTION_CONFIG.thresholds.high, `score was ${employment.score}`);
  assert.equal(employment.level, "high");

  assert.equal(h.fired.length, 1); // cooldown + re-arm: no repeats while it stays high
  const payload = h.fired[0];
  assert.equal(payload.event, "friction:detected");
  assert.equal(payload.sectionId, "employment");
  assert.equal(payload.frictionLevel, "high");
  assert.ok(payload.metrics.repeatedClicks >= 6);
  assert.ok(payload.metrics.hesitationEvents >= 3);
  assert.ok(payload.metrics.validationErrors >= 9);
  assert.equal(h.engine.getSnapshot().notifications.length, 1);
  assert.equal(h.section("personal").level, "low"); // other sections are unaffected
});

test("7. the score decreases gradually as old events leave the rolling window", () => {
  const h = createHarness();
  const field = h.target("financial", "monthlyIncome");
  for (let i = 0; i < 8; i += 1) {
    h.engine.handleClick(field);
    h.advance(200);
  }
  h.engine.handleFocus(h.target("financial", "annualIncome"));
  h.advance(FRICTION_CONFIG.hesitation.thresholdMs + 500);
  h.engine.handleBlur(h.target("financial", "annualIncome"));
  h.advance(10_000); // let smoothing settle on the peak

  const peak = h.section("financial").score;
  assert.ok(peak > 0);

  const readings = [];
  for (let i = 0; i < FRICTION_CONFIG.windowMs / 1000 + 10; i += 1) {
    h.advance(1000); // the user keeps going normally, no new friction events
    readings.push(h.section("financial").score);
  }

  for (let i = 1; i < readings.length; i += 1) {
    assert.ok(readings[i] <= readings[i - 1], "score must never rise without new events");
  }
  assert.ok(readings[readings.length - 1] === 0, "score returns to zero once events expire");
  assert.ok(readings[Math.floor(readings.length / 2)] < peak, "score falls before the window ends");
  assert.equal(h.section("financial").level, "low");
});

test("only metadata is stored: log entries contain field labels, never values", () => {
  const h = createHarness();
  h.engine.recordValidation({ sectionId: "personal", fieldId: "email", kind: "submit", attemptId: "a1" });
  const entry = h.engine.getSnapshot().log[0];
  assert.deepEqual(Object.keys(entry).sort(), ["fieldId", "id", "message", "sectionId", "t", "type"]);
});
