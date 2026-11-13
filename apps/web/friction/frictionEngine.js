// The Friction Engine: receives interaction metadata, keeps a rolling window of
// events per section, calculates scores, and emits "friction:detected" for
// high-friction sections. It has no React or DOM dependency of its own
// (attach() binds DOM listeners only when you call it).

import { EventEmitter } from "./eventEmitter.js";
import { ClickTracker } from "./clickTracker.js";
import { HesitationTracker, attachHesitationListeners } from "./hesitationTracker.js";
import { ValidationTracker } from "./validationTracker.js";
import { NavigationTracker } from "./navigationTracker.js";
import { attachMouseTracker } from "./mouseTracker.js";
import { calculateOverall, calculateSectionMetrics, smoothScore } from "./frictionCalculator.js";
import {
  FIELD_LABELS,
  FRICTION_CONFIG,
  FRICTION_SECTIONS,
  SECTION_LABELS,
  getFrictionLevel,
} from "./frictionConfig.js";

const emptyEvents = () => ({
  click: [],
  hesitation: [],
  hesitationSample: [],
  validation: [],
  navigation: [],
  help: [],
});

const fieldLabel = (id) => FIELD_LABELS[id] || id;
const sectionLabel = (id) => SECTION_LABELS[id] || id;

export class FrictionEngine {
  constructor({ config = FRICTION_CONFIG, now, setTimeoutFn, clearTimeoutFn } = {}) {
    this.config = config;
    this.now = now || (() => Date.now());
    this.sections = FRICTION_SECTIONS;
    this.emitter = new EventEmitter();
    this.listeners = new Set();
    this.timerId = null;
    this.idCounter = 0;

    const onEvent = (event) => this.ingest(event);
    const common = { config, now: this.now, onEvent };
    this.clickTracker = new ClickTracker(common);
    this.hesitationTracker = new HesitationTracker({
      ...common,
      onSample: (sample) => this.ingest({ type: "hesitationSample", t: this.now(), ...sample }),
      setTimeoutFn: setTimeoutFn || ((fn, ms) => setTimeout(fn, ms)),
      clearTimeoutFn: clearTimeoutFn || ((id) => clearTimeout(id)),
    });
    this.validationTracker = new ValidationTracker(common);
    this.navigationTracker = new NavigationTracker({ ...common, sections: this.sections });

    this.resetState();
    this.snapshot = this.buildSnapshot();
    this.signature = this.makeSignature(this.snapshot);
  }

  resetState() {
    this.events = {};
    this.state = {};
    for (const id of this.sections) {
      this.events[id] = emptyEvents();
      this.state[id] = { smoothed: 0, lastT: this.now(), armed: true, lastTriggerT: -Infinity };
    }
    this.log = [];
    this.notifications = [];
    this.clickCounts = new Map(); // burst key -> latest count (for lifetime total)
    this.hesitationKeys = new Set();
    this.totals = {
      repeatedClicks: 0,
      hesitationEvents: 0,
      hesitationMsSum: 0,
      hesitationSamples: 0,
      validationErrors: 0,
      backtracks: 0,
      navigationChanges: 0,
      helpInteractions: 0,
    };
    this.version = 0;
  }

  // ---------- public API ----------

  on(event, listener) {
    return this.emitter.on(event, listener);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return this.snapshot;
  }

  navigate(sectionId) {
    // A focused field may be removed when the section changes; drop its pending hesitation timer.
    this.hesitationTracker.cancelActive();
    this.navigationTracker.navigate(sectionId);
  }

  recordValidation(payload) {
    if (!this.events[payload.sectionId]) return;
    this.validationTracker.record(payload);
  }

  recordHelp(sectionId) {
    if (!this.events[sectionId]) return;
    this.ingest({ type: "help", sectionId, t: this.now() });
  }

  handleClick(target) {
    if (this.events[target.sectionId]) this.clickTracker.handleClick(target);
  }

  handleFocus(target) {
    if (this.events[target.sectionId]) this.hesitationTracker.focus(target);
  }

