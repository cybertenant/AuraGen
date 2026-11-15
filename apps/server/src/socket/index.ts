import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@auragen/shared";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

export function initializeSocketServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on(
    "connection",
    (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      logger.info("Client connected to AuraGen Telemetry Socket", {
        socketId: socket.id,
      });

      socket.on("telemetry:simulate_high_friction", ({ sessionId }) => {
        logger.info("Simulated high cognitive friction received", {
          socketId: socket.id,
          sessionId,
        });

        socket.emit("telemetry:acknowledged", {
          sessionId,
          score: 88,
          level: "high",
          interactionStatus: "High Cognitive Load",
          adaptationStatus: "Adapting",
        });
      });

      socket.on("telemetry:reset_friction", ({ sessionId }) => {
        logger.info("Resetting cognitive friction state", {
          socketId: socket.id,
          sessionId,
        });

        socket.emit("telemetry:acknowledged", {
          sessionId,
          score: 0,
          level: "low",
          interactionStatus: "Normal",
          adaptationStatus: "Waiting",
        });
      });

      socket.on("disconnect", (reason) => {
        logger.info("Client disconnected from AuraGen Telemetry Socket", {
          socketId: socket.id,
          reason,
        });
      });
    }
  );

  return io;
}