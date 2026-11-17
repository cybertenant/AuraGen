import { randomUUID } from "crypto";
import { eq, desc } from "drizzle-orm";
import {
  SessionRecord,
  FormDraftRecord,
  FrictionEventRecord,
  UpsertFormDraftInput,
  UpsertFormDraftInputSchema,
  CreateFrictionEventInput,
  CreateFrictionEventInputSchema,
  AggregatedSignalsSchema,
} from "@auragen/shared";
import { getDb } from "../db/index.js";
import { sessions, formDrafts, frictionEvents } from "../db/schema.js";
import { logger } from "../utils/logger.js";

export interface IPersistenceRepository {
  createSession(id: string): Promise<SessionRecord>;
  getSessionById(id: string): Promise<SessionRecord | null>;
  touchSession(id: string): Promise<void>;
  upsertFormDraft(
    sessionId: string,
    input: UpsertFormDraftInput
  ): Promise<FormDraftRecord>;
  getFormDraftBySessionId(sessionId: string): Promise<FormDraftRecord | null>;
  insertFrictionEvent(
    sessionId: string,
    input: CreateFrictionEventInput
  ): Promise<FrictionEventRecord>;
  getFrictionEventsBySessionId(
    sessionId: string,
    limit: number
  ): Promise<FrictionEventRecord[]>;
}

export class DrizzlePersistenceRepository implements IPersistenceRepository {
  async createSession(id: string): Promise<SessionRecord> {
    const db = getDb();
    const [inserted] = await db
      .insert(sessions)
      .values({ id })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert session record");
    }

    return {
      id: inserted.id,
      startedAt: inserted.startedAt.toISOString(),
      lastSeenAt: inserted.lastSeenAt.toISOString(),
      endedAt: inserted.endedAt ? inserted.endedAt.toISOString() : null,
    };
  }

  async getSessionById(id: string): Promise<SessionRecord | null> {
    const db = getDb();
    const [found] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!found) return null;

    return {
      id: found.id,
      startedAt: found.startedAt.toISOString(),
      lastSeenAt: found.lastSeenAt.toISOString(),
      endedAt: found.endedAt ? found.endedAt.toISOString() : null,
    };
  }

  async touchSession(id: string): Promise<void> {
    const db = getDb();
    await db
      .update(sessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(sessions.id, id));
  }

  async upsertFormDraft(
    sessionId: string,
    input: UpsertFormDraftInput
  ): Promise<FormDraftRecord> {
    const db = getDb();
    const now = new Date();

    const [existing] = await db
      .select()
      .from(formDrafts)
      .where(eq(formDrafts.sessionId, sessionId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(formDrafts)
        .set({
          formData: input.formData,
          schemaVersion: input.schemaVersion,
          updatedAt: now,
        })
        .where(eq(formDrafts.sessionId, sessionId))
        .returning();

      if (!updated) throw new Error("Failed to update form draft");

      return {
        id: updated.id,
        sessionId: updated.sessionId,
        formData: updated.formData as Record<string, unknown>,
        schemaVersion: updated.schemaVersion,
        updatedAt: updated.updatedAt.toISOString(),
      };
    }

    const [inserted] = await db
      .insert(formDrafts)
      .values({
        id: randomUUID(),
        sessionId,
        formData: input.formData,
        schemaVersion: input.schemaVersion,
        updatedAt: now,
      })
      .returning();

    if (!inserted) throw new Error("Failed to insert form draft");

    return {
      id: inserted.id,
      sessionId: inserted.sessionId,
      formData: inserted.formData as Record<string, unknown>,
      schemaVersion: inserted.schemaVersion,
      updatedAt: inserted.updatedAt.toISOString(),
    };
  }

  async getFormDraftBySessionId(
    sessionId: string
  ): Promise<FormDraftRecord | null> {
    const db = getDb();
    const [found] = await db
      .select()
      .from(formDrafts)
      .where(eq(formDrafts.sessionId, sessionId))
      .limit(1);

    if (!found) return null;

    return {
      id: found.id,
      sessionId: found.sessionId,
      formData: found.formData as Record<string, unknown>,
      schemaVersion: found.schemaVersion,
      updatedAt: found.updatedAt.toISOString(),
    };
  }

  async insertFrictionEvent(
    sessionId: string,
    input: CreateFrictionEventInput
  ): Promise<FrictionEventRecord> {
    const db = getDb();
    const [inserted] = await db
      .insert(frictionEvents)
      .values({
        sessionId,
        frictionScore: input.frictionScore,
        frictionLevel: input.frictionLevel,
        signals: input.signals,
      })
      .returning();

    if (!inserted) {
      throw new Error("Failed to insert friction event");
    }

    return {
      id: inserted.id,
      sessionId: inserted.sessionId,
      frictionScore: inserted.frictionScore,
      frictionLevel: inserted.frictionLevel as FrictionEventRecord["frictionLevel"],
      signals: AggregatedSignalsSchema.parse(inserted.signals),
      createdAt: inserted.createdAt.toISOString(),
    };
  }

  async getFrictionEventsBySessionId(
    sessionId: string,
    limit: number
  ): Promise<FrictionEventRecord[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(frictionEvents)
      .where(eq(frictionEvents.sessionId, sessionId))
      .orderBy(desc(frictionEvents.createdAt))
      .limit(limit);

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.sessionId,
      frictionScore: r.frictionScore,
      frictionLevel: r.frictionLevel as FrictionEventRecord["frictionLevel"],
      signals: AggregatedSignalsSchema.parse(r.signals),
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export class PersistenceService {
  private readonly repo: IPersistenceRepository;

  constructor(repo: IPersistenceRepository = new DrizzlePersistenceRepository()) {
    this.repo = repo;
  }

  async createSession(): Promise<SessionRecord> {
    const id = randomUUID();
    const created = await this.repo.createSession(id);
    logger.info("Created new AuraGen session", { sessionId: created.id });
    return created;
  }

  async getSessionById(sessionId: string): Promise<SessionRecord | null> {
    return this.repo.getSessionById(sessionId);
  }

  async upsertDraft(
    sessionId: string,
    rawInput: unknown
  ): Promise<FormDraftRecord> {
    const parsed = UpsertFormDraftInputSchema.parse(rawInput);
    await this.repo.touchSession(sessionId);
    const saved = await this.repo.upsertFormDraft(sessionId, parsed);
    logger.info("Upserted form draft metadata", {
      sessionId,
      draftId: saved.id,
      schemaVersion: saved.schemaVersion,
    });
    return saved;
  }

  async getDraft(sessionId: string): Promise<FormDraftRecord | null> {
    return this.repo.getFormDraftBySessionId(sessionId);
  }

  async recordFrictionEvent(
    sessionId: string,
    rawInput: unknown
  ): Promise<FrictionEventRecord> {
    const parsed = CreateFrictionEventInputSchema.parse(rawInput);
    await this.repo.touchSession(sessionId);
    const event = await this.repo.insertFrictionEvent(sessionId, parsed);
    logger.info("Stored aggregated cognitive friction event", {
      sessionId,
      eventId: event.id,
      frictionScore: event.frictionScore,
      frictionLevel: event.frictionLevel,
    });
    return event;
  }

  async listFrictionEvents(
    sessionId: string,
    limit = 20
  ): Promise<FrictionEventRecord[]> {
    const boundedLimit = Math.min(100, Math.max(1, limit));
    return this.repo.getFrictionEventsBySessionId(sessionId, boundedLimit);
  }
}