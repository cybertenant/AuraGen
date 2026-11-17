import http from "http";
import { AddressInfo } from "net";
import { io as createClient, Socket as ClientSocket } from "socket.io-client";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SessionRecord,
  FormDraftRecord,
  FrictionEventRecord,
  CreateFrictionEventInput,
  UpsertFormDraftInput,
  SessionJoinAck,
  TelemetryAckPayload,
  FrictionUpdatePayload,
  ServerErrorPayload,
} from "@auragen/shared";
import { createSocketServer } from "../socket/index.js";
import {
  IPersistenceRepository,
  PersistenceService,
} from "../services/persistence.service.js";
import { DatabaseUnavailableError } from "../db/index.js";

class InMemorySocketTestRepo implements IPersistenceRepository {
  public sessions = new Map<string, SessionRecord>();
  public drafts = new Map<string, FormDraftRecord>();
  public frictionEvents: FrictionEventRecord[] = [];
  public simulateOutage = false;

  private checkOutage() {
    if (this.simulateOutage) {
      throw new DatabaseUnavailableError("Simulated Neon database outage");
    }
  }

  async createSession(id: string): Promise<SessionRecord> {
    this.checkOutage();
    const now = new Date().toISOString();
    const rec: SessionRecord = {
      id,
      startedAt: now,
      lastSeenAt: now,
      endedAt: null,
    };
    this.sessions.set(id, rec);
    return rec;
  }

  async getSessionById(id: string): Promise<SessionRecord | null> {
    this.checkOutage();
    return this.sessions.get(id) ?? null;
  }

  async touchSession(id: string): Promise<void> {
    this.checkOutage();
    const existing = this.sessions.get(id);
    if (existing) {
      existing.lastSeenAt = new Date().toISOString();
    }
  }

  async upsertFormDraft(
    sessionId: string,
    input: UpsertFormDraftInput
  ): Promise<FormDraftRecord> {
    this.checkOutage();
    const rec: FormDraftRecord = {
      id: "660e8400-e29b-41d4-a716-446655440000",
      sessionId,
      formData: input.formData,
      schemaVersion: input.schemaVersion,
      updatedAt: new Date().toISOString(),
    };
    this.drafts.set(sessionId, rec);
    return rec;
  }

  async getFormDraftBySessionId(
    sessionId: string
  ): Promise<FormDraftRecord | null> {
    this.checkOutage();
    return this.drafts.get(sessionId) ?? null;
  }

  async insertFrictionEvent(
    sessionId: string,
    input: CreateFrictionEventInput
  ): Promise<FrictionEventRecord> {
    this.checkOutage();
    const rec: FrictionEventRecord = {
      id: this.frictionEvents.length + 1,
      sessionId,
      frictionScore: input.frictionScore,
      frictionLevel: input.frictionLevel,
      signals: input.signals,
      createdAt: new Date().toISOString(),
    };
    this.frictionEvents.push(rec);
    return rec;
  }

  async getFrictionEventsBySessionId(
    sessionId: string,
    limit: number
  ): Promise<FrictionEventRecord[]> {
    this.checkOutage();
    return this.frictionEvents
      .filter((e) => e.sessionId === sessionId)
      .slice(0, limit);
  }
}

type TypedClientSocket = ClientSocket<
  ServerToClientEvents,
  ClientToServerEvents
>;

