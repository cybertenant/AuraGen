import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECT_DATABASE_URL: z.string().min(1).optional(),
  GOOGLE_API_KEY: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
});

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors
  );
  process.exit(1);
}

export const env = parsedEnv.data;

export function isDatabaseConfigured(): boolean {
  const url = env.DATABASE_URL;
  if (!url) return false;
  if (url.includes("YOUR_PASSWORD") || url.includes("ep-example")) return false;
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export function resolveBackendGoogleApiKey(): string | undefined {
  const key = env.GOOGLE_API_KEY || env.GEMINI_API_KEY;
  if (!key) return undefined;
  if (key.includes("your_google_ai_studio_api_key")) return undefined;
  return key.trim();
}

export function isGeminiConfigured(): boolean {
  return Boolean(resolveBackendGoogleApiKey());
}