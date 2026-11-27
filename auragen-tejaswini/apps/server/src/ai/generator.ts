import type { GeneratedUi, SanitizedContext } from "@tejaswini/shared";
import { sanitizeContext, validateGeneratedUi } from "./guard.js";

export interface UiGenerator {
  generate(context: SanitizedContext): Promise<GeneratedUi>;
}

export const SYSTEM_PROMPT = [
  "You generate adaptive UI schemas for a financial form.",
  "Return JSON only. The JSON must have schemaVersion: 1, sessionId,",
  "optional reason, and steps[]. Each step has id, title, optional helperText,",
  "and fields[]. Each field has id, label, component, optional placeholder,",
  "optional options for select, and required.",
  "Allowed components: text, number, select, checkbox, textarea.",
  "Never invent field ids that were not supplied in the context.",
  "Never ask for or include user values, PII, passwords, or card numbers.",
].join(" ");

function humanize(fieldId: string): string {
  return fieldId
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]/g, " ")
    .replace(/^./, (character) => character.toUpperCase());
}

function componentFor(fieldId: string): "text" | "number" | "checkbox" {
  const id = fieldId.toLowerCase();
  if (id.includes("income") || id.includes("amount") || id.includes("term")) {
    return "number";
  }
  if (id.includes("declaration") || id.includes("consent")) {
    return "checkbox";
  }
  return "text";
}

/** Deterministic, offline generator used when no API key is configured. */
export const offlineGenerator: UiGenerator = {
  async generate(context) {
    const steps = context.fieldIds.slice(0, 8).map((fieldId, index) => ({
      id: `step-${index + 1}`,
      title: `Let's complete ${humanize(fieldId).toLowerCase()}`,
      helperText: "One small step at a time.",
      fields: [
        {
          id: fieldId,
          label: humanize(fieldId),
          component: componentFor(fieldId),
          required: true,
        },
      ],
    }));
    return validateGeneratedUi({
      schemaVersion: 1,
      sessionId: context.sessionId,
      reason: `Guided mode triggered at friction ${context.frictionScore}/100`,
      steps,
    });
  },
};

/** Gemini provider. Falls back to offline generation when no key is set. */
export function createGeminiGenerator(apiKey: string, model: string): UiGenerator {
  return {
    async generate(context) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [
              { role: "user", parts: [{ text: JSON.stringify(context) }] },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`Gemini request failed with status ${response.status}`);
      }
      const payload = (await response.json()) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };
      const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini returned no text content");
      return validateGeneratedUi(JSON.parse(text));
    },
  };
}

/** Single entry point: sanitise first, generate, validate again. */
export async function generateUi(
  rawContext: unknown,
  generator: UiGenerator
): Promise<GeneratedUi> {
  const context = sanitizeContext(rawContext);
  const generated = await generator.generate(context);
  return validateGeneratedUi(generated);
}
