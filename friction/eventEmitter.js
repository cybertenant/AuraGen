// Minimal event emitter used by the engine and by the app-to-engine bus.

export class EventEmitter {
  constructor() {
    this.listeners = new Map();
  }

  on(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    const set = this.listeners.get(event);
    if (set) set.delete(listener);
  }

  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of [...set]) {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[friction] listener for "${event}" failed`, error);
      }
    }
  }
}
