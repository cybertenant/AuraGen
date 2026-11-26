import type { Server } from "socket.io";
import type {
  AdaptationFailedEvent,
  AdaptationGeneratingEvent,
  AdaptationReadyEvent,
} from "@auragen/shared";

export interface AdaptationRoomEmitter {
  toSessionRoom(sessionId: string, event: string, payload: unknown): void;
}

export function createSocketRoomEmitter(io: Server): AdaptationRoomEmitter {
  return {
    toSessionRoom(sessionId: string, event: string, payload: unknown): void {
      io.to(`session:${sessionId}`).emit(event, payload);
    },
  };
}

export class AdaptationDeliveryService {
  constructor(private readonly emitter: AdaptationRoomEmitter) {}

  public emitGenerating(payload: AdaptationGeneratingEvent): void {
    this.emitter.toSessionRoom(
      payload.sessionId,
      "adaptation:generating",
      payload
    );
  }

  public emitReady(payload: AdaptationReadyEvent): void {
    this.emitter.toSessionRoom(payload.sessionId, "adaptation:ready", payload);
  }

  public emitFailed(sessionId: string, payload: AdaptationFailedEvent): void {
    this.emitter.toSessionRoom(sessionId, "adaptation:failed", payload);
  }
}