import { createServer } from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initializeSocketServer } from "./socket/index.js";
import { logger } from "./utils/logger.js";

const app = createApp();
const httpServer = createServer(app);

initializeSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`AuraGen Backend Server running on http://localhost:${env.PORT}`, {
    environment: env.NODE_ENV,
    corsOrigin: env.CORS_ORIGIN,
  });
});