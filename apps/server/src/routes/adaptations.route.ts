import { Router, Request, Response } from "express";
import { GenerateAdaptationRequestSchema } from "../ai/schemas/generation.schema.js";
import { generateAdaptiveUI } from "../ai/services/ui-generation.service.js";
import { getAIHealthStatus } from "../ai/services/ai-health.service.js";
import { StructuredUIProvider } from "../ai/providers/gemini.provider.js";
import {
  DrizzlePersistenceRepository,
  PersistenceRepository,
} from "../repositories/persistence.repository.js";
import { logger } from "../utils/logger.js";

export interface CreateAdaptationsRouterOptions {
  persistenceRepository?: PersistenceRepository;
  aiProvider?: StructuredUIProvider;
  maxRequestsPerMinutePerSession?: number;
}

export function createAdaptationsRouter(
  options?: CreateAdaptationsRouterOptions
): Router {
  const router = Router();
  const repo =
    options?.persistenceRepository ?? new DrizzlePersistenceRepository();
  const maxPerMinute = options?.maxRequestsPerMinutePerSession ?? 5;

  // Per-session sliding window rate limiter & in-flight duplicate guard
  const requestTimestampsBySession = new Map<string, number[]>();
  const inFlightSessions = new Set<string>();

  router.get("/status", (_req: Request, res: Response) => {
    return res.status(200).json({
      status: "ok",
      ai: getAIHealthStatus(),
    });
  });

  router.post("/generate", async (req: Request, res: Response) => {
    const parsed = GenerateAdaptationRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        errorCode: "INVALID_REQUEST",
        message: "Invalid adaptive UI generation request payload.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    const { sessionId, presentationGoal, triggerScore } = parsed.data;

    // 1. Duplicate in-flight protection
    if (inFlightSessions.has(sessionId)) {
      return res.status(409).json({
        success: false,
        errorCode: "DUPLICATE_IN_FLIGHT",
        message:
          "An adaptive UI generation request is already in progress for this session.",
      });
    }

    // 2. Per-session rate limit check
    const nowMs = Date.now();
    const recent = (requestTimestampsBySession.get(sessionId) ?? []).filter(
      (ts) => nowMs - ts < 60_000
    );
    if (recent.length >= maxPerMinute) {
      return res.status(429).json({
        success: false,
        errorCode: "RATE_LIMIT_EXCEEDED",
        message: `Rate limit exceeded (max ${maxPerMinute} generation requests per minute per session).`,
      });
    }

    // 3. Validate active session in Neon
    let sessionExists = false;
    try {
      const session = await repo.getSessionById(sessionId);
      sessionExists = Boolean(session);
    } catch (err) {
      logger.warn("Session lookup failed during adaptive generation", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      return res.status(503).json({
        success: false,
        errorCode: "PERSISTENCE_FAILED",
        message:
          "Unable to verify session in Neon PostgreSQL. Database may be offline.",
      });
    }

    if (!sessionExists) {
      return res.status(404).json({
        success: false,
        errorCode: "INVALID_SESSION",
        message: `Session "${sessionId}" was not found.`,
      });
    }

    recent.push(nowMs);
    requestTimestampsBySession.set(sessionId, recent);
    inFlightSessions.add(sessionId);

    try {
      // 4. Invoke LangChain + Gemini generation service (with sanitized metadata only)
      const result = await generateAdaptiveUI({
        presentationGoal,
        provider: options?.aiProvider,
      });

      if (!result.success || !result.schema) {
        const statusCode =
          result.errorCode === "MISSING_API_KEY"
            ? 503
            : result.errorCode === "RATE_LIMIT_EXCEEDED" ||
              result.errorCode === "QUOTA_EXHAUSTED"
            ? 429
            : result.errorCode === "TIMEOUT"
            ? 504
            : 502;

        return res.status(statusCode).json({
          ...result,
          persisted: false,
        });
      }

      // 5. Save validated schema to Neon `ui_adaptations` with status = "validated"
      let persisted = false;
      let adaptationId: string | null = null;
      let persistenceError: string | null = null;

      if (repo.saveUiAdaptation) {
        try {
          const saved = await repo.saveUiAdaptation(sessionId, {
            triggerScore: triggerScore ?? 75,
            uiSchema: result.schema as unknown as Record<string, unknown>,
            modelName: result.model,
            generationTimeMs: result.generationTimeMs,
            status: "validated",
          });
          if (saved) {
            persisted = true;
            adaptationId = saved.id;
          }
        } catch (dbErr) {
          persisted = false;
          persistenceError =
            dbErr instanceof Error
              ? dbErr.message
              : "Failed to persist validated adaptation to Neon PostgreSQL.";
          logger.warn("Neon persistence failed for validated adaptation", {
            sessionId,
            error: persistenceError,
          });
        }
      }

      return res.status(200).json({
        ...result,
        adaptationId,
        persisted,
        persistenceError,
      });
    } finally {
      inFlightSessions.delete(sessionId);
    }
  });

  return router;
}