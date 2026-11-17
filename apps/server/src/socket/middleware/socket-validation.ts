import {
  SessionJoinPayload,
  SessionJoinPayloadSchema,
  TelemetryBatchPayload,
  TelemetryBatchPayloadSchema,
  ServerErrorPayload,
  ServerErrorCode,
} from "@auragen/shared";

const MAX_PAYLOAD_BYTES = 4096;

export interface RateLimitConfig {
  minIntervalMs: number;
  maxEventsPerWindow: number;
  windowMs: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  minIntervalMs: 120,
  maxEventsPerWindow: 25,
  windowMs: 10000,
};

interface SocketRateState {
  timestamps: number[];
  lastSignature: string | null;
  lastSignatureAt: number;
}

export class SocketRateGuard {
  private readonly stateBySocketId = new Map<string, SocketRateState>();
  private readonly config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_RATE_LIMIT, ...config };
  }

  public checkRateAndDuplicate(
    socketId: string,
    payloadSignature: string,
    nowMs = Date.now()
  ): {
    allowed: boolean;
    isDuplicate: boolean;
    reason?: string;
  } {
    let state = this.stateBySocketId.get(socketId);
    if (!state) {
      state = {
        timestamps: [],
        lastSignature: null,
        lastSignatureAt: 0,
      };
      this.stateBySocketId.set(socketId, state);
    }

    // Prune timestamps outside the rolling window
    state.timestamps = state.timestamps.filter(
      (ts) => nowMs - ts <= this.config.windowMs
    );

    const lastEventAt =
      state.timestamps.length > 0
        ? state.timestamps[state.timestamps.length - 1]!
        : 0;

    if (
      state.timestamps.length >= this.config.maxEventsPerWindow ||
      (lastEventAt > 0 && nowMs - lastEventAt < this.config.minIntervalMs)
    ) {
      return {
        allowed: false,
        isDuplicate: false,
        reason:
          "Telemetry batch rate limit exceeded. Please throttle telemetry transmissions.",
      };
    }

    // Detect rapid duplicate identical payload within 800ms
    const isDuplicate =
      state.lastSignature === payloadSignature &&
      nowMs - state.lastSignatureAt < 800;

    state.timestamps.push(nowMs);
    state.lastSignature = payloadSignature;
    state.lastSignatureAt = nowMs;

    return {
      allowed: true,
      isDuplicate,
    };
  }

  public clearSocket(socketId: string): void {
    this.stateBySocketId.delete(socketId);
  }
}

export function buildServerError(
  code: ServerErrorCode,
  message: string
): ServerErrorPayload {
  return {
    code,
    message,
    timestamp: new Date().toISOString(),
  };
}

export function isPayloadWithinSizeLimit(payload: unknown): boolean {
  try {
    const serialized = JSON.stringify(payload ?? {});
    return Buffer.byteLength(serialized, "utf8") <= MAX_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

export function validateSessionJoinPayload(payload: unknown):
  | { success: true; data: SessionJoinPayload }
  | { success: false; error: ServerErrorPayload } {
  if (!isPayloadWithinSizeLimit(payload)) {
    return {
      success: false,
      error: buildServerError(
        "INVALID_SESSION_UUID",
        "Session join payload exceeds maximum allowed size."
      ),
    };
  }

  const parsed = SessionJoinPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: buildServerError(
        "INVALID_SESSION_UUID",
        parsed.error.issues[0]?.message || "Malformed session UUID."
      ),
    };
  }

  return { success: true, data: parsed.data };
}

export function validateTelemetryBatchPayload(payload: unknown):
  | { success: true; data: TelemetryBatchPayload; signature: string }
  | { success: false; error: ServerErrorPayload } {
  if (!isPayloadWithinSizeLimit(payload)) {
    return {
      success: false,
      error: buildServerError(
        "INVALID_TELEMETRY_PAYLOAD",
        "Telemetry batch payload exceeds maximum size (4KB)."
      ),
    };
  }

  const parsed = TelemetryBatchPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      success: false,
      error: buildServerError(
        "INVALID_TELEMETRY_PAYLOAD",
        parsed.error.issues[0]?.message ||
          "Malformed or prohibited fields in telemetry:batch payload."
      ),
    };
  }

  const d = parsed.data;
  const signature = `${d.observationWindowSeconds}:${d.fieldFocusCount}:${d.hesitationCount}:${d.validationErrors}:${d.repeatedClicks}:${d.backtracks}:${d.cursorAnomalyScore.toFixed(2)}`;

  return {
    success: true,
    data: d,
    signature,
  };
}