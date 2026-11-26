import { randomUUID } from "node:crypto";
import { buildSanitizedGenerationContext } from "../ai/context/context-builder.js";
import { generateContextualAdaptiveUI } from "../ai/services/ui-generation.service.js";
import type { StructuredUIProvider } from "../ai/providers/gemini.provider.js";
import type { PresentationGoal } from "../ai/types/ai.types.js";
import {
  AdaptationLifecycleService,
  adaptationLifecycleService,
  StoredAdaptationRecord,
} from "./adaptation-lifecycle.service.js";
import { AdaptationDeliveryService } from "./adaptation-delivery.service.js";
import { logger } from "../utils/logger.js";

export interface TriggerAdaptationFromEligibilityParams {
  sessionId: string;
  eligibilityId: string;
  isServerAuthoritative: boolean;
  isEligible: boolean;
  smoothedScore?: number;
  frictionLevel?: "low" | "medium" | "high";
  dominantSectionId?: string;
  adaptationGoal?: PresentationGoal;
  provider?: StructuredUIProvider;
  deliveryService?: AdaptationDeliveryService;
  lifecycleService?: AdaptationLifecycleService;
  persistValidatedSchema?: (
    record: StoredAdaptationRecord
  ) => Promise<void>;
}

export interface AdaptationOrchestrationOutcome {
  triggered: boolean;
  deduplicated?: boolean;
  reason?: string;
  generationId?: string;
  record?: StoredAdaptationRecord;
}

/**
 * Automatic Adaptation Orchestrator (Day 11).
 * Connects server-authoritative Day 6 eligibility -> Day 9 Context Builder ->
 * Gemini + LangChain -> Day 10 Security Guard -> Neon Persistence -> Socket.IO Room Delivery.
 */
export async function orchestrateAdaptationForEligibleSession(
  params: TriggerAdaptationFromEligibilityParams
): Promise<AdaptationOrchestrationOutcome> {
  const lifecycle = params.lifecycleService ?? adaptationLifecycleService;

  // 1. Never trust browser-generated eligibility claims
  if (!params.isServerAuthoritative || !params.isEligible) {
    return {
      triggered: false,
      reason: "UNTRUSTED_OR_INELIGIBLE_EVENT",
    };
  }

  // 2. Deduplicate repeated eligibility triggers for the same episode
  const dedupKey = `${params.sessionId}:${params.eligibilityId}`;
  if (lifecycle.hasProcessedEligibility(dedupKey)) {
    return {
      triggered: false,
      deduplicated: true,
      reason: "DUPLICATE_ELIGIBILITY_EVENT",
    };
  }

  // 3. Prevent concurrent generation storms for the same session
  if (lifecycle.isGeneratingForSession(params.sessionId)) {
    return {
      triggered: false,
      deduplicated: true,
      reason: "GENERATION_ALREADY_IN_PROGRESS",
    };
  }

  lifecycle.markEligibilityProcessed(dedupKey);
  lifecycle.setGeneratingForSession(params.sessionId, true);

  const generationId = randomUUID();
  const startMs = Date.now();

  try {
    params.deliveryService?.emitGenerating({
      sessionId: params.sessionId,
      generationId,
      status: "generating",
      timestamp: new Date().toISOString(),
    });

    // 4. Build sanitized interaction context (zero financial answers or PII)
    const sanitizedContext = buildSanitizedGenerationContext({
      sessionId: params.sessionId,
      simulationScenario: "financial_information_friction",
    });

    // 5. Invoke contextual generation + Day 10 defense-in-depth security guard
    const genResult = await generateContextualAdaptiveUI({
      sanitizedContext,
      adaptationGoal: params.adaptationGoal ?? "simplify_cognitive_load",
      provider: params.provider,
    });

    const durationMs = Math.max(1, Date.now() - startMs);
    const baseRecord = lifecycle.recordGenerated({
      sessionId: params.sessionId,
      generationId,
      modelName: genResult.model,
      generationDurationMs: durationMs,
    });

    if (!genResult.success || !genResult.schema) {
      const errCode = genResult.errorCode ?? "GENERATION_FAILED";
      lifecycle.markFailed(baseRecord.adaptationId, errCode);

      params.deliveryService?.emitFailed(params.sessionId, {
        sessionId: params.sessionId,
        generationId,
        status: "failed",
        errorCode: errCode,
        message:
          genResult.errorMessage ??
          "Unable to generate a valid adaptive layout. Standard form preserved.",
        timestamp: new Date().toISOString(),
      });

      return {
        triggered: true,
        generationId,
        reason: errCode,
      };
    }

    // 6. Persist validated schema before emitting adaptation:ready
    const validatedRecord = lifecycle.markValidated(
      baseRecord.adaptationId,
      genResult.schema
    );

    if (params.persistValidatedSchema) {
      try {
        await params.persistValidatedSchema(validatedRecord);
      } catch (dbErr) {
        logger.error("Failed to persist validated adaptation schema", {
          sessionId: params.sessionId,
          adaptationId: validatedRecord.adaptationId,
          error: dbErr instanceof Error ? dbErr.message : String(dbErr),
        });
        lifecycle.markFailed(validatedRecord.adaptationId, "PERSISTENCE_FAILED");
        params.deliveryService?.emitFailed(params.sessionId, {
          sessionId: params.sessionId,
          generationId,
          status: "failed",
          errorCode: "PERSISTENCE_FAILED",
          message:
            "Adaptive layout could not be saved safely. Original form preserved.",
          timestamp: new Date().toISOString(),
        });
        return {
          triggered: true,
          generationId,
          reason: "PERSISTENCE_FAILED",
        };
      }
    }

    // 7. Deliver validated schema strictly to the matching session room
    params.deliveryService?.emitReady({
      sessionId: params.sessionId,
      generationId,
      adaptationId: validatedRecord.adaptationId,
      status: "validated",
      schemaVersion: 1,
      schema: validatedRecord.schema as unknown as Record<string, unknown>,
      timestamp: new Date().toISOString(),
    });

    return {
      triggered: true,
      generationId,
      record: validatedRecord,
    };
  } finally {
    lifecycle.setGeneratingForSession(params.sessionId, false);
  }
}