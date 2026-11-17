import { Socket } from "socket.io";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  SessionJoinAck,
} from "@auragen/shared";
import { SOCKET_EVENTS, getSessionRoomName } from "../events.js";
import {
  validateSessionJoinPayload,
  buildServerError,
} from "../middleware/socket-validation.js";
import { FrictionSessionService } from "../services/friction-session.service.js";
import { DatabaseUnavailableError } from "../../db/index.js";
import { logger } from "../../utils/logger.js";

export type AuraGenSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export function registerSessionHandler(
  socket: AuraGenSocket,
  frictionSessionService: FrictionSessionService
): void {
  socket.on(
    SOCKET_EVENTS.CLIENT.SESSION_JOIN,
    async (rawPayload: unknown, ack?: (response: SessionJoinAck) => void) => {
      const validation = validateSessionJoinPayload(rawPayload);
      const nowIso = new Date().toISOString();

      if (!validation.success) {
        socket.emit(SOCKET_EVENTS.SERVER.SERVER_ERROR, validation.error);
        ack?.({
          ok: false,
          serverTimestamp: nowIso,
          errorCode: validation.error.code,
          message: validation.error.message,
        });
        return;
      }

      const { sessionId } = validation.data;

      try {
        const sessionRecord = await frictionSessionService
          .getPersistenceService()
          .getSessionById(sessionId);

        if (!sessionRecord) {
          const notFoundErr = buildServerError(
            "SESSION_NOT_FOUND",
            `Session ${sessionId} does not exist in Neon PostgreSQL.`
          );
          socket.emit(SOCKET_EVENTS.SERVER.SERVER_ERROR, notFoundErr);
          ack?.({
            ok: false,
            serverTimestamp: nowIso,
            errorCode: notFoundErr.code,
            message: notFoundErr.message,
          });
          return;
        }
      } catch (err) {
        if (err instanceof DatabaseUnavailableError) {
          // Allow local demo mode operation when Neon is temporarily unreachable,
          // while informing the client via structured log/warning.
          logger.warn(
            "Database unavailable during session:join; allowing degraded in-memory session context",
            { sessionId }
          );
        } else {
          const internalErr = buildServerError(
            "DATABASE_UNAVAILABLE",
            "Could not verify session in database."
          );
          socket.emit(SOCKET_EVENTS.SERVER.SERVER_ERROR, internalErr);
          ack?.({
            ok: false,
            serverTimestamp: nowIso,
            errorCode: internalErr.code,
            message: internalErr.message,
          });
          return;
        }
      }

      // Leave any previous session room on this socket to enforce strict room isolation
      if (socket.data.sessionId && socket.data.sessionId !== sessionId) {
        const previousRoom = getSessionRoomName(socket.data.sessionId);
        await socket.leave(previousRoom);
      }

      const roomName = getSessionRoomName(sessionId);
      await socket.join(roomName);
      socket.data.sessionId = sessionId;
      socket.data.joinedAt = nowIso;

      frictionSessionService.ensureSessionContext(sessionId);

      const readyPayload = {
        sessionId,
        room: roomName,
        serverTimestamp: nowIso,
        message: "Connected to authoritative session telemetry room.",
      };

      socket.emit(SOCKET_EVENTS.SERVER.SESSION_READY, readyPayload);

      ack?.({
        ok: true,
        sessionId,
        room: roomName,
        serverTimestamp: nowIso,
      });

      logger.info("Socket joined session room", {
        socketId: socket.id,
        sessionId,
        room: roomName,
      });
    }
  );
}