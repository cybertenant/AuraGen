import { randomUUID } from "crypto";
import { Server } from "socket.io";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  TelemetryAckPayload,
  ServerErrorPayload,
} from "@auragen/shared";
import { SOCKET_EVENTS, getSessionRoomName } from "../events.js";
import {
  validateTelemetryBatchPayload,
  buildServerError,
  SocketRateGuard,
} from "../middleware/socket-validation.js";
import { FrictionSessionService } from "../services/friction-session.service.js";
import { AuraGenSocket } from "./session.handler.js";
import { logger } from "../../utils/logger.js";

export type AuraGenSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerTelemetryHandler(
  io: AuraGenSocketServer,
  socket: AuraGenSocket,
  frictionSessionService: FrictionSessionService,
  rateGuard: SocketRateGuard
): void {
  socket.on(
    SOCKET_EVENTS.CLIENT.TELEMETRY_BATCH,
    async (
      rawPayload: unknown,
      ack?: (response: TelemetryAckPayload | ServerErrorPayload) => void
    ) => {
      const boundSessionId = socket.data.sessionId;
      if (!boundSessionId) {
        const unauthErr = buildServerError(
          "UNAUTHORIZED_SESSION",
          "Socket must join a valid session via session:join before sending telemetry:batch."
        );
        socket.emit(SOCKET_EVENTS.SERVER.SERVER_ERROR, unauthErr);
        ack?.(unauthErr);
        return;
      }

      const validation = validateTelemetryBatchPayload(rawPayload);
      if (!validation.success) {
        socket.emit(SOCKET_EVENTS.SERVER.SERVER_ERROR, validation.error);
        ack?.(validation.error);
        return;
      }

      const nowMs = frictionSessionService.getClock().now();
      const rateCheck = rateGuard.checkRateAndDuplicate(
        socket.id,
        validation.signature,
        nowMs
      );

      if (!rateCheck.allowed) {
        const rateErr = buildServerError(
          "RATE_LIMIT_EXCEEDED",
          rateCheck.reason || "Rate limit exceeded."
        );
        socket.emit(SOCKET_EVENTS.SERVER.SERVER_ERROR, rateErr);
        ack?.(rateErr);
        return;
      }

      if (rateCheck.isDuplicate) {
        const dedupAck: TelemetryAckPayload = {
          status: "deduplicated",
          batchId: randomUUID(),
          sessionId: boundSessionId,
          serverTimestamp: new Date(nowMs).toISOString(),
          processingTimeMs: 0,
          persistedToDatabase: false,
          databaseAvailable: true,
        };
        socket.emit(SOCKET_EVENTS.SERVER.TELEMETRY_ACK, dedupAck);
        ack?.(dedupAck);
        return;
      }

      try {
        const {
          ack: processedAck,
          frictionUpdate,
          orchestration,
        } = await frictionSessionService.processTelemetryBatch(
          boundSessionId,
          validation.data,
          nowMs
        );

        const roomName = getSessionRoomName(boundSessionId);
        const { socketPayloads } = orchestration;

        // 1. Emit telemetry:ack to sender
        socket.emit(SOCKET_EVENTS.SERVER.TELEMETRY_ACK, processedAck);
        ack?.(processedAck);

        // 2. Broadcast authoritative friction:update to the private session room
        io.to(roomName).emit(
          SOCKET_EVENTS.SERVER.FRICTION_UPDATE,
          frictionUpdate
        );

        // 3. Emit Day 6 Adaptive Friction Threshold Orchestration events strictly to session room
        io.to(roomName).emit(
          SOCKET_EVENTS.SERVER.FRICTION_STATE,
          socketPayloads.frictionState
        );

        for (const alert of socketPayloads.frictionAlerts) {
          io.to(roomName).emit(SOCKET_EVENTS.SERVER.FRICTION_ALERT, alert);
        }

        if (socketPayloads.adaptationEligible) {
          io.to(roomName).emit(
            SOCKET_EVENTS.SERVER.ADAPTATION_ELIGIBLE,
            socketPayloads.adaptationEligible
          );
        }

        if (socketPayloads.adaptationDeferred) {
          io.to(roomName).emit(
            SOCKET_EVENTS.SERVER.ADAPTATION_DEFERRED,
            socketPayloads.adaptationDeferred
          );
        }

        if (socketPayloads.frictionRecovered) {
          io.to(roomName).emit(
            SOCKET_EVENTS.SERVER.FRICTION_RECOVERED,
            socketPayloads.frictionRecovered
          );
        }
      } catch (err) {
        logger.error("Unexpected error handling telemetry:batch", {
          sessionId: boundSessionId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
        const internalErr = buildServerError(
          "INTERNAL_SOCKET_ERROR",
          "Failed to process telemetry batch."
        );
        socket.emit(SOCKET_EVENTS.SERVER.SERVER_ERROR, internalErr);
        ack?.(internalErr);
      }
    }
  );

  // Preserve Day 1 legacy events for backward compatibility
  socket.on(SOCKET_EVENTS.CLIENT.LEGACY_SIMULATE_HIGH, (payload) => {
    socket.emit(SOCKET_EVENTS.SERVER.LEGACY_ACKNOWLEDGED, {
      sessionId: payload.sessionId,
      score: 88,
      level: "high",
      interactionStatus: "High Cognitive Load",
      adaptationStatus: "Adapting",
    });
  });

  socket.on(SOCKET_EVENTS.CLIENT.LEGACY_RESET, (payload) => {
    if (socket.data.sessionId) {
      frictionSessionService.resetSessionFriction(socket.data.sessionId);
    }
    socket.emit(SOCKET_EVENTS.SERVER.LEGACY_ACKNOWLEDGED, {
      sessionId: payload.sessionId,
      score: 0,
      level: "low",
      interactionStatus: "Normal",
      adaptationStatus: "Waiting",
    });
  });
}