describe("Day 5: Real-Time Socket.IO Server & Authoritative Friction Engine Suite", () => {
  let httpServer: http.Server;
  let serverUrl: string;
  let repo: InMemorySocketTestRepo;
  let service: PersistenceService;
  let activeClients: TypedClientSocket[] = [];

  beforeEach(async () => {
    repo = new InMemorySocketTestRepo();
    service = new PersistenceService(repo);
    httpServer = http.createServer();

    createSocketServer(httpServer, {
      corsOrigin: "*",
      persistenceService: service,
      persistIntervalMs: 5000,
      rateLimitConfig: {
        minIntervalMs: 40,
        maxEventsPerWindow: 8,
        windowMs: 5000,
      },
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, "127.0.0.1", () => resolve());
    });

    const port = (httpServer.address() as AddressInfo).port;
    serverUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const c of activeClients) {
      c.disconnect();
    }
    activeClients = [];
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connectClient(): Promise<TypedClientSocket> {
    return new Promise((resolve, reject) => {
      const client: TypedClientSocket = createClient(serverUrl, {
        transports: ["websocket"],
        reconnection: true,
        reconnectionDelay: 50,
      });
      activeClients.push(client);
      client.on("connect", () => resolve(client));
      client.on("connect_error", (err) => reject(err));
    });
  }

  it("Scenarios 1 & 2: connects via Socket.IO and joins an existing Neon session room", async () => {
    const session = await service.createSession();
    const client = await connectClient();
    expect(client.connected).toBe(true);

    const readyPromise = new Promise<{ sessionId: string; room: string }>(
      (resolve) => {
        client.once("session:ready", (payload) => resolve(payload));
      }
    );

    const joinAck = await new Promise<SessionJoinAck>((resolve) => {
      client.emit("session:join", { sessionId: session.id }, (ack) =>
        resolve(ack)
      );
    });

    const readyEvent = await readyPromise;
    expect(joinAck.ok).toBe(true);
    expect(joinAck.sessionId).toBe(session.id);
    expect(readyEvent.room).toBe(`session:${session.id}`);
  });

  it("Scenarios 3 & 4: rejects unknown session UUIDs and malformed UUID strings", async () => {
    const client = await connectClient();

    // Scenario 4: Malformed UUID
    const malformedAck = await new Promise<SessionJoinAck>((resolve) => {
      client.emit("session:join", { sessionId: "not-a-valid-uuid" }, (ack) =>
        resolve(ack)
      );
    });
    expect(malformedAck.ok).toBe(false);
    expect(malformedAck.errorCode).toBe("INVALID_SESSION_UUID");

    // Scenario 3: Unknown UUID not in database
    const unknownAck = await new Promise<SessionJoinAck>((resolve) => {
      client.emit(
        "session:join",
        { sessionId: "550e8400-e29b-41d4-a716-446655440000" },
        (ack) => resolve(ack)
      );
    });
    expect(unknownAck.ok).toBe(false);
    expect(unknownAck.errorCode).toBe("SESSION_NOT_FOUND");
  });

  it("Scenarios 5, 6, 7 & 15: processes valid telemetry:batch, returns authoritative friction:update, and rejects invalid/PII payloads", async () => {
    const session = await service.createSession();
    const client = await connectClient();

    await new Promise<SessionJoinAck>((resolve) => {
      client.emit("session:join", { sessionId: session.id }, (ack) =>
        resolve(ack)
      );
    });

    // Scenario 6 & 15: Reject payload containing financial form values or raw mouse coordinates
    const invalidResponse = await new Promise<
      TelemetryAckPayload | ServerErrorPayload
    >((resolve) => {
      client.emit(
        "telemetry:batch",
        {
          observationWindowSeconds: 30,
          fieldFocusCount: 2,
          hesitationCount: 1,
          validationErrors: 1,
          repeatedClicks: 0,
          backtracks: 0,
          cursorAnomalyScore: 0.2,
          annualIncome: 250000, // Forbidden financial field!
        },
        (res) => resolve(res)
      );
    });
    expect("code" in invalidResponse && invalidResponse.code).toBe(
      "INVALID_TELEMETRY_PAYLOAD"
    );

    // Scenarios 5 & 7: Send valid telemetry batch and receive authoritative friction:update
    const frictionUpdatePromise = new Promise<FrictionUpdatePayload>(
      (resolve) => {
        client.once("friction:update", (update) => resolve(update));
      }
    );

    const validAck = await new Promise<
      TelemetryAckPayload | ServerErrorPayload
    >((resolve) => {
      client.emit(
        "telemetry:batch",
        {
          observationWindowSeconds: 30,
          fieldFocusCount: 6,
          hesitationCount: 3, // H = 1.0 -> 25
          validationErrors: 3, // E = 1.0 -> 30
          repeatedClicks: 2, // R = 0.5 -> 10
          backtracks: 1, // B = 0.3333 -> 5
          cursorAnomalyScore: 0.5, // M = 0.5 -> 5 => Total Raw = 75.0
        },
        (res) => resolve(res)
      );
    });

    expect("status" in validAck && validAck.status).toBe("processed");
    const frictionUpdate = await frictionUpdatePromise;
    expect(frictionUpdate.sessionId).toBe(session.id);
    expect(frictionUpdate.rawScore).toBeCloseTo(75, 1);
    // First reading initializes smoothedScore directly from rawScore
    expect(frictionUpdate.smoothedScore).toBeCloseTo(75, 1);
    expect(frictionUpdate.level).toBe("high");
    expect(repo.frictionEvents.length).toBe(1);
  });

  it("Scenario 9: keeps multiple sessions strictly isolated in separate rooms and state contexts", async () => {
    const sessionA = await service.createSession();
    const sessionB = await service.createSession();

    const clientA = await connectClient();
    const clientB = await connectClient();

    await new Promise<SessionJoinAck>((r) =>
      clientA.emit("session:join", { sessionId: sessionA.id }, r)
    );
    await new Promise<SessionJoinAck>((r) =>
      clientB.emit("session:join", { sessionId: sessionB.id }, r)
    );

    const updatesReceivedByB: FrictionUpdatePayload[] = [];
    clientB.on("friction:update", (u) => updatesReceivedByB.push(u));

    // Client A sends high friction telemetry
    const updateAPromise = new Promise<FrictionUpdatePayload>((r) =>
      clientA.once("friction:update", r)
    );
    clientA.emit("telemetry:batch", {
      observationWindowSeconds: 30,
      fieldFocusCount: 5,
      hesitationCount: 3,
      validationErrors: 3,
      repeatedClicks: 4,
      backtracks: 3,
      cursorAnomalyScore: 1,
    });

    const updateA = await updateAPromise;
    expect(updateA.sessionId).toBe(sessionA.id);
    expect(updateA.rawScore).toBe(100);

    // Client B must NOT receive Client A's room broadcast
    expect(updatesReceivedByB.length).toBe(0);
  });

  it("Scenario 10: deduplicates identical rapid telemetry batches and enforces rate limiting", async () => {
    const session = await service.createSession();
    const client = await connectClient();
    await new Promise<SessionJoinAck>((r) =>
      client.emit("session:join", { sessionId: session.id }, r)
    );

    const payload = {
      observationWindowSeconds: 30,
      fieldFocusCount: 2,
      hesitationCount: 1,
      validationErrors: 0,
      repeatedClicks: 0,
      backtracks: 0,
      cursorAnomalyScore: 0.1,
    };

    const firstAck = await new Promise<
      TelemetryAckPayload | ServerErrorPayload
    >((r) => client.emit("telemetry:batch", payload, r));
    expect("status" in firstAck && firstAck.status).toBe("processed");

    // Wait 50ms (> minIntervalMs 40ms, < 800ms dedup window) and send identical payload -> deduplicated
    await new Promise((r) => setTimeout(r, 50));
    const dupAck = await new Promise<TelemetryAckPayload | ServerErrorPayload>(
      (r) => client.emit("telemetry:batch", payload, r)
    );
    expect("status" in dupAck && dupAck.status).toBe("deduplicated");

    // Send rapid burst (< 40ms apart) -> rate limit exceeded
    const burst1Promise = new Promise<TelemetryAckPayload | ServerErrorPayload>(
      (r) =>
        client.emit(
          "telemetry:batch",
          { ...payload, fieldFocusCount: 3 },
          r
        )
    );
    const burst2Promise = new Promise<TelemetryAckPayload | ServerErrorPayload>(
      (r) =>
        client.emit(
          "telemetry:batch",
          { ...payload, fieldFocusCount: 4 },
          r
        )
    );

    const [, burst2Res] = await Promise.all([burst1Promise, burst2Promise]);
    expect("code" in burst2Res && burst2Res.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  it("Scenarios 11 & 12: survives database outages without crashing and supports socket reconnection", async () => {
    const session = await service.createSession();
    const client = await connectClient();

    await new Promise<SessionJoinAck>((r) =>
      client.emit("session:join", { sessionId: session.id }, r)
    );

    // Scenario 12: Simulate Neon PostgreSQL outage during telemetry batch processing
    repo.simulateOutage = true;

    const outageAck = await new Promise<
      TelemetryAckPayload | ServerErrorPayload
    >((r) =>
      client.emit(
        "telemetry:batch",
        {
          observationWindowSeconds: 30,
          fieldFocusCount: 4,
          hesitationCount: 2,
          validationErrors: 2,
          repeatedClicks: 1,
          backtracks: 1,
          cursorAnomalyScore: 0.3,
        },
        r
      )
    );

    // Server still calculates authoritative score and responds with databaseAvailable: false
    expect("status" in outageAck && outageAck.status).toBe("processed");
    if ("status" in outageAck) {
      expect(outageAck.persistedToDatabase).toBe(false);
      expect(outageAck.databaseAvailable).toBe(false);
    }

    // Scenario 11: Disconnect and reconnect client
    repo.simulateOutage = false;
    client.disconnect();
    expect(client.connected).toBe(false);

    await new Promise<void>((resolve) => {
      client.once("connect", () => resolve());
      client.connect();
    });
    expect(client.connected).toBe(true);
  });
});