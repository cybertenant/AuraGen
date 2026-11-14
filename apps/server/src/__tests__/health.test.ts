import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { HealthResponseSchema } from "@auragen/shared";

describe("GET /health", () => {
  const app = createApp();

  it("returns 200 and a valid structured HealthResponse", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);

    const validation = HealthResponseSchema.safeParse(response.body);
    expect(validation.success).toBe(true);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe("auragen-server");
    expect(response.body.websocketReady).toBe(true);
  });
});