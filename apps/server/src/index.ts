import http from "http";
import { env } from "./config/env.js";
import { createApp } from "./app.js";
import { createSocketServer } from "./socket/index.js";
import { closeDatabasePool } from "./db/index.js";
import { logger } from "./utils/logger.js";

const httpServer = http.createServer();
const { io, frictionSessionService } = createSocketServer(httpServer);

const app = createApp({ frictionSessionService });
httpServer.on("request", app);

httpServer.listen(env.PORT, () => {
  logger.info(`AuraGen Backend Server listening on port ${env.PORT}`, {
    env: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
    socketReady: Boolean(io),
  });
});

async function shutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down AuraGen server gracefully...`);
  io.close();
  httpServer.close(async () => {
    await closeDatabasePool();
    logger.info("HTTP, Socket.IO, and PostgreSQL pool closed cleanly.");
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));