  handleInput(target) {
    this.hesitationTracker.input(target);
  }

  handleBlur(target) {
    this.hesitationTracker.blur(target);
  }

  // Binds DOM listeners. Returns a function that removes them.
  attach(doc) {
    const detachMouse = attachMouseTracker(doc, (target) => this.handleClick(target));
    const detachHesitation = attachHesitationListeners(doc, this.hesitationTracker);
    return () => {
      detachMouse();
      detachHesitation();
    };
  }

  start() {
    if (this.timerId !== null) return;
    this.timerId = setInterval(() => this.tick(), this.config.tickMs);
  }

  stop() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  dismissNotification(id) {
    this.notifications = this.notifications.filter((n) => n.id !== id);
    this.publish();
  }

  reset() {
    this.clickTracker.reset();
    this.hesitationTracker.reset();
    this.validationTracker.reset();
    this.resetState();
    this.publish(true);
  }

  // Recalculates scores for the current time. Called on a timer and after every event.
  tick() {
    const now = this.now();
    this.prune(now);
    for (const id of this.sections) {
      const state = this.state[id];
      const { rawScore } = calculateSectionMetrics(this.events[id], now, this.config);
      state.smoothed = smoothScore(state.smoothed, rawScore, now - state.lastT, this.config.smoothing);
      state.lastT = now;
      this.checkTrigger(id, now);
    }
    this.publish();
  }

  // ---------- internals ----------

  ingest(event) {
    const store = this.events[event.sectionId];
    if (!store) return;
    const t = event.t ?? this.now();
    const entry = { ...event, t };

    switch (event.type) {
      case "click": {
        const previous = this.clickCounts.get(event.key) || 0;
        this.clickCounts.set(event.key, event.count);
        this.totals.repeatedClicks += event.count - previous;
        this.upsert(store.click, entry);
        this.addLog(entry, `Repeatedly clicked ${fieldLabel(event.fieldId)} (${event.count} clicks)`);
        break;
      }
      case "hesitation": {
        if (!this.hesitationKeys.has(event.key)) {
          this.hesitationKeys.add(event.key);
          this.totals.hesitationEvents += 1;
        }
        this.upsert(store.hesitation, entry);
        this.addLog(
          entry,
          `Spent an extended time on ${fieldLabel(event.fieldId)} (${Math.round(event.durationMs / 1000)} s)`
        );
        break;
      }
      case "hesitationSample": {
        this.totals.hesitationMsSum += event.durationMs;
        this.totals.hesitationSamples += 1;
        store.hesitationSample.push(entry);
        break;
      }
      case "validation": {
        this.totals.validationErrors += 1;
        store.validation.push(entry);
        this.addLog(entry, `Validation error on ${fieldLabel(event.fieldId)} in ${sectionLabel(event.sectionId)}`);
        break;
      }
      case "navigation": {
        this.totals.navigationChanges += 1;
        if (event.backtrack) {
          this.totals.backtracks += 1;
          store.navigation.push(entry);
          this.addLog(entry, `Went back from ${sectionLabel(event.sectionId)} to ${sectionLabel(event.toSectionId)}`);
        }
        break;
      }
      case "help": {
        this.totals.helpInteractions += 1;
        store.help.push(entry);
        this.addLog(entry, `Opened help in ${sectionLabel(event.sectionId)}`);
        break;
      }
      default:
        return;
    }
    this.tick();
  }

  upsert(list, entry) {
    const index = list.findIndex((e) => e.key === entry.key);
    if (index >= 0) list[index] = entry;
    else list.push(entry);
  }

  addLog(entry, message) {
    const item = {
      id: entry.key || `log-${++this.idCounter}`,
      type: entry.type,
      sectionId: entry.sectionId,
      fieldId: entry.fieldId || null,
      t: entry.t,
      message,
    };
    const index = entry.key ? this.log.findIndex((l) => l.id === item.id) : -1;
    if (index >= 0) this.log[index] = item;
    else this.log.unshift(item);
    if (this.log.length > this.config.maxLogEntries) this.log.length = this.config.maxLogEntries;
  }

