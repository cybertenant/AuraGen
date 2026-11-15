import { Router, Request, Response } from "express";
import { HealthResponse, HealthResponseSchema } from "@auragen/shared";
import { checkDatabaseHealth } from "../db/index.js";

export const healthRouter: Router = Router();

healthRouter.get("/health", async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseHealth();

  const payload: HealthResponse = {
    status: "ok",
    service: "auragen-server",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    websocketReady: true,
    database: dbHealth,
  };

  const validated = HealthResponseSchema.parse(payload);
  res.status(200).json(validated);
});