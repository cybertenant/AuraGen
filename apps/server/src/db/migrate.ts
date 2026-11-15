import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { fileURLToPath } from "url";
import { env, isDatabaseConfigured } from "../config/env.js";
import { normalizeConnectionString } from "./index.js";
import { logger } from "../utils/logger.js";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const connectionString = env.DIRECT_DATABASE_URL || env.DATABASE_URL;

  if (!isDatabaseConfigured() || !connectionString) {
    logger.error(
      "Cannot run migrations: DATABASE_URL / DIRECT_DATABASE_URL is not configured with real Neon credentials in apps/server/.env."
    );
    process.exit(1);
  }

  logger.info("Connecting to Neon PostgreSQL to run Drizzle migrations...");
  const migrationPool = new Pool({
    connectionString: normalizeConnectionString(connectionString),
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    const db = drizzle(migrationPool);
    const migrationsFolder = path.resolve(__dirname, "./migrations");
    await migrate(db, { migrationsFolder });
    logger.info("Neon PostgreSQL migrations applied successfully.");
  } catch (err) {
    logger.error("Migration failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exitCode = 1;
  } finally {
    await migrationPool.end();
  }
}

runMigrations();