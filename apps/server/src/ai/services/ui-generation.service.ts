import {
  SERVER_CANONICAL_LOAN_METADATA,
  sanitizeFormMetadataForAI,
} from "../canonical/canonical-loan-metadata.js";
import {
  GeminiLangChainProvider,
  StructuredUIProvider,
} from "../providers/gemini.provider.js";
import { AdaptiveUIAgent } from "../agents/adaptive-ui.agent.js";
import { validateGeneratedAdaptiveUI } from "../validators/generated-ui.validator.js";
import { classifyProviderError } from "../errors/ai.errors.js";
import {
  AdaptiveUIGenerationResult,
  PresentationGoal,
} from "../types/ai.types.js";
import { getGeminiModelConfig } from "../config/model.config.js";

export interface GenerateAdaptiveUIParams {
  formDefinition?: unknown;
  presentationGoal?: PresentationGoal;
  provider?: StructuredUIProvider;
  modelOverride?: string;
}

export async function generateAdaptiveUI(
  params: GenerateAdaptiveUIParams = {}
): Promise<AdaptiveUIGenerationResult> {
  const startMs = Date.now();
  const goal: PresentationGoal =
    params.presentationGoal ?? "simplify_cognitive_load";
  const sanitizedMetadata = sanitizeFormMetadataForAI(
    params.formDefinition ?? SERVER_CANONICAL_LOAN_METADATA
  );

  const defaultConfig = getGeminiModelConfig(params.modelOverride);

  try {
    const provider =
      params.provider ??
      new GeminiLangChainProvider({ model: params.modelOverride });

    const agent = new AdaptiveUIAgent(provider);
    const agentResult = await agent.run({
      sanitizedMetadata,
      presentationGoal: goal,
    });

    const validation = validateGeneratedAdaptiveUI(
      agentResult.rawCandidateSchema,
      sanitizedMetadata
    );

    const generationTimeMs = Math.max(1, Date.now() - startMs);

    if (!validation.valid || !validation.schema) {
      return {
        success: false,
        providerType: agentResult.providerType,
        model: agentResult.modelName,
        generationTimeMs,
        validationStatus: "invalid",
        schema: null,
        validationErrors: validation.errors,
        errorCode: "SCHEMA_VALIDATION_FAILED",
        errorMessage:
          "Generated UI schema failed Day 7 structural or canonical field validation.",
        tokenUsage: agentResult.tokenUsage,
      };
    }

    return {
      success: true,
      providerType: agentResult.providerType,
      model: agentResult.modelName,
      generationTimeMs,
      validationStatus: "valid",
      schema: validation.schema,
      tokenUsage: agentResult.tokenUsage,
    };
  } catch (err) {
    const generationTimeMs = Math.max(1, Date.now() - startMs);
    const classified = classifyProviderError(err);
    return {
      success: false,
      providerType: params.provider?.providerType ?? "gemini_live",
      model: params.provider?.modelName ?? defaultConfig.model,
      generationTimeMs,
      validationStatus: "invalid",
      schema: null,
      errorCode: classified.code,
      errorMessage: classified.message,
    };
  }
}