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
  FrictionStatePayload,
  AdaptationEligiblePayload,
  AdaptationDeferredPayload,
  FrictionRecoveredPayload,
} from "@auragen/shared";
import {
  createInitialAdaptiveSessionState,
  evaluateAdaptiveStateTransition,
} from "../adaptive/adaptive-state-machine.js";
import { DEFAULT_ADAPTIVE_CONFIG } from "../adaptive/adaptive.config.js";
import { Clock } from "../adaptive/adaptive.types.js";
import { createSocketServer } from "../socket/index.js";
import {
  IPersistenceRepository,
  PersistenceService,
} from "../services/persistence.service.js";
import { DatabaseUnavailableError } from "../db/index.js";

class ControllableClock implements Clock {
  private currentMs: number;
  constructor(initialMs = 1_700_000_000_000) {
    this.currentMs = initialMs;
  }
  now(): number {
    return this.currentMs;
  }
  advance(ms: number): number {
    this.currentMs += ms;
    return this.currentMs;
  }
}

class InMemoryAdaptiveRepo implements IPersistenceRepository {
  public sessions = new Map<string, SessionRecord>();
  public frictionEvents: FrictionEventRecord[] = [];
  public simulateOutage = false;

  private checkOutage() {
    if (this.simulateOutage) {
      throw new DatabaseUnavailableError("Simulated Neon DB outage");
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

  async touchSession(): Promise<void> {
    this.checkOutage();
  }

  async upsertFormDraft(
    sessionId: string,
    input: UpsertFormDraftInput
  ): Promise<FormDraftRecord> {
    this.checkOutage();
    return {
      id: "660e8400-e29b-41d4-a716-446655440000",
      sessionId,
      formData: input.formData,
      schemaVersion: input.schemaVersion,
      updatedAt: new Date().toISOString(),
    };
  }

  async getFormDraftBySessionId(): Promise<FormDraftRecord | null> {
    this.checkOutage();
    return null;
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

describe("Day 6: Adaptive Friction Threshold State Machine (12 Core Unit Tests)", () => {
  const sessionId = "550e8400-e29b-41d4-a716-446655440101";

  it("1. Initial session enters MONITORING", () => {
    const initial = createInitialAdaptiveSessionState(sessionId);
    expect(initial.state).toBe("MONITORING");
    expect(initial.episodeTriggered).toBe(false);
    expect(initial.candidateStartedAtMs).toBeNull();
  });

  it("2. Score 40 stays MONITORING", () => {
    const initial = createInitialAdaptiveSessionState(sessionId);
    const out = evaluateAdaptiveStateTransition(initial, 40, 1000);
    expect(out.sessionState.state).toBe("MONITORING");
    expect(out.emittedEvents).toEqual([]);
  });

  it("3. Score 65 starts a HIGH_FRICTION_CANDIDATE", () => {
    const initial = createInitialAdaptiveSessionState(sessionId);
    const out = evaluateAdaptiveStateTransition(initial, 65, 1000);
    expect(out.sessionState.state).toBe("HIGH_FRICTION_CANDIDATE");
    expect(out.sessionState.candidateStartedAtMs).toBe(1000);
    expect(out.emittedEvents).toContain("candidate_started");
  });

  it("4. Score 80 for less than 5 seconds does NOT trigger adaptation", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 80, 1000).sessionState;
    const out = evaluateAdaptiveStateTransition(st, 80, 5999); // 4999ms < 5000ms
    expect(out.sessionState.state).toBe("HIGH_FRICTION_CANDIDATE");
    expect(out.emittedEvents).not.toContain("adaptation_eligible");
    expect(out.sessionState.episodeTriggered).toBe(false);
  });

  it("5. Score 80 sustained for 5 seconds triggers adaptation eligibility", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 80, 1000).sessionState;
    const out = evaluateAdaptiveStateTransition(st, 80, 6000); // 5000ms exact
    expect(out.emittedEvents).toContain("adaptation_eligible");
    expect(out.sessionState.episodeTriggered).toBe(true);
    expect(out.sessionState.state).toBe("COOLDOWN");
  });

  it("6. Eligibility event fires exactly once for the current friction episode", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 80, 1000).sessionState;
    const firstTrigger = evaluateAdaptiveStateTransition(st, 82, 6000);
    expect(firstTrigger.emittedEvents).toContain("adaptation_eligible");

    // Subsequent high readings while continuously frustrated must NOT emit adaptation_eligible again
    const secondTick = evaluateAdaptiveStateTransition(
      firstTrigger.sessionState,
      85,
      9000
    );
    expect(secondTick.emittedEvents).not.toContain("adaptation_eligible");
    expect(secondTick.emittedEvents).toContain("adaptation_deferred");
  });

  it("7. Score below 55 triggers RECOVERED and resets episode", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 80, 1000).sessionState;
    const rec = evaluateAdaptiveStateTransition(st, 54, 3000);
    expect(rec.sessionState.state).toBe("RECOVERED");
    expect(rec.sessionState.candidateStartedAtMs).toBeNull();
    expect(rec.sessionState.episodeTriggered).toBe(false);
    expect(rec.emittedEvents).toContain("friction_recovered");
  });

  it("8. Hysteresis: Scores between 55 and 64 do NOT prematurely reset an active candidate", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 72, 1000).sessionState;
    expect(st.state).toBe("HIGH_FRICTION_CANDIDATE");

    // Score dips to 58 (between 55 and 64): candidate remains active
    const sticky = evaluateAdaptiveStateTransition(st, 58, 3500);
    expect(sticky.sessionState.state).toBe("HIGH_FRICTION_CANDIDATE");
    expect(sticky.sessionState.candidateStartedAtMs).toBe(1000);
    expect(sticky.emittedEvents).not.toContain("friction_recovered");

    // Returns to 70 at t=6000 -> 5000ms elapsed -> triggers eligibility
    const eligible = evaluateAdaptiveStateTransition(
      sticky.sessionState,
      70,
      6000
    );
    expect(eligible.emittedEvents).toContain("adaptation_eligible");
  });

  it("9. Cooldown prevents immediate retriggering even after brief drop below 55", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 80, 1000).sessionState;
    st = evaluateAdaptiveStateTransition(st, 80, 6000).sessionState; // Triggers at t=6000, cooldown until 66000

    // User recovers at t=10000 while cooldown still has 56s left
    st = evaluateAdaptiveStateTransition(st, 40, 10000).sessionState;
    expect(st.state).toBe("COOLDOWN");

    // New spike at t=12000 sustained until t=18000 (still inside 60s cooldown) -> deferred
    st = evaluateAdaptiveStateTransition(st, 85, 12000).sessionState;
    const deferred = evaluateAdaptiveStateTransition(st, 85, 18000);
    expect(deferred.emittedEvents).not.toContain("adaptation_eligible");
    expect(deferred.emittedEvents).toContain("adaptation_deferred");
    expect(deferred.deferralReason).toBe("cooldown_active");
  });

  it("10. Cooldown expiry allows a new friction episode after recovery", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 80, 1000).sessionState;
    st = evaluateAdaptiveStateTransition(st, 80, 6000).sessionState; // Cooldown expires at 66000

    // Recover below 55 at t=20000
    st = evaluateAdaptiveStateTransition(st, 35, 20000).sessionState;

    // After t=66000 cooldown expires, start a genuinely new high-friction episode at t=70000
    st = evaluateAdaptiveStateTransition(st, 78, 70000).sessionState;
    expect(st.state).toBe("HIGH_FRICTION_CANDIDATE");

    const secondEpisodeEligible = evaluateAdaptiveStateTransition(st, 81, 75500);
    expect(secondEpisodeEligible.emittedEvents).toContain("adaptation_eligible");
  });

  it("11. Inactivity guard: missing telemetry (> 15s gap) resets an unconfirmed candidate", () => {
    let st = createInitialAdaptiveSessionState(sessionId);
    st = evaluateAdaptiveStateTransition(st, 85, 1000).sessionState;
    expect(st.state).toBe("HIGH_FRICTION_CANDIDATE");

    // Next reading arrives 20 seconds later (> 15s maxObservationGapMs)
    const afterInactivity = evaluateAdaptiveStateTransition(st, 85, 21000);
    expect(afterInactivity.resetReason).toBe("inactivity_gap_exceeded");
    expect(afterInactivity.emittedEvents).toContain("inactivity_candidate_reset");
    expect(afterInactivity.emittedEvents).not.toContain("adaptation_eligible");
    // Fresh candidate starts at t=21000
    expect(afterInactivity.sessionState.candidateStartedAtMs).toBe(21000);
  });

  it("12. Invalid scores (NaN, Infinity, <0, >100) cannot trigger adaptation", () => {
    const initial = createInitialAdaptiveSessionState(sessionId);
    for (const invalidScore of [Number.NaN, Infinity, -10, 150]) {
      const res = evaluateAdaptiveStateTransition(initial, invalidScore, 5000);
      expect(res.sessionState.state).toBe("MONITORING");
      expect(res.emittedEvents).toEqual([]);
    }
  });
});

