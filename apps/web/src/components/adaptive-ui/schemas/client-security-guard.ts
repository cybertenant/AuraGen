import { CANONICAL_LOAN_FIELDS } from "../canonical/canonical-loan-form";
import { APPROVED_COMPONENT_REGISTRY } from "../registry/component-registry";

export interface ClientGuardViolation {
  code: string;
  path: string;
  message: string;
}

export interface ClientGuardResult {
  valid: boolean;
  statusLabel:
    | "Validated"
    | "Rejected"
    | "Unsupported Schema"
    | "Missing Required Fields"
    | "Unknown Component";
  violations: ClientGuardViolation[];
}

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const HTML_OR_SCRIPT_PATTERN =
  /<\s*\/?\s*[a-zA-Z!/?][^>]*>|javascript\s*:|\b(?:eval|Function)\s*\(/i;

function checkDangerousKeysAndMarkup(
  node: unknown,
  path: string,
  depth: number,
  violations: ClientGuardViolation[]
): void {
  if (depth > 8) {
    violations.push({
      code: "EXCESSIVE_NESTING",
      path,
      message: "Schema nesting exceeds client safety depth limit (8).",
    });
    return;
  }
  if (typeof node === "string") {
    if (HTML_OR_SCRIPT_PATTERN.test(node)) {
      violations.push({
        code: "HTML_INJECTION_DETECTED",
        path,
        message: "Disallowed HTML markup or executable script pattern in schema text.",
      });
    }
    return;
  }
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, idx) =>
      checkDangerousKeysAndMarkup(item, `${path}[${idx}]`, depth + 1, violations)
    );
    return;
  }
  const rec = node as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(rec)) {
    if (DANGEROUS_KEYS.has(key)) {
      violations.push({
        code: "DANGEROUS_PROPERTY",
        path: `${path}.${key}`,
        message: `Forbidden property "${key}" detected.`,
      });
      continue;
    }
    checkDangerousKeysAndMarkup(
      rec[key],
      `${path}.${key}`,
      depth + 1,
      violations
    );
  }
}

/**
 * Frontend Defense-in-Depth Guard (Day 10).
 * Independently verifies every adaptive UI schema in the browser before rendering,
 * never trusting a payload solely because it came from the API.
 */
export function validateAdaptiveSchemaOnClient(
  schema: unknown
): ClientGuardResult {
  const violations: ClientGuardViolation[] = [];

  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return {
      valid: false,
      statusLabel: "Rejected",
      violations: [
        {
          code: "INVALID_TOP_LEVEL_TYPE",
          path: "$",
          message: "Adaptive schema must be a JSON object.",
        },
      ],
    };
  }

  checkDangerousKeysAndMarkup(schema, "$", 1, violations);

  const candidate = schema as Record<string, unknown>;

  if (candidate.version !== 1) {
    violations.push({
      code: "UNSUPPORTED_SCHEMA_VERSION",
      path: "$.version",
      message: `Unsupported schema version: ${String(candidate.version)}.`,
    });
  }

  if (!Array.isArray(candidate.steps) || candidate.steps.length === 0 || candidate.steps.length > 8) {
    violations.push({
      code: "SCHEMA_VALIDATION_ERROR",
      path: "$.steps",
      message: "Adaptive schema must define between 1 and 8 steps.",
    });
  } else {
    const canonicalIds = new Set<string>(
      CANONICAL_LOAN_FIELDS.map((f) => f.fieldId)
    );
    const allowedComponents = new Set<string>(
      Object.keys(APPROVED_COMPONENT_REGISTRY)
    );
    const seenFields = new Set<string>();

    candidate.steps.forEach((rawStep, sIdx) => {
      if (!rawStep || typeof rawStep !== "object") return;
      const step = rawStep as Record<string, unknown>;
      const fields = Array.isArray(step.fields) ? step.fields : [];

      if (fields.length === 0 || fields.length > 8) {
        violations.push({
          code: "EXCESSIVE_FIELDS_PER_STEP",
          path: `$.steps[${sIdx}].fields`,
          message: "Each step must contain between 1 and 8 fields.",
        });
      }

      fields.forEach((rawField, fIdx) => {
        if (!rawField || typeof rawField !== "object") return;
        const field = rawField as Record<string, unknown>;
        const fPath = `$.steps[${sIdx}].fields[${fIdx}]`;

        if (
          typeof field.component === "string" &&
          !allowedComponents.has(field.component)
        ) {
          violations.push({
            code: "UNKNOWN_COMPONENT",
            path: `${fPath}.component`,
            message: `Component "${field.component}" is not in the approved registry.`,
          });
        }

        const fieldId = typeof field.fieldId === "string" ? field.fieldId : "";
        if (!canonicalIds.has(fieldId)) {
          violations.push({
            code: "UNKNOWN_FIELD",
            path: `${fPath}.fieldId`,
            message: `Unknown canonical field "${fieldId}".`,
          });
        } else if (seenFields.has(fieldId)) {
          violations.push({
            code: "DUPLICATE_FIELD",
            path: `${fPath}.fieldId`,
            message: `Duplicate field reference "${fieldId}".`,
          });
        } else {
          seenFields.add(fieldId);
        }
      });
    });

    for (const reqId of canonicalIds) {
      if (!seenFields.has(reqId)) {
        violations.push({
          code: "MISSING_REQUIRED_FIELD",
          path: "$.steps",
          message: `Missing required canonical field "${reqId}".`,
        });
      }
    }
  }

  if (violations.length === 0) {
    return {
      valid: true,
      statusLabel: "Validated",
      violations: [],
    };
  }

  const codes = new Set(violations.map((v) => v.code));
  let statusLabel: ClientGuardResult["statusLabel"] = "Rejected";
  if (codes.has("UNSUPPORTED_SCHEMA_VERSION")) {
    statusLabel = "Unsupported Schema";
  } else if (codes.has("MISSING_REQUIRED_FIELD")) {
    statusLabel = "Missing Required Fields";
  } else if (codes.has("UNKNOWN_COMPONENT")) {
    statusLabel = "Unknown Component";
  }

  return {
    valid: false,
    statusLabel,
    violations,
  };
}