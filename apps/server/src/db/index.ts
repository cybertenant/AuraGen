import pg from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import { env, isDatabaseConfigured } from "../config/env.js";
import * as schema from "./schema.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;

export class DatabaseUnavailableError extends Error {
  public readonly statusCode = 503;
  constructor(
    message = "Neon PostgreSQL database is unavailable or not configured. Please check DATABASE_URL in apps/server/.env."
  ) {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

export function normalizeConnectionString(rawUrl: string): string {
  if (
    rawUrl.includes("sslmode=require") &&
    !rawUrl.includes("uselibpqcompat=")
  ) {
    return rawUrl.replace(
      "sslmode=require",
      "uselibpqcompat=true&sslmode=require"
    );
  }
  return rawUrl;
}

let pool: pg.Pool | null = null;
let dbInstance: NodePgDatabase<typeof schema> | null = null;

export function getPool(): pg.Pool {
  if (!isDatabaseConfigured() || !env.DATABASE_URL) {
    throw new DatabaseUnavailableError();
  }

  if (!pool) {
    pool = new Pool({
      connectionString: normalizeConnectionString(env.DATABASE_URL),
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      logger.error("Unexpected PostgreSQL pool error", {
        error: err.message,
      });
    });
  }

  return pool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!dbInstance) {
    const activePool = getPool();
    dbInstance = drizzle(activePool, { schema });
  }
  return dbInstance;
}

export async function checkDatabaseHealth(timeoutMs = 2000): Promise<{
  connected: boolean;
  configured: boolean;
  latencyMs: number | null;
}> {
  if (!isDatabaseConfigured()) {
    return {
      connected: false,
      configured: false,
      latencyMs: null,
    };
  }

  const start = Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    const db = getDb();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Database health check timed out")),
        timeoutMs
      );
    });

    await Promise.race([db.execute(sql`SELECT 1`), timeoutPromise]);

    return {
      connected: true,
      configured: true,
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    logger.warn("Database health probe failed", {
      reason: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      connected: false,
      configured: true,
      latencyMs: null,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function closeDatabasePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}