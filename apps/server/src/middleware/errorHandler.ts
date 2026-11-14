import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.message || "Internal Server Error";

  logger.error(`HTTP ${statusCode} - ${message}`);

  res.status(statusCode).json({
    status: "error",
    statusCode,
    message,
    timestamp: new Date().toISOString(),
  });
}