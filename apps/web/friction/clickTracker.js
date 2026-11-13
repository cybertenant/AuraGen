// Detects repeated clicks on the same field.
// A burst is `burstThreshold` clicks on one field within `burstWindowMs`.
// One or two ordinary clicks are never reported.

export class ClickTracker {
  constructor({ config, now, onEvent }) {
    this.config = config.clicks;
    this.now = now;
    this.onEvent = onEvent;
    this.fields = new Map(); // "section/field" -> { times, burstId, burstTotal }
  }

  handleClick({ sectionId, fieldId }) {
    const t = this.now();
    const key = `${sectionId}/${fieldId}`;
    const state = this.fields.get(key) || { times: [], burstId: null, burstTotal: 0 };

    state.times = state.times.filter((time) => t - time <= this.config.burstWindowMs);
    state.times.push(t);

    if (state.times.length >= this.config.burstThreshold) {
      if (state.burstId === null) {
        state.burstId = `${key}@${t}`;
        state.burstTotal = state.times.length;
      } else {
        state.burstTotal += 1;
      }
      this.onEvent({
        type: "click",
        key: `click:${state.burstId}`, // later clicks in the same burst update this event
        sectionId,
        fieldId,
        count: state.burstTotal,
        t,
      });
    } else {
      state.burstId = null;
      state.burstTotal = 0;
    }

    this.fields.set(key, state);
  }

  reset() {
    this.fields.clear();
  }
}
