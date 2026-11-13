// Measures how long a user stays on a field before typing or leaving.
// Only timing and field IDs are recorded, never what was typed.

import { resolveTarget } from "./mouseTracker.js";

export class HesitationTracker {
  constructor({ config, now, onEvent, onSample, setTimeoutFn, clearTimeoutFn }) {
    this.config = config.hesitation;
    this.now = now;
    this.onEvent = onEvent;
    this.onSample = onSample;
    this.setTimeoutFn = setTimeoutFn;
    this.clearTimeoutFn = clearTimeoutFn;
    this.active = null; // { sectionId, fieldId, startT, timer, interacted, key }
    this.counter = 0;
  }

  focus({ sectionId, fieldId }) {
    if (this.active && this.active.fieldId === fieldId && this.active.sectionId === sectionId) return;
    this.cancelActive();
    this.counter += 1;
    const active = {
      sectionId,
      fieldId,
      startT: this.now(),
      interacted: false,
      key: `hesitation:${sectionId}/${fieldId}#${this.counter}`,
      timer: null,
    };
    // Fire while the user is still stuck, so the score can react in real time.
    active.timer = this.setTimeoutFn(() => this.emitHesitation(active, this.config.thresholdMs), this.config.thresholdMs);
    this.active = active;
  }

  // First input or change on the focused field.
  input({ sectionId, fieldId }) {
    const active = this.active;
    if (!active || active.interacted || active.fieldId !== fieldId || active.sectionId !== sectionId) return;
    active.interacted = true;
    this.finish(active);
  }

  blur({ sectionId, fieldId }) {
    const active = this.active;
    if (!active || active.fieldId !== fieldId || active.sectionId !== sectionId) return;
    if (!active.interacted) this.finish(active);
    this.active = null;
  }

  finish(active) {
    this.clearTimeoutFn(active.timer);
    const duration = this.now() - active.startT;
    if (duration >= this.config.minSampleMs) {
      this.onSample({ sectionId: active.sectionId, fieldId: active.fieldId, durationMs: duration });
    }
    if (duration >= this.config.thresholdMs) this.emitHesitation(active, duration);
  }

  emitHesitation(active, durationMs) {
    this.onEvent({
      type: "hesitation",
      key: active.key, // the final duration replaces the early "still waiting" event
      sectionId: active.sectionId,
      fieldId: active.fieldId,
      durationMs,
      t: this.now(),
    });
  }

  // Drops the current focus without recording (tab hidden, section changed, teardown).
  cancelActive() {
    if (this.active) {
      this.clearTimeoutFn(this.active.timer);
      this.active = null;
    }
  }

  reset() {
    this.cancelActive();
  }
}

export function attachHesitationListeners(doc, tracker) {
  if (!doc) return () => {};
  const withTarget = (handler) => (event) => {
    const target = resolveTarget(event.target);
    if (target) handler(target);
  };

  const onFocusIn = withTarget((target) => tracker.focus(target));
  const onFocusOut = withTarget((target) => tracker.blur(target));
  const onInput = withTarget((target) => tracker.input(target));
  const onVisibility = () => {
    if (doc.visibilityState === "hidden") tracker.cancelActive();
  };

  doc.addEventListener("focusin", onFocusIn);
  doc.addEventListener("focusout", onFocusOut);
  doc.addEventListener("input", onInput);
  doc.addEventListener("change", onInput);
  doc.addEventListener("visibilitychange", onVisibility);

  return () => {
    doc.removeEventListener("focusin", onFocusIn);
    doc.removeEventListener("focusout", onFocusOut);
    doc.removeEventListener("input", onInput);
    doc.removeEventListener("change", onInput);
    doc.removeEventListener("visibilitychange", onVisibility);
    tracker.cancelActive();
  };
}
