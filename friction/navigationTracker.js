// Tracks movement between form sections.
// A "backtrack" is a move back to an earlier section that was already visited.
// It is attributed to the section the user left, because that is where they stalled.

export class NavigationTracker {
  constructor({ sections, now, onEvent }) {
    this.sections = sections;
    this.now = now;
    this.onEvent = onEvent;
    this.current = null; // current page id (may be "dashboard", etc.)
    this.lastFormSection = null;
    this.visited = new Set();
  }

  navigate(to) {
    if (to === this.current) return;
    this.current = to;
    if (!this.sections.includes(to)) return; // dashboard / monitor pages are not scored

    const from = this.lastFormSection;
    this.lastFormSection = to;

    if (from === null || from === to) {
      this.visited.add(to);
      return;
    }

    const isBacktrack =
      this.visited.has(to) && this.sections.indexOf(to) < this.sections.indexOf(from);
    this.visited.add(to);

    this.onEvent({
      type: "navigation",
      sectionId: from,
      toSectionId: to,
      backtrack: isBacktrack,
      t: this.now(),
    });
  }

  reset() {
    this.current = null;
    this.lastFormSection = null;
    this.visited.clear();
  }
}
