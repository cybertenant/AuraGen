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
  GeneratedAdaptiveUISchema,
  PresentationGoal,
} from "../types/ai.types.js";
import { getGeminiModelConfig } from "../config/model.config.js";
import {
  ContextSummaryOutput,
  SanitizedGenerationContext,
} from "../context/context.types.js";
import { summarizeContextForResponse } from "../context/context-builder.js";
import { sanitizeGenerationContext } from "../context/context-sanitizer.js";

export interface GenerateAdaptiveUIParams {
  formDefinition?: unknown;
  presentationGoal?: PresentationGoal;
  provider?: StructuredUIProvider;
  modelOverride?: string;
}

export interface ContextualAdaptiveUIGenerationResult
  extends AdaptiveUIGenerationResult {
  generationMode: "standard" | "contextual";
  contextSummary?: ContextSummaryOutput;
  adaptationSummary?: string[];
}

function buildObservableAdaptationSummary(
  schema: GeneratedAdaptiveUISchema,
  ctx?: SanitizedGenerationContext
): string[] {
  if (!ctx) {
    return [
      `Organized all 17 canonical fields into ${schema.steps.length} guided wizard steps`,
      `Applied ${schema.appearance.density} layout density with clear step instructions`,
    ];
  }

  const bullets: string[] = [];
  const dominant = ctx.fieldAnalysis.dominantSectionTitle;

  if (ctx.friction.frictionLevel === "low") {
    bullets.push(
      `Maintained a conservative ${schema.steps.length}-step structure aligned with low friction (${Math.round(ctx.friction.smoothedScore)}/100)`
    );
  } else {
    bullets.push(
      `Prioritized simplifying ${dominant} based on ${ctx.friction.frictionLevel} interaction friction (${Math.round(ctx.friction.smoothedScore)}/100)`
    );
  }

  if (ctx.fieldAnalysis.highFrictionFields.length > 0) {
    const fieldNames = ctx.fieldAnalysis.highFrictionFields
      .slice(0, 3)
      .map((f) => f.label)
      .join(", ");
    bullets.push(
      `Added targeted helper guidance for high-friction fields: ${fieldNames}`
    );
  } else if (ctx.fieldAnalysis.precisionLimitationNote) {
    bullets.push(
      `Applied section-level simplification across ${dominant} (${schema.steps.length} total steps)`
    );
  }

  return bullets;
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

export async function generateContextualAdaptiveUI(params: {
  sanitizedContext: SanitizedGenerationContext;
  adaptationGoal?: PresentationGoal;
  provider?: StructuredUIProvider;
  modelOverride?: string;
}): Promise<ContextualAdaptiveUIGenerationResult> {
  const startMs = Date.now();
  const goal: PresentationGoal =
    params.adaptationGoal ?? "simplify_cognitive_load";
  const defaultConfig = getGeminiModelConfig(params.modelOverride);

  try {
    const cleanContext = sanitizeGenerationContext(params.sanitizedContext);
    const provider =
      params.provider ??
      new GeminiLangChainProvider({ model: params.modelOverride });

    const agent = new AdaptiveUIAgent(provider);
    const agentResult = await agent.run({
      sanitizedMetadata: cleanContext.formMetadata,
      presentationGoal: goal,
      sanitizedContext: cleanContext,
    });

    const validation = validateGeneratedAdaptiveUI(
      agentResult.rawCandidateSchema,
      cleanContext.formMetadata
    );

    const generationTimeMs = Math.max(1, Date.now() - startMs);
    const contextSummary = summarizeContextForResponse(cleanContext);

    if (!validation.valid || !validation.schema) {
      return {
        success: false,
        generationMode: "contextual",
        providerType: agentResult.providerType,
        model: agentResult.modelName,
        contextSummary,
        generationTimeMs,
        validationStatus: "invalid",
        schema: null,
        validationErrors: validation.errors,
        errorCode: "SCHEMA_VALIDATION_FAILED",
        errorMessage:
          "Contextual UI schema failed Day 7 structural or canonical field validation.",
        tokenUsage: agentResult.tokenUsage,
      };
    }

    return {
      success: true,
      generationMode: "contextual",
      providerType: agentResult.providerType,
      model: agentResult.modelName,
      contextSummary,
      adaptationSummary: buildObservableAdaptationSummary(
        validation.schema,
        cleanContext
      ),
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
      generationMode: "contextual",
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