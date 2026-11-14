import { describe, it, expect } from "vitest";
import {
  FrictionScoreSchema,
  FrictionSignalSchema,
  SessionSchema,
} from "../index.js";

describe("@auragen/shared Zod schemas", () => {
  it("validates a valid FrictionScore payload", () => {
    const validScore = {
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      score: 85,
      level: "high",
      interactionStatus: "High Cognitive Load",
      adaptationStatus: "Adapting",
      updatedAt: new Date().toISOString(),
    };

    const parsed = FrictionScoreSchema.safeParse(validScore);
    expect(parsed.success).toBe(true);
  });

  it("rejects out-of-bounds FrictionScore (>100)", () => {
    const invalidScore = {
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      score: 140,
      level: "high",
      interactionStatus: "Normal",
      adaptationStatus: "Waiting",
      updatedAt: new Date().toISOString(),
    };

    const parsed = FrictionScoreSchema.safeParse(invalidScore);
    expect(parsed.success).toBe(false);
  });

  it("validates a FrictionSignal object", () => {
    const signal = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      fieldId: "annual_income",
      type: "hesitation",
      timestamp: Date.now(),
      weight: 25,
    };

    expect(FrictionSignalSchema.safeParse(signal).success).toBe(true);
  });

  it("applies default values to SessionSchema", () => {
    const session = SessionSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      startedAt: new Date().toISOString(),
      currentStep: "income_verification",
    });

    expect(session.frictionScore).toBe(0);
    expect(session.frictionLevel).toBe("low");
    expect(session.adaptationStatus).toBe("Waiting");
  });
});