  prune(now) {
    const cutoff = now - this.config.windowMs;
    for (const id of this.sections) {
      for (const type of Object.keys(this.events[id])) {
        this.events[id][type] = this.events[id][type].filter((e) => e.t >= cutoff);
      }
    }
  }

  checkTrigger(sectionId, now) {
    const state = this.state[sectionId];
    const score = Math.round(state.smoothed);
    const level = getFrictionLevel(score, this.config.thresholds);

    // Re-arm only after the score has dropped below the high threshold.
    if (level !== "high") {
      state.armed = true;
      return;
    }
    if (!state.armed) return;
    if (now - state.lastTriggerT < this.config.trigger.cooldownMs) return;

    state.armed = false;
    state.lastTriggerT = now;

    const { metrics } = calculateSectionMetrics(this.events[sectionId], now, this.config);
    const payload = {
      event: "friction:detected",
      sectionId,
      frictionScore: score,
      frictionLevel: level,
      metrics: {
        repeatedClicks: metrics.repeatedClicks,
        hesitationEvents: metrics.hesitationEvents,
        validationErrors: metrics.validationErrors,
        backtracks: metrics.backtracks,
      },
      timestamp: now,
    };
    this.notifications.unshift({ id: `notice-${++this.idCounter}`, ...payload });
    this.notifications.length = Math.min(this.notifications.length, 5);
    this.emitter.emit("friction:detected", payload);
  }

  buildSnapshot() {
    const now = this.now();
    const sections = {};
    const scores = {};
    for (const id of this.sections) {
      const { components, metrics, rawScore } = calculateSectionMetrics(this.events[id], now, this.config);
      const score = this.state[id].smoothed;
      scores[id] = score;
      sections[id] = {
        id,
        label: sectionLabel(id),
        score: Math.round(score),
        level: getFrictionLevel(score, this.config.thresholds),
        rawScore: Math.round(rawScore),
        components: {
          clicks: Math.round(components.clicks),
          hesitation: Math.round(components.hesitation),
          validation: Math.round(components.validation),
          navigation: Math.round(components.navigation),
        },
        metrics: { ...metrics, avgHesitationMs: Math.round(metrics.avgHesitationMs) },
        topErrorField: this.validationTracker.getTopField(id),
      };
    }
    const overallScore = calculateOverall(scores, this.config.overall);
    const t = this.totals;
    return {
      overall: {
        score: Math.round(overallScore),
        level: getFrictionLevel(overallScore, this.config.thresholds),
      },
      sections,
      stats: {
        totalRepeatedClicks: t.repeatedClicks,
        averageHesitationMs: t.hesitationSamples ? Math.round(t.hesitationMsSum / t.hesitationSamples) : 0,
        hesitationEvents: t.hesitationEvents,
        totalValidationErrors: t.validationErrors,
        backtrackCount: t.backtracks,
        navigationChanges: t.navigationChanges,
        helpInteractions: t.helpInteractions,
      },
      log: this.log.slice(0, 50),
      notifications: [...this.notifications],
      thresholds: this.config.thresholds,
      windowMs: this.config.windowMs,
    };
  }

  makeSignature(snapshot) {
    return JSON.stringify([
      snapshot.overall,
      Object.values(snapshot.sections).map((s) => [s.score, s.metrics, s.topErrorField]),
      snapshot.stats,
      snapshot.log.map((l) => `${l.id}:${l.message}`),
      snapshot.notifications.map((n) => n.id),
    ]);
  }

  // Builds a new snapshot and notifies subscribers only if something visible changed.
  publish(force = false) {
    const next = this.buildSnapshot();
    const signature = this.makeSignature(next);
    if (!force && signature === this.signature) return;
    this.snapshot = next;
    this.signature = signature;
    for (const listener of this.listeners) listener(next);
  }
}
