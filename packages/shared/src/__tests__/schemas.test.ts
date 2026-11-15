import { describe, it, expect } from "vitest";
import {
  FrictionScoreSchema,
  FrictionSignalSchema,
  SessionSchema,
  CreateFrictionEventInputSchema,
  UpsertFormDraftInputSchema,
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

  it("validates aggregated CreateFrictionEventInputSchema and rejects raw mouse coordinates", () => {
    const validEvent = {
      frictionScore: 76,
      frictionLevel: "high",
      signals: {
        hesitation_count: 4,
        validation_errors: 2,
        repeated_clicks: 5,
        backtracking: 2,
        cursor_anomaly_score: 68.5,
        observation_window_seconds: 10,
      },
    };
    expect(CreateFrictionEventInputSchema.safeParse(validEvent).success).toBe(true);

    const unaggregatedRawTelemetry = {
      frictionScore: 76,
      frictionLevel: "high",
      signals: {
        hesitation_count: 4,
        raw_mouse_coordinates: [[120, 340]],
      },
    };
    expect(
      CreateFrictionEventInputSchema.safeParse(unaggregatedRawTelemetry).success
    ).toBe(false);
  });

  it("blocks prohibited credential fields in UpsertFormDraftInputSchema", () => {
    const safeDraft = {
      formData: {
        applicantType: "Corporate Treasury",
        requestedFacilityUsd: 250000,
        dscrRatio: "1.45",
      },
      schemaVersion: 1,
    };
    expect(UpsertFormDraftInputSchema.safeParse(safeDraft).success).toBe(true);

    const unsafeDraft = {
      formData: {
        applicantType: "Corporate Treasury",
        bankPassword: "secret-password-123",
      },
      schemaVersion: 1,
    };
    expect(UpsertFormDraftInputSchema.safeParse(unsafeDraft).success).toBe(false);
  });
});