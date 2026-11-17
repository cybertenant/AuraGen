export const SOCKET_EVENTS = {
  CLIENT: {
    SESSION_JOIN: "session:join",
    TELEMETRY_BATCH: "telemetry:batch",
    LEGACY_SIMULATE_HIGH: "telemetry:simulate_high_friction",
    LEGACY_RESET: "telemetry:reset_friction",
  },
  SERVER: {
    SESSION_READY: "session:ready",
    TELEMETRY_ACK: "telemetry:ack",
    FRICTION_UPDATE: "friction:update",
    SERVER_ERROR: "server:error",
    FRICTION_STATE: "friction:state",
    FRICTION_ALERT: "friction:alert",
    ADAPTATION_ELIGIBLE: "adaptation:eligible",
    LEGACY_ACKNOWLEDGED: "telemetry:acknowledged",
  },
} as const;

export function getSessionRoomName(sessionId: string): string {
  return `session:${sessionId}`;
}