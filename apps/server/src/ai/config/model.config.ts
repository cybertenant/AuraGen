import { env, resolveBackendGoogleApiKey } from "../../config/env.js";

export interface GeminiModelConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxRetries: number;
  hasApiKey: boolean;
}

export function getGeminiModelConfig(
  overrideModel?: string
): GeminiModelConfig {
  const apiKey = resolveBackendGoogleApiKey();
  return {
    model: overrideModel || env.GEMINI_MODEL || "gemini-2.5-flash",
    temperature: 0.2,
    maxOutputTokens: 2048,
    timeoutMs: env.GEMINI_TIMEOUT_MS,
    maxRetries: 1,
    hasApiKey: Boolean(apiKey),
  };
}

export function getSafeModelMetadata(overrideModel?: string) {
  const cfg = getGeminiModelConfig(overrideModel);
  return {
    provider: "@langchain/google (ChatGoogle)",
    model: cfg.model,
    configured: cfg.hasApiKey,
    temperature: cfg.temperature,
    maxOutputTokens: cfg.maxOutputTokens,
    timeoutMs: cfg.timeoutMs,
  };
}