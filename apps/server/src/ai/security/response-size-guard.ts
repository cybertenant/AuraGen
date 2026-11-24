import {
  AISecurityLimits,
  AISecurityViolation,
  DEFAULT_AI_SECURITY_LIMITS,
} from "./security.types.js";
import { createViolation } from "./security-errors.js";

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export interface ParsedStructureResult {
  ok: boolean;
  value?: Record<string, unknown>;
  violations: AISecurityViolation[];
}

function measureAndCheckObjectTree(
  node: unknown,
  path: string,
  depth: number,
  maxDepth: number,
  violations: AISecurityViolation[],
  seen: WeakSet<object>
): void {
  if (depth > maxDepth) {
    violations.push(
      createViolation(
        "EXCESSIVE_NESTING",
        path,
        `Nesting depth (${depth}) exceeds maximum allowed depth (${maxDepth}).`
      )
    );
    return;
  }

  if (node === null || typeof node !== "object") {
    return;
  }

  if (seen.has(node)) {
    violations.push(
      createViolation("EXCESSIVE_NESTING", path, "Circular object reference detected.")
    );
    return;
  }
  seen.add(node);

  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      measureAndCheckObjectTree(
        node[i],
        `${path}[${i}]`,
        depth + 1,
        maxDepth,
        violations,
        seen
      );
    }
    return;
  }

  const record = node as Record<string, unknown>;
  const keys = Object.getOwnPropertyNames(record);
  for (const key of keys) {
    if (DANGEROUS_KEYS.has(key)) {
      violations.push(
        createViolation(
          "DANGEROUS_PROPERTY",
          path ? `${path}.${key}` : key,
          `Dangerous property name "${key}" is strictly forbidden.`
        )
      );
      continue;
    }
    measureAndCheckObjectTree(
      record[key],
      path ? `${path}.${key}` : key,
      depth + 1,
      maxDepth,
      violations,
      seen
    );
  }
}

export function guardResponseSizeAndStructure(
  rawOutput: unknown,
  limits: AISecurityLimits = DEFAULT_AI_SECURITY_LIMITS
): ParsedStructureResult {
  if (rawOutput === null || rawOutput === undefined) {
    return {
      ok: false,
      violations: [
        createViolation("EMPTY_OUTPUT", "$", "AI model returned empty output."),
      ],
    };
  }

  let candidate: unknown = rawOutput;

  if (typeof rawOutput === "string") {
    const trimmed = rawOutput.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        violations: [
          createViolation("EMPTY_OUTPUT", "$", "AI model returned an empty string."),
        ],
      };
    }

    const byteSize = Buffer.byteLength(trimmed, "utf8");
    if (byteSize > limits.maxResponseBytes) {
      return {
        ok: false,
        violations: [
          createViolation(
            "OVERSIZED_RESPONSE",
            "$",
            `Response size (${byteSize} bytes) exceeds maximum limit (${limits.maxResponseBytes} bytes).`
          ),
        ],
      };
    }

    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return {
        ok: false,
        violations: [
          createViolation(
            "MALFORMED_JSON",
            "$",
            "AI output could not be parsed as strict JSON."
          ),
        ],
      };
    }
  } else {
    let serializedSize = 0;
    try {
      serializedSize = Buffer.byteLength(JSON.stringify(rawOutput), "utf8");
    } catch {
      return {
        ok: false,
        violations: [
          createViolation(
            "INVALID_TOP_LEVEL_TYPE",
            "$",
            "AI output is not serializable JSON."
          ),
        ],
      };
    }

    if (serializedSize > limits.maxResponseBytes) {
      return {
        ok: false,
        violations: [
          createViolation(
            "OVERSIZED_RESPONSE",
            "$",
            `Response size (${serializedSize} bytes) exceeds maximum limit (${limits.maxResponseBytes} bytes).`
          ),
        ],
      };
    }
  }

  if (
    candidate === null ||
    typeof candidate !== "object" ||
    Array.isArray(candidate)
  ) {
    return {
      ok: false,
      violations: [
        createViolation(
          "INVALID_TOP_LEVEL_TYPE",
          "$",
          "Top-level AI output must be a JSON object."
        ),
      ],
    };
  }

  const violations: AISecurityViolation[] = [];
  measureAndCheckObjectTree(
    candidate,
    "$",
    1,
    limits.maxNestingDepth,
    violations,
    new WeakSet()
  );

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  return {
    ok: true,
    value: candidate as Record<string, unknown>,
    violations: [],
  };
}