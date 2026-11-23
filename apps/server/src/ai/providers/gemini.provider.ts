import { ChatGoogle } from "@langchain/google";
import { resolveBackendGoogleApiKey } from "../../config/env.js";
import { getGeminiModelConfig } from "../config/model.config.js";
import {
  AdaptiveGenerationError,
  classifyProviderError,
} from "../errors/ai.errors.js";
import { GeneratedAdaptiveUISchemaZod } from "../schemas/generation.schema.js";
import {
  GeneratedAdaptiveUISchema,
  PresentationGoal,
  SanitizedFormMetadata,
  TokenUsageSummary,
} from "../types/ai.types.js";

export interface StructuredUIProvider {
  readonly providerType: "gemini_live" | "test_mock";
  readonly modelName: string;
  generateStructuredSchema(input: {
    systemPrompt: string;
    humanPrompt: string;
    metadata: SanitizedFormMetadata;
    goal: PresentationGoal;
  }): Promise<{
    rawOutput: unknown;
    tokenUsage?: TokenUsageSummary;
  }>;
}

/**
 * Production Google Gemini Provider using `@langchain/google` (`ChatGoogle`)
 * with native structured output (`withStructuredOutput`).
 */
export class GeminiLangChainProvider implements StructuredUIProvider {
  public readonly providerType = "gemini_live" as const;
  public readonly modelName: string;
  private readonly apiKey: string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options?: { apiKey?: string; model?: string }) {
    const config = getGeminiModelConfig(options?.model);
    const resolvedKey = options?.apiKey ?? resolveBackendGoogleApiKey();

    if (!resolvedKey) {
      throw new AdaptiveGenerationError(
        "MISSING_API_KEY",
        "Google Gemini API key is not configured on the server (set GOOGLE_API_KEY).",
        503,
        false
      );
    }

    this.apiKey = resolvedKey;
    this.modelName = config.model;
    this.temperature = config.temperature;
    this.maxOutputTokens = config.maxOutputTokens;
    this.timeoutMs = config.timeoutMs;
    this.maxRetries = config.maxRetries;
  }

  async generateStructuredSchema(input: {
    systemPrompt: string;
    humanPrompt: string;
    metadata: SanitizedFormMetadata;
    goal: PresentationGoal;
  }): Promise<{ rawOutput: unknown; tokenUsage?: TokenUsageSummary }> {
    try {
      const llm = new ChatGoogle({
        apiKey: this.apiKey,
        model: this.modelName,
        temperature: this.temperature,
        maxOutputTokens: this.maxOutputTokens,
        maxRetries: this.maxRetries,
      });

      const structuredLlm = llm.withStructuredOutput(
        GeneratedAdaptiveUISchemaZod,
        {
          name: "auragen_adaptive_ui_wizard",
          includeRaw: true,
        }
      );

      const response = await structuredLlm.invoke(
        [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.humanPrompt },
        ],
        {
          signal: AbortSignal.timeout(this.timeoutMs),
        }
      );

      const usage = (
        response.raw as {
          usage_metadata?: {
            input_tokens?: number;
            output_tokens?: number;
            total_tokens?: number;
          };
        }
      )?.usage_metadata;

      return {
        rawOutput: response.parsed,
        tokenUsage: usage
          ? {
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      throw classifyProviderError(err);
    }
  }
}

/**
 * Explicit Deterministic Test Provider for automated tests when no live API key is used.
 * Clearly tagged as `providerType: "test_mock"` so it is never confused with real Gemini generation.
 */
export class DeterministicTestUIProvider implements StructuredUIProvider {
  public readonly providerType = "test_mock" as const;
  public readonly modelName: string;

  constructor(modelName = "gemini-2.5-flash-test-provider") {
    this.modelName = modelName;
  }

  async generateStructuredSchema(input: {
    systemPrompt: string;
    humanPrompt: string;
    metadata: SanitizedFormMetadata;
    goal: PresentationGoal;
  }): Promise<{ rawOutput: GeneratedAdaptiveUISchema; tokenUsage?: TokenUsageSummary }> {
    const bySection = new Map<string, typeof input.metadata.fields[number][]>();
    for (const f of input.metadata.fields) {
      const list = bySection.get(f.originalSectionId) ?? [];
      list.push(f);
      bySection.set(f.originalSectionId, list);
    }

    const steps = Array.from(bySection.entries()).map(([sectionId, fields]) => ({
      id: sectionId,
      title: `Guided ${fields[0]?.originalSectionTitle ?? sectionId}`,
      description: `Simplified step grouping for ${fields.length} required fields.`,
      fields: fields.map((f) => ({
        fieldId: f.fieldId,
        helperText: `Provide your ${f.label.toLowerCase()}.`,
      })),
    }));

    return {
      rawOutput: {
        version: 1,
        mode: "wizard",
        title: "Guided Financial Application Wizard",
        description:
          "Generated in deterministic test-provider mode using canonical field metadata.",
        steps,
        navigation: {
          nextLabel: "Continue",
          previousLabel: "Go back",
          submitLabel: "Review & Save Draft",
        },
        appearance: {
          density:
            input.goal === "compact_executive" ? "compact" : "comfortable",
          showProgress: true,
        },
      },
      tokenUsage: {
        inputTokens: 320,
        outputTokens: 410,
        totalTokens: 730,
      },
    };
  }
}