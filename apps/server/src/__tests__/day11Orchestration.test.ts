import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import {
  AdaptationLifecycleService,
  AdaptationDeliveryService,
  orchestrateAdaptationForEligibleSession,
  StoredAdaptationRecord,
} from "../adaptive/index.js";
import { DeterministicTestUIProvider, GeminiLangChainProvider } from "../ai/providers/gemini.provider.js";
import { resolveBackendGoogleApiKey } from "../config/env.js";

function createMockRoomEmitter() {
  const emitted: Array<{ room: string; event: string; payload: unknown }> = [];
  const deliveryService = new AdaptationDeliveryService({
    toSessionRoom(sessionId, event, payload) {
      emitted.push({ room: `session:${sessionId}`, event, payload });
    },
  });
  return { emitted, deliveryService };
}

describe("Day 11: Automatic Adaptation Orchestrator, Socket Delivery & Neon Lifecycle", () => {
  it("1–7. orchestrates eligibility -> context -> generation -> Day 10 guard -> persistence -> session-isolated Socket delivery", async () => {
    const lifecycle = new AdaptationLifecycleService();
    const { emitted, deliveryService } = createMockRoomEmitter();
    const sessionA = randomUUID();
    const sessionB = randomUUID();
    const persistedRecords: StoredAdaptationRecord[] = [];

    const outcome = await orchestrateAdaptationForEligibleSession({
      sessionId: sessionA,
      eligibilityId: "elig-episode-1",
      isServerAuthoritative: true,
      isEligible: true,
      smoothedScore: 81,
      frictionLevel: "high",
      dominantSectionId: "financial_information",
      provider: new DeterministicTestUIProvider(),
      deliveryService,
      lifecycleService: lifecycle,
      persistValidatedSchema: async (rec) => {
        persistedRecords.push(rec);
      },
    });

    expect(outcome.triggered).toBe(true);
    expect(outcome.record?.status).toBe("validated");
    expect(persistedRecords.length).toBe(1);
    expect(persistedRecords[0]?.sessionId).toBe(sessionA);

    // Emitted adaptation:generating then adaptation:ready strictly to sessionA
    expect(emitted.map((e) => e.event)).toEqual([
      "adaptation:generating",
      "adaptation:ready",
    ]);
    expect(emitted.every((e) => e.room === `session:${sessionA}`)).toBe(true);
    expect(emitted.some((e) => e.room === `session:${sessionB}`)).toBe(false);

    // Duplicate eligibility event for same episode is deduplicated
    const dupOutcome = await orchestrateAdaptationForEligibleSession({
      sessionId: sessionA,
      eligibilityId: "elig-episode-1",
      isServerAuthoritative: true,
      isEligible: true,
      provider: new DeterministicTestUIProvider(),
      deliveryService,
      lifecycleService: lifecycle,
    });
    expect(dupOutcome.triggered).toBe(false);
    expect(dupOutcome.deduplicated).toBe(true);

    // Untrusted browser-claimed eligibility is rejected
    const untrustedOutcome = await orchestrateAdaptationForEligibleSession({
      sessionId: sessionA,
      eligibilityId: "elig-fake-browser",
      isServerAuthoritative: false,
      isEligible: true,
      provider: new DeterministicTestUIProvider(),
      deliveryService,
      lifecycleService: lifecycle,
    });
    expect(untrustedOutcome.triggered).toBe(false);
    expect(untrustedOutcome.reason).toBe("UNTRUSTED_OR_INELIGIBLE_EVENT");
  });

  it("8–12. blocks malicious AI output, preserves previous valid schema, enforces rendered confirmation & session isolation", async () => {
    const lifecycle = new AdaptationLifecycleService();
    const { emitted, deliveryService } = createMockRoomEmitter();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    // First: valid generation succeeds
    const first = await orchestrateAdaptationForEligibleSession({
      sessionId: sessionA,
      eligibilityId: "elig-1",
      isServerAuthoritative: true,
      isEligible: true,
      provider: new DeterministicTestUIProvider(),
      deliveryService,
      lifecycleService: lifecycle,
    });
    expect(first.record?.status).toBe("validated");
    const firstId = first.record!.adaptationId;

    // Client confirms rendering for Session A -> transitions validated -> rendered
    const wrongSessionAck = lifecycle.confirmRendered({
      sessionId: sessionB,
      adaptationId: firstId,
      generationId: first.generationId!,
      schemaVersion: 1,
    });
    expect(wrongSessionAck.ok).toBe(false);
    expect(wrongSessionAck.reason).toBe("SESSION_OWNERSHIP_MISMATCH");

    const validAck = lifecycle.confirmRendered({
      sessionId: sessionA,
      adaptationId: firstId,
      generationId: first.generationId!,
      schemaVersion: 1,
    });
    expect(validAck.ok).toBe(true);
    expect(validAck.record?.status).toBe("rendered");

    // Duplicate client confirmation is idempotent
    const dupAck = lifecycle.confirmRendered({
      sessionId: sessionA,
      adaptationId: firstId,
      generationId: first.generationId!,
      schemaVersion: 1,
    });
    expect(dupAck.ok).toBe(true);

    // Second: malicious AI output fails Day 10 guard -> emits adaptation:failed & preserves first valid schema
    const maliciousProvider = new DeterministicTestUIProvider({
      customOutput: {
        version: 1,
        mode: "wizard",
        title: "Malicious <script>alert(1)</script>",
        steps: [{ id: "s1", title: "Bad", fields: [{ fieldId: "fakeField" }] }],
        navigation: { nextLabel: "Next", previousLabel: "Back", submitLabel: "Go" },
        appearance: { density: "comfortable", showProgress: true },
      },
    });

    const second = await orchestrateAdaptationForEligibleSession({
      sessionId: sessionA,
      eligibilityId: "elig-2",
      isServerAuthoritative: true,
      isEligible: true,
      provider: maliciousProvider,
      deliveryService,
      lifecycleService: lifecycle,
    });
    expect(second.triggered).toBe(true);
    expect(second.record).toBeUndefined();
    expect(emitted.at(-1)?.event).toBe("adaptation:failed");

    // Reconnection lookup still restores Session A's valid adaptation and never leaks to Session B
    const restoredA = lifecycle.getLatestValidatedForSession(sessionA);
    expect(restoredA?.adaptationId).toBe(firstId);
    expect(lifecycle.getLatestValidatedForSession(sessionB)).toBeNull();
  });

  it(
    "Live Gemini End-to-End Orchestration: generates, validates, and delivers a real adaptive schema when credentials are configured",
    async () => {
      if (!resolveBackendGoogleApiKey()) {
        return;
      }
      const lifecycle = new AdaptationLifecycleService();
      const { emitted, deliveryService } = createMockRoomEmitter();
      const sessionId = randomUUID();

      const liveOutcome = await orchestrateAdaptationForEligibleSession({
        sessionId,
        eligibilityId: "elig-live-gemini",
        isServerAuthoritative: true,
        isEligible: true,
        smoothedScore: 84,
        frictionLevel: "high",
        dominantSectionId: "financial_information",
        provider: new GeminiLangChainProvider(),
        deliveryService,
        lifecycleService: lifecycle,
      });

      expect(liveOutcome.triggered).toBe(true);
      expect(liveOutcome.record?.status).toBe("validated");
      expect(liveOutcome.record?.schema?.steps.length).toBeGreaterThanOrEqual(2);
      expect(emitted.at(-1)?.event).toBe("adaptation:ready");
    },
    30000
  );
});