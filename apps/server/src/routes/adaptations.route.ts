import { Router, Request, Response } from "express";
import { GenerateContextualAdaptationRequestSchema } from "../ai/context/context.schema.js";
import { buildSanitizedGenerationContext } from "../ai/context/context-builder.js";
import { CONTEXTUAL_SIMULATION_PRESETS } from "../ai/context/context-utils.js";
import {
  generateAdaptiveUI,
  generateContextualAdaptiveUI,
} from "../ai/services/ui-generation.service.js";
import { getAIHealthStatus } from "../ai/services/ai-health.service.js";
import { StructuredUIProvider } from "../ai/providers/gemini.provider.js";
import {
  DrizzlePersistenceRepository,
  PersistenceRepository,
} from "../repositories/persistence.repository.js";
import { FrictionSessionService } from "../socket/services/friction-session.service.js";
import { logger } from "../utils/logger.js";

export interface CreateAdaptationsRouterOptions {
  persistenceRepository?: PersistenceRepository;
  frictionSessionService?: FrictionSessionService;
  aiProvider?: StructuredUIProvider;
  maxRequestsPerMinutePerSession?: number;
}

export function createAdaptationsRouter(
  options?: CreateAdaptationsRouterOptions
): Router {
  const router = Router();
  const repo =
    options?.persistenceRepository ?? new DrizzlePersistenceRepository();
  const frictionSessionService = options?.frictionSessionService;
  const maxPerMinute = options?.maxRequestsPerMinutePerSession ?? 5;

  const requestTimestampsBySession = new Map<string, number[]>();
  const inFlightSessions = new Set<string>();

  router.get("/status", (_req: Request, res: Response) => {
    return res.status(200).json({
      status: "ok",
      ai: getAIHealthStatus(),
      contextualPresets: Object.values(CONTEXTUAL_SIMULATION_PRESETS).map(
        (p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          currentSectionId: p.currentSectionId,
          smoothedScore: p.smoothedScore,
          frictionLevel: p.frictionLevel,
        })
      ),
    });
  });

  router.post("/generate", async (req: Request, res: Response) => {
    const parsed = GenerateContextualAdaptationRequestSchema.safeParse(
      req.body
    );
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

    const {
      sessionId,
      generationMode,
      presentationGoal,
      triggerScore,
      formContext,
      simulationScenario,
    } = parsed.data;

    if (inFlightSessions.has(sessionId)) {
      return res.status(409).json({
        success: false,
        errorCode: "DUPLICATE_IN_FLIGHT",
        message:
          "An adaptive UI generation request is already in progress for this session.",
      });
    }

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
      let result;
      let effectiveTriggerScore = triggerScore ?? 0;

      if (generationMode === "contextual") {
        const serverTelemetry =
          frictionSessionService?.getSessionTelemetryContext(sessionId);

        let recentScores: number[] = [];
        try {
          const events = await repo.getFrictionEvents(sessionId, 5);
          if (events) {
            recentScores = events.map((e) => e.frictionScore);
          }
        } catch {
          // Graceful fallback if history query fails
        }

        const sanitizedContext = buildSanitizedGenerationContext({
          sessionId,
          serverEvaluation: serverTelemetry?.evaluation ?? null,
          serverFieldMetrics: serverTelemetry?.fieldMetrics ?? [],
          serverEligibilityReason: serverTelemetry?.eligibilityReason,
          serverTelemetryUpdatedAtMs: serverTelemetry?.lastBatchAtMs ?? null,
          recentFrictionScores: recentScores,
          previousLayout: serverTelemetry?.previousLayout ?? null,
          clientFormContext: formContext,
          simulationScenario,
        });

        effectiveTriggerScore = Math.round(
          sanitizedContext.friction.smoothedScore
        );

        result = await generateContextualAdaptiveUI({
          sanitizedContext,
          adaptationGoal: presentationGoal,
          provider: options?.aiProvider,
        });
      } else {
        const standardRes = await generateAdaptiveUI({
          presentationGoal,
          provider: options?.aiProvider,
        });
        result = {
          ...standardRes,
          generationMode: "standard" as const,
        };
      }

      if (!result.success || !result.schema) {
        const statusCode =
          result.errorCode === "MISSING_API_KEY"
            ? 503
            : result.errorCode === "RATE_LIMIT_EXCEEDED" ||
              result.errorCode === "QUOTA_EXHAUSTED"
            ? 429
            : result.errorCode === "TIMEOUT"
            ? 504
            : result.errorCode === "CONTEXT_SANITIZATION_FAILED"
            ? 400
            : 502;

        return res.status(statusCode).json({
          ...result,
          persisted: false,
        });
      }

      frictionSessionService?.recordGeneratedLayoutMetadata(sessionId, {
        title: result.schema.title,
        stepCount: result.schema.steps.length,
      });

      let persisted = false;
      let adaptationId: string | null = null;
      let persistenceError: string | null = null;

      if (repo.saveUiAdaptation) {
        try {
          const saved = await repo.saveUiAdaptation(sessionId, {
            triggerScore: effectiveTriggerScore,
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