import { desc, eq } from "drizzle-orm";
import type {
  SessionRecord,
  FormDraftRecord,
  UpsertFormDraftInput,
  CreateFrictionEventInput,
  FrictionEventRecord,
} from "@auragen/shared";
import { getDb, DatabaseUnavailableError } from "../db/index.js";
import { sessions, formDrafts, frictionEvents, uiAdaptations } from "../db/schema.js";
export interface SaveUiAdaptationInput {
  triggerScore: number;
  uiSchema: Record<string, unknown>;
  modelName: string;
  generationTimeMs: number;
  status: "generated" | "validated" | "rendered" | "failed";
}
export interface SavedUiAdaptationRecord {
  id: string;
  sessionId: string;
  triggerScore: number;
  status: "generated" | "validated" | "rendered" | "failed";
  modelName: string | null;
  generationTimeMs: number | null;
  createdAt: string;
}

export interface PersistenceRepository {
  createSession(): Promise<SessionRecord>;
  getSessionById(sessionId: string): Promise<SessionRecord | null>;
  upsertFormDraft(
    sessionId: string,
    input: UpsertFormDraftInput
  ): Promise<FormDraftRecord | null>;
  getFormDraft(sessionId: string): Promise<FormDraftRecord | null>;
  createFrictionEvent(
    sessionId: string,
    input: CreateFrictionEventInput
  ): Promise<FrictionEventRecord | null>;
  getFrictionEvents(
    sessionId: string,
    limit: number
  ): Promise<FrictionEventRecord[] | null>;
  saveUiAdaptation?(
    sessionId: string,
    input: SaveUiAdaptationInput
  ): Promise<SavedUiAdaptationRecord | null>;
}

function wrapDbError(err: unknown): never {
  if (err instanceof DatabaseUnavailableError) {
    throw err;
  }
  const message =
    err instanceof Error ? err.message : "Database operation failed";
  throw new DatabaseUnavailableError(
    `Database operation failed: ${message}`
  );
}

export class DrizzlePersistenceRepository implements PersistenceRepository {
  async createSession(): Promise<SessionRecord> {
    try {
      const db = getDb();
      const [created] = await db.insert(sessions).values({}).returning();
      if (!created) {
        throw new Error("Failed to insert session record");
      }
      return {
        id: created.id,
        startedAt: created.startedAt.toISOString(),
        lastSeenAt: created.lastSeenAt.toISOString(),
        endedAt: created.endedAt ? created.endedAt.toISOString() : null,
      };
    } catch (err) {
      wrapDbError(err);
    }
  }

  async getSessionById(sessionId: string): Promise<SessionRecord | null> {
    try {
      const db = getDb();
      const [found] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, sessionId))
        .limit(1);

      if (!found) return null;

