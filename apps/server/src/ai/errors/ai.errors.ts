import { GenerationErrorCode } from "../types/ai.types.js";

export class AdaptiveGenerationError extends Error {
  public readonly code: GenerationErrorCode;
  public readonly httpStatus: number;
  public readonly isRetryable: boolean;

  constructor(
    code: GenerationErrorCode,
    message: string,
    httpStatus = 500,
    isRetryable = false
  ) {
    super(message);
    this.name = "AdaptiveGenerationError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.isRetryable = isRetryable;
  }
}

export function classifyProviderError(err: unknown): AdaptiveGenerationError {
  if (err instanceof AdaptiveGenerationError) {
    return err;
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  const lower = rawMessage.toLowerCase();

  if (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("401") ||
    lower.includes("403") ||
    lower.includes("permission denied")
  ) {
    return new AdaptiveGenerationError(
      "INVALID_API_KEY",
      "Google Gemini API authentication failed. Verify server GOOGLE_API_KEY configuration.",
      502,
      false
    );
  }

  if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("rate limit")
  ) {
    const isQuota = lower.includes("quota");
    return new AdaptiveGenerationError(
      isQuota ? "QUOTA_EXHAUSTED" : "RATE_LIMIT_EXCEEDED",
      isQuota
        ? "Google Gemini free-tier quota has been reached. Standard form remains active."
        : "Google Gemini rate limit reached. Please retry shortly.",
      429,
      false
    );
  }

  if (
    lower.includes("not found") ||
    lower.includes("404") ||
    lower.includes("unsupported") ||
    lower.includes("no longer available")
  ) {
    return new AdaptiveGenerationError(
      "UNSUPPORTED_MODEL",
      "Configured Gemini model is unavailable or unsupported for structured output.",
      502,
      false
    );
  }

  if (
    lower.includes("timeout") ||
    lower.includes("aborted") ||
    lower.includes("timed out")
  ) {
    return new AdaptiveGenerationError(
      "TIMEOUT",
      "Gemini UI generation request timed out before completion.",
      504,
      true
    );
  }

  if (
    lower.includes("fetch failed") ||
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("network")
  ) {
    return new AdaptiveGenerationError(
      "NETWORK_ERROR",
      "Unable to reach Google Gemini API due to a network failure.",
      502,
      true
    );
  }

  return new AdaptiveGenerationError(
    "MALFORMED_RESPONSE",
    "Gemini returned an invalid or unparseable response.",
    502,
    false
  );
}