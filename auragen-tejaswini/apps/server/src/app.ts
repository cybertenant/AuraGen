import { randomUUID } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import {
  AdaptRequestSchema,
  computeFrictionScore,
  sanitizeForAi,
} from "@tejaswini/shared";
import { config } from "./config.js";
import { GuardrailError } from "./ai/guard.js";
import {
  createGeminiGenerator,
  generateUi,
  offlineGenerator,
  type UiGenerator,
} from "./ai/generator.js";
import { createSession, getSession } from "./services/session-store.js";

export function defaultGenerator(): UiGenerator {
  return config.geminiApiKey
    ? createGeminiGenerator(config.geminiApiKey, config.geminiModel)
    : offlineGenerator;
}

export interface CreateAppOptions {
  generator?: UiGenerator;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const generator = options.generator ?? defaultGenerator();
  const app = express();

  app.use(cors({ origin: config.corsOrigin, methods: ["GET", "POST", "OPTIONS"] }));
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "auragen-tejaswini-server",
      timestamp: new Date().toISOString(),
      generator: config.geminiApiKey ? "gemini" : "offline",
    });
  });

  app.post("/api/sessions", (req: Request, res: Response) => {
    const requestedId = typeof req.body?.id === "string" ? req.body.id : "";
    const id = requestedId || randomUUID();
    const session = createSession(id);
    res.status(201).json({ id: session.id, createdAt: session.createdAt });
  });

  app.get("/api/sessions/:id", (req: Request, res: Response) => {
    const session = getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({
      id: session.id,
      createdAt: session.createdAt,
      answerCount: Object.keys(session.answers).length,
    });
  });

  app.post("/api/adaptations", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = AdaptRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid adaptation request" });
        return;
      }
      const { sessionId, signals, fieldIds } = parsed.data;
      const score = computeFrictionScore(signals);
      const context = sanitizeForAi(sessionId, score, fieldIds);
      const ui = await generateUi(context, generator);
      res.json({ score, frictionLevel: context.frictionLevel, ui });
    } catch (error) {
      next(error);
    }
  });

  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(error instanceof GuardrailError ? 422 : 500).json({
      error: message,
    });
  });

  return app;
}