      return {
        id: found.id,
        startedAt: found.startedAt.toISOString(),
        lastSeenAt: found.lastSeenAt.toISOString(),
        endedAt: found.endedAt ? found.endedAt.toISOString() : null,
      };
    } catch (err) {
      wrapDbError(err);
    }
  }

  async upsertFormDraft(
    sessionId: string,
    input: UpsertFormDraftInput
  ): Promise<FormDraftRecord | null> {
    try {
      const db = getDb();
      const existingSession = await this.getSessionById(sessionId);
      if (!existingSession) {
        return null;
      }

      const now = new Date();

      const [upserted] = await db
        .insert(formDrafts)
        .values({
          sessionId,
          formData: input.formData,
          schemaVersion: input.schemaVersion,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: formDrafts.sessionId,
          set: {
            formData: input.formData,
            schemaVersion: input.schemaVersion,
            updatedAt: now,
          },
        })
        .returning();

      await db
        .update(sessions)
        .set({ lastSeenAt: now })
        .where(eq(sessions.id, sessionId));

      if (!upserted) {
        throw new Error("Failed to upsert form draft");
      }

      return {
        id: upserted.id,
        sessionId: upserted.sessionId,
        formData: upserted.formData ?? {},
        schemaVersion: upserted.schemaVersion,
        updatedAt: upserted.updatedAt.toISOString(),
      };
    } catch (err) {
      wrapDbError(err);
    }
  }

  async getFormDraft(sessionId: string): Promise<FormDraftRecord | null> {
    try {
      const db = getDb();
      const [draft] = await db
        .select()
        .from(formDrafts)
        .where(eq(formDrafts.sessionId, sessionId))
        .limit(1);

      if (!draft) return null;

      return {
        id: draft.id,
        sessionId: draft.sessionId,
        formData: draft.formData ?? {},
        schemaVersion: draft.schemaVersion,
        updatedAt: draft.updatedAt.toISOString(),
      };
    } catch (err) {
      wrapDbError(err);
    }
  }

  async createFrictionEvent(
    sessionId: string,
    input: CreateFrictionEventInput
  ): Promise<FrictionEventRecord | null> {
    try {
      const db = getDb();
      const existingSession = await this.getSessionById(sessionId);
      if (!existingSession) {
        return null;
      }

      const now = new Date();

      const [inserted] = await db
        .insert(frictionEvents)
        .values({
          sessionId,
          frictionScore: input.frictionScore,
          frictionLevel: input.frictionLevel,
          signals: input.signals,
          createdAt: now,
        })
        .returning();

      await db
        .update(sessions)
        .set({ lastSeenAt: now })
        .where(eq(sessions.id, sessionId));

      if (!inserted) {
        throw new Error("Failed to insert friction event");
      }

      return {
        id: Number(inserted.id),
        sessionId: inserted.sessionId,
        frictionScore: inserted.frictionScore,
        frictionLevel: inserted.frictionLevel,
        signals: inserted.signals,
        createdAt: inserted.createdAt.toISOString(),
      };
    } catch (err) {
      wrapDbError(err);
    }
  }

  async getFrictionEvents(
    sessionId: string,
    limit: number
  ): Promise<FrictionEventRecord[] | null> {
    try {
      const db = getDb();
      const existingSession = await this.getSessionById(sessionId);
      if (!existingSession) {
        return null;
      }

      const safeLimit = Math.min(Math.max(1, limit), 50);

      const rows = await db
        .select()
        .from(frictionEvents)
        .where(eq(frictionEvents.sessionId, sessionId))
        .orderBy(desc(frictionEvents.createdAt), desc(frictionEvents.id))
        .limit(safeLimit);

      return rows.map((r) => ({
        id: Number(r.id),
        sessionId: r.sessionId,
        frictionScore: r.frictionScore,
        frictionLevel: r.frictionLevel,
        signals: r.signals,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch (err) {
      wrapDbError(err);
    }
  }

  async saveUiAdaptation(
    sessionId: string,
    input: SaveUiAdaptationInput
  ): Promise<SavedUiAdaptationRecord | null> {
    try {
      const db = getDb();
      const existingSession = await this.getSessionById(sessionId);
      if (!existingSession) {
        return null;
      }

      const now = new Date();
      const [inserted] = await db
        .insert(uiAdaptations)
        .values({
          sessionId,
          triggerScore: Math.round(input.triggerScore),
          uiSchema: input.uiSchema,
          modelName: input.modelName,
          generationTimeMs: Math.round(input.generationTimeMs),
          status: input.status,
          createdAt: now,
        })
        .returning();

      if (!inserted) {
        throw new Error("Failed to insert ui_adaptations record");
      }

      return {
        id: inserted.id,
        sessionId: inserted.sessionId,
        triggerScore: inserted.triggerScore,
        status: inserted.status,
        modelName: inserted.modelName,
        generationTimeMs: inserted.generationTimeMs,
        createdAt: inserted.createdAt.toISOString(),
      };
    } catch (err) {
      wrapDbError(err);
    }
  }
}