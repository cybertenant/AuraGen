// A tiny bridge so Phase 1 code can report metadata to the engine
// without importing the engine. If no engine is mounted, reports are ignored.
// Only section IDs and field IDs travel through here, never field values.

import { EventEmitter } from "./eventEmitter.js";

export const frictionBus = new EventEmitter();

let attemptCounter = 0;

// errorsBySection: { personal: ["fullName", "email"], ... }
export function reportInvalidSubmission(errorsBySection) {
  attemptCounter += 1;
  const attemptId = `attempt-${attemptCounter}`;
  for (const [sectionId, fieldIds] of Object.entries(errorsBySection)) {
    for (const fieldId of fieldIds) {
      frictionBus.emit("validation", { sectionId, fieldId, kind: "submit", attemptId });
    }
  }
}

// An error shown while the user leaves a field (before pressing Next).
export function reportInlineError(sectionId, fieldId) {
  frictionBus.emit("validation", { sectionId, fieldId, kind: "inline" });
}

export function reportHelpOpened(sectionId) {
  frictionBus.emit("help", { sectionId });
}