describe("Day 6: Multi-Session Socket Integration & 5 Simulation Scenarios", () => {
  type TypedClientSocket = ClientSocket<
    ServerToClientEvents,
    ClientToServerEvents
  >;

  let httpServer: http.Server;
  let serverUrl: string;
  let repo: InMemoryAdaptiveRepo;
  let service: PersistenceService;
  let clock: ControllableClock;
  let clients: TypedClientSocket[] = [];

  beforeEach(async () => {
    repo = new InMemoryAdaptiveRepo();
    service = new PersistenceService(repo);
    clock = new ControllableClock();
    httpServer = http.createServer();

    createSocketServer(httpServer, {
      corsOrigin: "*",
      persistenceService: service,
      persistIntervalMs: 10000,
      rateLimitConfig: {
        minIntervalMs: 10,
        maxEventsPerWindow: 50,
        windowMs: 5000,
      },
      adaptiveOptions: {
        config: DEFAULT_ADAPTIVE_CONFIG,
        clock,
      },
    });

    await new Promise<void>((resolve) =>
      httpServer.listen(0, "127.0.0.1", () => resolve())
    );
    const port = (httpServer.address() as AddressInfo).port;
    serverUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const c of clients) c.disconnect();
    clients = [];
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  function connectClient(): Promise<TypedClientSocket> {
    return new Promise((resolve, reject) => {
      const client: TypedClientSocket = createClient(serverUrl, {
        transports: ["websocket"],
      });
      clients.push(client);
      client.on("connect", () => resolve(client));
      client.on("connect_error", reject);
    });
  }

  const highBatch = {
    observationWindowSeconds: 30,
    fieldFocusCount: 6,
    hesitationCount: 3,
    validationErrors: 3,
    repeatedClicks: 4,
    backtracks: 3,
    cursorAnomalyScore: 0.9,
  };

  const lowBatch = {
    observationWindowSeconds: 30,
    fieldFocusCount: 2,
    hesitationCount: 0,
    validationErrors: 0,
    repeatedClicks: 0,
    backtracks: 0,
    cursorAnomalyScore: 0.05,
  };

  it("Socket Integration 1–6: delivers candidate, eligibility, recovery, prevents duplicates, isolates Session A from Session B, and survives DB outage", async () => {
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

    const statesA: FrictionStatePayload[] = [];
    const eligiblesA: AdaptationEligiblePayload[] = [];
    const deferredsA: AdaptationDeferredPayload[] = [];
    const recoveriesA: FrictionRecoveredPayload[] = [];

    const eligiblesB: AdaptationEligiblePayload[] = [];
    const statesB: FrictionStatePayload[] = [];

    clientA.on("friction:state", (s) => statesA.push(s));
    clientA.on("adaptation:eligible", (e) => eligiblesA.push(e));
    clientA.on("adaptation:deferred", (d) => deferredsA.push(d));
    clientA.on("friction:recovered", (r) => recoveriesA.push(r));

    clientB.on("friction:state", (s) => statesB.push(s));
    clientB.on("adaptation:eligible", (e) => eligiblesB.push(e));

    // Session B sends normal interaction -> stays MONITORING
    await new Promise((r) => clientB.emit("telemetry:batch", lowBatch, r));
    expect(statesB[statesB.length - 1]?.state).toBe("MONITORING");

    // Session A starts high-friction candidate at t=0
    await new Promise((r) => clientA.emit("telemetry:batch", highBatch, r));
    expect(statesA[statesA.length - 1]?.state).toBe("HIGH_FRICTION_CANDIDATE");

    // Advance 5.5s -> Session A becomes ADAPTATION_ELIGIBLE
    clock.advance(5500);
    await new Promise((r) => clientA.emit("telemetry:batch", highBatch, r));
    expect(eligiblesA.length).toBe(1);
    expect(eligiblesA[0]?.sessionId).toBe(sessionA.id);
    expect(eligiblesA[0]?.eligible).toBe(true);

    // Session B was completely unaffected
    expect(eligiblesB.length).toBe(0);
    expect(statesB[statesB.length - 1]?.state).toBe("MONITORING");

    // Duplicate prevention: sending another high batch 1s later defers and does NOT emit a second adaptation:eligible
    clock.advance(1000);
    await new Promise((r) => clientA.emit("telemetry:batch", highBatch, r));
    expect(eligiblesA.length).toBe(1);
    expect(deferredsA.length).toBe(1);

    // Simulate Neon DB outage during recovery -> state machine still delivers friction:recovered
    repo.simulateOutage = true;
    clock.advance(2000);
    await new Promise((r) => clientA.emit("telemetry:batch", lowBatch, r));
    clock.advance(2000);
    await new Promise((r) => clientA.emit("telemetry:batch", lowBatch, r));
    expect(recoveriesA.length).toBe(1);
    expect(recoveriesA[0]?.recovered).toBe(true);
  });

  it("Simulation Scenarios 1–5: temporary spike, sustained friction, cooldown, recovery + new episode, and inactivity", async () => {
    const session = await service.createSession();
    const client = await connectClient();
    await new Promise<SessionJoinAck>((r) =>
      client.emit("session:join", { sessionId: session.id }, r)
    );

    const eligibles: AdaptationEligiblePayload[] = [];
    const deferreds: AdaptationDeferredPayload[] = [];
    const states: FrictionStatePayload[] = [];

    client.on("adaptation:eligible", (e) => eligibles.push(e));
    client.on("adaptation:deferred", (d) => deferreds.push(d));
    client.on("friction:state", (s) => states.push(s));

    // 1. Temporary spike (< 5s then drop below 55) -> no trigger
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r));
    clock.advance(2000);
    await new Promise((r) => client.emit("telemetry:batch", lowBatch, r));
    clock.advance(2000);
    await new Promise((r) => client.emit("telemetry:batch", lowBatch, r));
    expect(eligibles.length).toBe(0);

    // 2. Sustained friction (>= 5s once smoothed score >= 65) -> triggers 1 eligibility event
    clock.advance(1000);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // 42.25 -> 62.46
    clock.advance(1000);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // 62.46 -> 75.60 (>= 65, candidate starts)
    clock.advance(5500);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // 75.60 -> 84.14 sustained 5.5s -> eligible!
    expect(eligibles.length).toBe(1);

    // 3. Cooldown behavior during 60s lockout -> deferred
    clock.advance(10000);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r));
    expect(deferreds.length).toBeGreaterThanOrEqual(1);
    expect(eligibles.length).toBe(1);

    // 4. Recovery + cooldown expiry + new episode -> triggers 2nd eligibility event
    clock.advance(55000); // > 60s after first eligibility
    await new Promise((r) => client.emit("telemetry:batch", lowBatch, r));
    clock.advance(2000);
    await new Promise((r) => client.emit("telemetry:batch", lowBatch, r));

    clock.advance(1000);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // climbs back toward >= 65
    clock.advance(1000);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // crosses >= 65, new candidate starts
    clock.advance(5500);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // sustained 5.5s -> 2nd eligible!
    expect(eligibles.length).toBe(2);

    // 5. Inactivity gap (> 15s) after recovery resets unconfirmed candidate
    clock.advance(65000);
    await new Promise((r) => client.emit("telemetry:batch", lowBatch, r));
    clock.advance(2000);
    await new Promise((r) => client.emit("telemetry:batch", lowBatch, r));

    clock.advance(1000);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // climbs to 62.46
    clock.advance(1000);
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r)); // crosses 75.60 (>= 65, candidate started)
    clock.advance(20000); // 20s inactivity gap (> 15s)
    await new Promise((r) => client.emit("telemetry:batch", highBatch, r));
    expect(states[states.length - 1]?.resetReason).toBe(
      "inactivity_gap_exceeded"
    );
    expect(eligibles.length).toBe(2); // Did NOT trigger a 3rd false adaptation
  });
});