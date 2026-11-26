import { randomUUID } from "node:crypto";
import type { AdaptationLifecycleStatus } from "@auragen/shared";
import { GeneratedAdaptiveUISchema } from "../ai/types/ai.types.js";
import { logger } from "../utils/logger.js";

export interface StoredAdaptationRecord {
  adaptationId: string;
  generationId: string;
  sessionId: string;
  schemaVersion: 1;
  modelName: string;
  generationDurationMs: number;
  status: AdaptationLifecycleStatus;
  schema: GeneratedAdaptiveUISchema | null;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
  renderedAt?: string;
}

/**
 * Authoritative Adaptation Lifecycle Service (Day 11).
 * Tracks valid transitions:
 *   generated -> validated -> rendered
 *   generated -> failed
 * Preserves the last successfully validated adaptation when subsequent generations fail.
 */
export class AdaptationLifecycleService {
  private readonly recordsByAdaptationId = new Map<string, StoredAdaptationRecord>();
  private readonly latestValidatedBySession = new Map<string, string>();
  private readonly processedEligibilityKeys = new Set<string>();
  private readonly activeGenerationSessions = new Set<string>();

  public hasProcessedEligibility(eligibilityKey: string): boolean {
    return this.processedEligibilityKeys.has(eligibilityKey);
  }

  public markEligibilityProcessed(eligibilityKey: string): void {
    this.processedEligibilityKeys.add(eligibilityKey);
  }

  public isGeneratingForSession(sessionId: string): boolean {
    return this.activeGenerationSessions.has(sessionId);
  }

  public setGeneratingForSession(sessionId: string, active: boolean): void {
    if (active) {
      this.activeGenerationSessions.add(sessionId);
    } else {
      this.activeGenerationSessions.delete(sessionId);
    }
  }

  public recordGenerated(params: {
    sessionId: string;
    generationId: string;
    modelName: string;
    generationDurationMs: number;
  }): StoredAdaptationRecord {
    const now = new Date().toISOString();
    const record: StoredAdaptationRecord = {
      adaptationId: randomUUID(),
      generationId: params.generationId,
      sessionId: params.sessionId,
      schemaVersion: 1,
      modelName: params.modelName,
      generationDurationMs: params.generationDurationMs,
      status: "generated",
      schema: null,
      createdAt: now,
      updatedAt: now,
    };
    this.recordsByAdaptationId.set(record.adaptationId, record);
    return record;
  }

  public markValidated(
    adaptationId: string,
    validatedSchema: GeneratedAdaptiveUISchema
  ): StoredAdaptationRecord {
    const existing = this.recordsByAdaptationId.get(adaptationId);
    if (!existing) {
      throw new Error(`Unknown adaptation record: ${adaptationId}`);
    }
    const updated: StoredAdaptationRecord = {
      ...existing,
      status: "validated",
      schema: validatedSchema,
      updatedAt: new Date().toISOString(),
    };
    this.recordsByAdaptationId.set(adaptationId, updated);
    this.latestValidatedBySession.set(existing.sessionId, adaptationId);
    return updated;
  }

  public markFailed(
    adaptationId: string,
    errorCode: string
  ): StoredAdaptationRecord | null {
    const existing = this.recordsByAdaptationId.get(adaptationId);
    if (!existing) return null;
    const updated: StoredAdaptationRecord = {
      ...existing,
      status: "failed",
      schema: null,
      errorCode,
      updatedAt: new Date().toISOString(),
    };
    this.recordsByAdaptationId.set(adaptationId, updated);
    // Do NOT overwrite latestValidatedBySession so last valid schema stays intact
    return updated;
  }

  public confirmRendered(params: {
    sessionId: string;
    adaptationId: string;
    generationId: string;
    schemaVersion: number;
  }): { ok: boolean; reason?: string; record?: StoredAdaptationRecord } {
    const existing = this.recordsByAdaptationId.get(params.adaptationId);
    if (!existing) {
      return { ok: false, reason: "ADAPTATION_NOT_FOUND" };
    }
    if (existing.sessionId !== params.sessionId) {
      return { ok: false, reason: "SESSION_OWNERSHIP_MISMATCH" };
    }
    if (existing.generationId !== params.generationId) {
      return { ok: false, reason: "GENERATION_ID_MISMATCH" };
    }
    if (existing.schemaVersion !== params.schemaVersion) {
      return { ok: false, reason: "SCHEMA_VERSION_MISMATCH" };
    }
    if (existing.status === "rendered") {
      // Idempotent duplicate confirmation
      return { ok: true, record: existing };
    }
    if (existing.status !== "validated") {
      return {
        ok: false,
        reason: `INVALID_LIFECYCLE_TRANSITION_FROM_${existing.status.toUpperCase()}`,
      };
    }

    const now = new Date().toISOString();
    const updated: StoredAdaptationRecord = {
      ...existing,
      status: "rendered",
      renderedAt: now,
      updatedAt: now,
    };
    this.recordsByAdaptationId.set(params.adaptationId, updated);
    logger.info("Confirmed adaptive UI rendered on client", {
      sessionId: params.sessionId,
      adaptationId: params.adaptationId,
      generationId: params.generationId,
    });
    return { ok: true, record: updated };
  }

  public getLatestValidatedForSession(
    sessionId: string
  ): StoredAdaptationRecord | null {
    const latestId = this.latestValidatedBySession.get(sessionId);
    if (!latestId) return null;
    const record = this.recordsByAdaptationId.get(latestId);
    if (!record || record.sessionId !== sessionId) return null;
    if (record.status !== "validated" && record.status !== "rendered") {
      return null;
    }
    return record;
  }

  public getRecordById(adaptationId: string): StoredAdaptationRecord | null {
    return this.recordsByAdaptationId.get(adaptationId) ?? null;
  }
}

export const adaptationLifecycleService = new AdaptationLifecycleService();