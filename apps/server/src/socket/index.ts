import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "@auragen/shared";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { PersistenceService } from "../services/persistence.service.js";
import { FrictionSessionService } from "./services/friction-session.service.js";
import {
  SocketRateGuard,
  RateLimitConfig,
} from "./middleware/socket-validation.js";
import { AdaptiveThresholdConfig } from "../adaptive/adaptive.config.js";
import { Clock } from "../adaptive/adaptive.types.js";
import { registerSessionHandler } from "./handlers/session.handler.js";
import { registerTelemetryHandler } from "./handlers/telemetry.handler.js";

export interface CreateSocketServerOptions {
  corsOrigin?: string | string[];
  persistenceService?: PersistenceService;
  persistIntervalMs?: number;
  rateLimitConfig?: Partial<RateLimitConfig>;
  adaptiveOptions?: {
    config?: Partial<AdaptiveThresholdConfig>;
    clock?: Clock;
  };
}

export function createSocketServer(
  httpServer: HttpServer,
  options: CreateSocketServerOptions = {}
) {
  const allowedOrigins = options.corsOrigin ??
    env.CORS_ORIGIN.split(",").map((o) => o.trim());

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    maxHttpBufferSize: 16384,
  });

  const frictionSessionService = new FrictionSessionService(
    options.persistenceService,
    options.persistIntervalMs,
    options.adaptiveOptions
  );
  const rateGuard = new SocketRateGuard(options.rateLimitConfig);

  io.on("connection", (socket) => {
    logger.info("Socket.IO client connected", { socketId: socket.id });

    registerSessionHandler(socket, frictionSessionService);
    registerTelemetryHandler(io, socket, frictionSessionService, rateGuard);

    socket.on("disconnect", (reason) => {
      rateGuard.clearSocket(socket.id);
      logger.info("Socket.IO client disconnected", {
        socketId: socket.id,
        sessionId: socket.data.sessionId ?? null,
        reason,
      });
    });
  });

  return {
    io,
    frictionSessionService,
  };
}