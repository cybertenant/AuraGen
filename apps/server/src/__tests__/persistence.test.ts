import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { randomUUID } from "crypto";
import { createApp } from "../app.js";
import { PersistenceRepository } from "../repositories/persistence.repository.js";
import { DatabaseUnavailableError } from "../db/index.js";
import type {
  SessionRecord,
  FormDraftRecord,
  UpsertFormDraftInput,
  CreateFrictionEventInput,
  FrictionEventRecord,
} from "@auragen/shared";

/**
 * In-memory relational reference implementation of PersistenceRepository
 * verifying all Drizzle repository contracts, unique draft upsert rules,
 * foreign-key session checks, and descending history pagination.
 */
class InMemoryPersistenceRepository implements PersistenceRepository {
  public disconnected = false;
  private sessions = new Map<string, SessionRecord>();
  private draftsBySession = new Map<string, FormDraftRecord>();
  private eventsBySession = new Map<string, FrictionEventRecord[]>();
  private eventSeq = 1;

  private ensureConnected() {
    if (this.disconnected) {
      throw new DatabaseUnavailableError(
        "Simulated Neon PostgreSQL connection loss"
      );
    }
  }

  async createSession(): Promise<SessionRecord> {
    this.ensureConnected();
    const now = new Date().toISOString();
    const session: SessionRecord = {
      id: randomUUID(),
      startedAt: now,
      lastSeenAt: now,
      endedAt: null,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async getSessionById(sessionId: string): Promise<SessionRecord | null> {
    this.ensureConnected();
    return this.sessions.get(sessionId) ?? null;
  }

  async upsertFormDraft(
    sessionId: string,
    input: UpsertFormDraftInput
  ): Promise<FormDraftRecord | null> {
    this.ensureConnected();
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = new Date().toISOString();
    const existing = this.draftsBySession.get(sessionId);

    const record: FormDraftRecord = {
      id: existing ? existing.id : randomUUID(),
      sessionId,
      formData: input.formData,
      schemaVersion: input.schemaVersion,
      updatedAt: now,
    };

    this.draftsBySession.set(sessionId, record);
    session.lastSeenAt = now;
    return record;
  }

  async getFormDraft(sessionId: string): Promise<FormDraftRecord | null> {
    this.ensureConnected();
    return this.draftsBySession.get(sessionId) ?? null;
  }

  async createFrictionEvent(
    sessionId: string,
    input: CreateFrictionEventInput
  ): Promise<FrictionEventRecord | null> {
    this.ensureConnected();
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = new Date().toISOString();
    const record: FrictionEventRecord = {
      id: this.eventSeq++,
      sessionId,
      frictionScore: input.frictionScore,
      frictionLevel: input.frictionLevel,
      signals: input.signals,
      createdAt: now,
    };

    const list = this.eventsBySession.get(sessionId) ?? [];
    list.push(record);
    this.eventsBySession.set(sessionId, list);
    session.lastSeenAt = now;
    return record;
  }

  async getFrictionEvents(
    sessionId: string,
    limit: number
  ): Promise<FrictionEventRecord[] | null> {
    this.ensureConnected();
    if (!this.sessions.has(sessionId)) return null;
    const list = this.eventsBySession.get(sessionId) ?? [];
    return [...list].reverse().slice(0, Math.min(limit, 50));
  }
}

describe("Day 2 Persistence API Suite (/api/sessions)", () => {
  let repo: InMemoryPersistenceRepository;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    repo = new InMemoryPersistenceRepository();
    app = createApp({ persistenceRepository: repo });
  });

  it("Scenario 2: creates a new session with backend-generated UUID", async () => {
    const res = await request(app).post("/api/sessions");
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("ok");
    expect(res.body.session.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );

    const getRes = await request(app).get(
      `/api/sessions/${res.body.session.id}`
    );
    expect(getRes.status).toBe(200);
    expect(getRes.body.session.id).toBe(res.body.session.id);
  });

  it("Scenarios 3, 4 & 6: inserts a form draft, updates (upserts) without duplicating, and retrieves it", async () => {
    const sessionRes = await request(app).post("/api/sessions");
    const sessionId = sessionRes.body.session.id;

    // Insert initial draft
    const put1 = await request(app)
      .put(`/api/sessions/${sessionId}/draft`)
      .send({
        formData: {
          entityName: "Acme Sovereign Holdings Demo",
          requestedCreditUsd: 500000,
          debtServiceCoverageRatio: "1.35",
        },
        schemaVersion: 1,
      });

    expect(put1.status).toBe(200);
    const firstDraftId = put1.body.draft.id;
    expect(put1.body.draft.formData.entityName).toBe(
      "Acme Sovereign Holdings Demo"
    );

    // Update existing draft (upsert must preserve the single draft record per session)
    const put2 = await request(app)
      .put(`/api/sessions/${sessionId}/draft`)
      .send({
        formData: {
          entityName: "Acme Sovereign Holdings Demo",
          requestedCreditUsd: 750000,
          debtServiceCoverageRatio: "1.60",
        },
        schemaVersion: 2,
      });

    expect(put2.status).toBe(200);
    expect(put2.body.draft.id).toBe(firstDraftId);
    expect(put2.body.draft.schemaVersion).toBe(2);

    // Retrieve saved draft
    const getDraft = await request(app).get(
      `/api/sessions/${sessionId}/draft`
    );
    expect(getDraft.status).toBe(200);
    expect(getDraft.body.draft.id).toBe(firstDraftId);
    expect(getDraft.body.draft.formData.requestedCreditUsd).toBe(750000);
  });

  it("Scenarios 7 & 11: stores valid aggregated friction events and retrieves history sorted newest first", async () => {
    const sessionRes = await request(app).post("/api/sessions");
    const sessionId = sessionRes.body.session.id;

    const event1 = await request(app)
      .post(`/api/sessions/${sessionId}/friction-events`)
      .send({
        frictionScore: 32,
        frictionLevel: "low",
        signals: {
          hesitation_count: 1,
          validation_errors: 0,
          repeated_clicks: 1,
          backtracking: 0,
          cursor_anomaly_score: 14,
          observation_window_seconds: 10,
        },
      });
    expect(event1.status).toBe(201);

    const event2 = await request(app)
      .post(`/api/sessions/${sessionId}/friction-events`)
      .send({
        frictionScore: 84,
        frictionLevel: "high",
        signals: {
          hesitation_count: 5,
          validation_errors: 3,
          repeated_clicks: 6,
          backtracking: 3,
          cursor_anomaly_score: 79,
          observation_window_seconds: 10,
        },
      });
    expect(event2.status).toBe(201);

    const historyRes = await request(app).get(
      `/api/sessions/${sessionId}/friction-events?limit=10`
    );
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.count).toBe(2);
    // Newest event (score 84) must be first
    expect(historyRes.body.events[0].frictionScore).toBe(84);
    expect(historyRes.body.events[1].frictionScore).toBe(32);
  });

