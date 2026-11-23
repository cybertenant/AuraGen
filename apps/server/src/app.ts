import express, { Express } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.route.js";
import { createSessionsRouter } from "./routes/sessions.route.js";
import { createAdaptationsRouter } from "./routes/adaptations.route.js";
import { StructuredUIProvider } from "./ai/providers/gemini.provider.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { PersistenceRepository } from "./repositories/persistence.repository.js";

export interface CreateAppOptions {
  persistenceRepository?: PersistenceRepository;
  aiProvider?: StructuredUIProvider;
}

export function createApp(options?: CreateAppOptions): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      methods: ["GET", "POST", "PUT", "OPTIONS"],
      credentials: true,
    })
  );

  // Sensible body size limit (64kb) to prevent oversized JSON payloads
  app.use(express.json({ limit: "64kb" }));

  // Routes
  app.use("/", healthRouter);
  app.use("/api/sessions", createSessionsRouter(options?.persistenceRepository));
  app.use("/api/adaptations", createAdaptationsRouter({ persistenceRepository: options?.persistenceRepository, aiProvider: options?.aiProvider }));

  // 404 Handler
  app.use((_req, res) => {
    res.status(404).json({
      status: "error",
      statusCode: 404,
      message: "Route not found",
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}