import { AISecurityViolation, AISecurityViolationCode } from "./security.types.js";

export class AISecurityGuardError extends Error {
  public readonly code: AISecurityViolationCode;
  public readonly violations: AISecurityViolation[];
  public readonly httpStatus = 422;

  constructor(violations: AISecurityViolation[], message?: string) {
    const primary = violations[0];
    super(
      message ??
        primary?.message ??
        "AI-generated adaptive UI schema failed security validation."
    );
    this.name = "AISecurityGuardError";
    this.code = primary?.code ?? "SCHEMA_VALIDATION_ERROR";
    this.violations = violations;
  }
}

export function createViolation(
  code: AISecurityViolationCode,
  path: string,
  message: string
): AISecurityViolation {
  return { code, path, message };
}

export function formatPublicRejectionSummary(
  violations: AISecurityViolation[]
): string {
  if (violations.length === 0) {
    return "Generated layout failed security validation. Standard form preserved.";
  }
  const codes = new Set(violations.map((v) => v.code));
  if (codes.has("UNKNOWN_COMPONENT") || codes.has("EXECUTABLE_CODE_DETECTED")) {
    return "Generated layout referenced an unapproved component or unsafe expression and was blocked.";
  }
  if (
    codes.has("MISSING_REQUIRED_FIELD") ||
    codes.has("UNKNOWN_FIELD") ||
    codes.has("DUPLICATE_FIELD") ||
    codes.has("BUSINESS_RULE_MUTATION")
  ) {
    return "Generated layout violated canonical financial form field integrity and was blocked.";
  }
  if (codes.has("UNSUPPORTED_SCHEMA_VERSION")) {
    return "Generated layout used an unsupported schema version and was blocked.";
  }
  return "Generated layout did not pass security validation. Standard form preserved.";
}