import express, { Express } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.route.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));

  // Routes
  app.use("/", healthRouter);

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