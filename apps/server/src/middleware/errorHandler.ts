import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/logger.js";

export interface AppError extends Error {
  statusCode?: number;
  type?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({
      status: "error",
      statusCode: 400,
      message: "Invalid JSON payload",
      timestamp: new Date().toISOString(),
    });
    return;
  }

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