import { describe, expect, it } from "vitest";
import {
  computeFrictionScore,
  frictionLevel,
  sanitizeForAi,
  FrictionSignalsSchema,
  GeneratedUiSchema,
  SanitizedContextSchema,
} from "../index.js";

const signals = FrictionSignalsSchema.parse({
  hesitationMs: 0,
  validationErrors: 0,
  backtracks: 0,
  repeatedClicks: 0,
});

describe("friction scoring", () => {
  it("returns zero for a calm session", () => {
    expect(computeFrictionScore(signals)).toBe(0);
    expect(frictionLevel(0)).toBe("low");
  });

  it("clamps a chaotic session to 100 and classifies it as high", () => {
    const chaotic = FrictionSignalsSchema.parse({
      hesitationMs: 60000,
      validationErrors: 10,
      backtracks: 10,
      repeatedClicks: 10,
    });
    const score = computeFrictionScore(chaotic);
    expect(score).toBe(100);
    expect(frictionLevel(score)).toBe("high");
    expect(frictionLevel(40)).toBe("medium");
  });
});

describe("schema guardrails", () => {
  const validUi = {
    schemaVersion: 1,
    sessionId: "session-123",
    steps: [
      {
        id: "step-income",
        title: "What is your annual income?",
        fields: [
          { id: "annualIncome", label: "Annual income", component: "number" },
        ],
      },
    ],
  };

  it("accepts a well formed generated UI", () => {
    expect(GeneratedUiSchema.safeParse(validUi).success).toBe(true);
  });

  it("rejects a component outside the approved registry", () => {
    const result = GeneratedUiSchema.safeParse({
      ...validUi,
      steps: [
        {
          ...validUi.steps[0],
          fields: [{ id: "x", label: "x", component: "script" }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects extra keys that could carry injected markup or values", () => {
    expect(
      GeneratedUiSchema.safeParse({
        ...validUi,
        html: "<script>alert(1)</script>",
      }).success
    ).toBe(false);
    expect(
      GeneratedUiSchema.safeParse({
        ...validUi,
        steps: [
          {
            ...validUi.steps[0],
            fields: [
              {
                id: "annualIncome",
                label: "Annual income",
                component: "number",
                value: "145000",
              },
            ],
          },
        ],
      }).success
    ).toBe(false);
  });
});

describe("zero PII leakage", () => {
  it("builds an AI context with field ids only", () => {
    const context = sanitizeForAi("session-123", 78, [
      "annualIncome",
      "loanPurpose",
    ]);
    expect(SanitizedContextSchema.safeParse(context).success).toBe(true);
    expect(context.frictionLevel).toBe("high");
    expect(context.fieldIds).toEqual(["annualIncome", "loanPurpose"]);
    expect(JSON.stringify(context)).not.toContain("145000");
    expect(Object.keys(context).sort()).toEqual([
      "fieldIds",
      "frictionLevel",
      "frictionScore",
      "sessionId",
    ]);
  });
});
