// Records which fields fail validation, per section.
// Receives field IDs only, never the values that were rejected.

export class ValidationTracker {
  constructor({ now, onEvent }) {
    this.now = now;
    this.onEvent = onEvent;
    this.fieldCounts = new Map(); // sectionId -> Map(fieldId -> count)
  }

  record({ sectionId, fieldId, kind = "submit", attemptId = null }) {
    const perSection = this.fieldCounts.get(sectionId) || new Map();
    perSection.set(fieldId, (perSection.get(fieldId) || 0) + 1);
    this.fieldCounts.set(sectionId, perSection);

    this.onEvent({
      type: "validation",
      sectionId,
      fieldId,
      kind, // "submit" (invalid Next/Submit) or "inline" (error on leaving a field)
      attemptId,
      t: this.now(),
    });
  }

  // The field in a section that has produced the most errors so far.
  getTopField(sectionId) {
    const perSection = this.fieldCounts.get(sectionId);
    if (!perSection || perSection.size === 0) return null;
    let top = null;
    for (const [fieldId, count] of perSection) {
      if (!top || count > top.count) top = { fieldId, count };
    }
    return top;
  }

  reset() {
    this.fieldCounts.clear();
  }
}
