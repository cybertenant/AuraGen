import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import {
  GuardrailError,
  sanitizeContext,
  validateGeneratedUi,
} from "../ai/guard.js";
import { generateUi, offlineGenerator } from "../ai/generator.js";

const app = () => createApp({ generator: offlineGenerator });

const validRequest = {
  sessionId: "session-123",
  signals: {
    hesitationMs: 45000,
    validationErrors: 4,
    backtracks: 4,
    repeatedClicks: 5,
  },
  fieldIds: ["annualIncome", "loanPurpose"],
};

describe("AuraGen API", () => {
  it("exposes a health endpoint", async () => {
    const response = await request(app()).get("/health");
    expect(response.status).toBe(200);
    expect(response.body.service).toBe("auragen-tejaswini-server");
  });

  it("creates a session", async () => {
    const response = await request(app())
      .post("/api/sessions")
      .send({ id: "session-123" });
    expect(response.status).toBe(201);
    expect(response.body.id).toBe("session-123");
  });

  it("returns a validated guided UI with no field values", async () => {
    const response = await request(app())
      .post("/api/adaptations")
      .send(validRequest);
    expect(response.status).toBe(200);
    expect(response.body.ui.schemaVersion).toBe(1);
    expect(response.body.ui.steps).toHaveLength(2);
    expect(JSON.stringify(response.body)).not.toContain("145000");
  });

  it("rejects invalid requests", async () => {
    const response = await request(app())
      .post("/api/adaptations")
      .send({ sessionId: "x" });
    expect(response.status).toBe(400);
  });

  it("returns 404 for unknown routes", async () => {
    const response = await request(app()).get("/nope");
    expect(response.status).toBe(404);
  });
});

describe("server guardrails", () => {
  it("rejects generated JSON with extra properties", () => {
    expect(() =>
      validateGeneratedUi({
        schemaVersion: 1,
        sessionId: "session-123",
        html: "<script>alert(1)</script>",
        steps: [],
      })
    ).toThrow(GuardrailError);
  });

  it("rejects an AI context containing a field value", () => {
    expect(() =>
      sanitizeContext({
        sessionId: "session-123",
        frictionScore: 78,
        frictionLevel: "high",
        fieldIds: ["annualIncome"],
        annualIncome: 145000,
      })
    ).toThrow(GuardrailError);
  });

  it("always validates generator output before returning it", async () => {
    const ui = await generateUi(
      {
        sessionId: "session-123",
        frictionScore: 78,
        frictionLevel: "high",
        fieldIds: ["annualIncome"],
      },
      offlineGenerator
    );
    expect(() => validateGeneratedUi(ui)).not.toThrow();
    expect(ui.steps[0].fields[0].id).toBe("annualIncome");
  });
});
