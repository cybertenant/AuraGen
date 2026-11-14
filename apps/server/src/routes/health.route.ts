import { Router, Request, Response } from "express";
import { HealthResponse, HealthResponseSchema } from "@auragen/shared";

export const healthRouter: Router = Router();

healthRouter.get("/health", (_req: Request, res: Response) => {
  const payload: HealthResponse = {
    status: "ok",
    service: "auragen-server",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    websocketReady: true,
  };

  const validated = HealthResponseSchema.parse(payload);
  res.status(200).json(validated);
});