  it("Scenario 8: rejects invalid friction scores (>100 or <0)", async () => {
    const sessionRes = await request(app).post("/api/sessions");
    const sessionId = sessionRes.body.session.id;

    const badScoreRes = await request(app)
      .post(`/api/sessions/${sessionId}/friction-events`)
      .send({
        frictionScore: 155,
        frictionLevel: "high",
        signals: {
          hesitation_count: 2,
          validation_errors: 1,
          repeated_clicks: 0,
          backtracking: 0,
          cursor_anomaly_score: 20,
          observation_window_seconds: 10,
        },
      });

    expect(badScoreRes.status).toBe(400);
    expect(badScoreRes.body.status).toBe("error");
  });

  it("Scenario 9: rejects invalid (non-UUID) session IDs with 400", async () => {
    const res = await request(app).get("/api/sessions/not-a-valid-uuid/draft");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid session ID");
  });

  it("Scenario 10: returns 404 for unknown sessions", async () => {
    const unknownId = randomUUID();

    const sessionRes = await request(app).get(`/api/sessions/${unknownId}`);
    expect(sessionRes.status).toBe(404);

    const draftPutRes = await request(app)
      .put(`/api/sessions/${unknownId}/draft`)
      .send({ formData: { company: "Ghost LLC" }, schemaVersion: 1 });
    expect(draftPutRes.status).toBe(404);

    const frictionPostRes = await request(app)
      .post(`/api/sessions/${unknownId}/friction-events`)
      .send({
        frictionScore: 50,
        frictionLevel: "medium",
        signals: {
          hesitation_count: 2,
          validation_errors: 1,
          repeated_clicks: 1,
          backtracking: 1,
          cursor_anomaly_score: 40,
          observation_window_seconds: 10,
        },
      });
    expect(frictionPostRes.status).toBe(404);
  });

  it("Scenario 12: returns graceful 503 error when database connection is unavailable", async () => {
    repo.disconnected = true;

    const res = await request(app).post("/api/sessions");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("error");
    expect(res.body.message).toContain("Neon PostgreSQL");
  });
});