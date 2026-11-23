import {
  adaptiveUIPromptTemplate,
  buildAdaptivePromptVariables,
} from "../prompts/adaptive-ui.prompt.js";
import { StructuredUIProvider } from "../providers/gemini.provider.js";
import {
  PresentationGoal,
  SanitizedFormMetadata,
  TokenUsageSummary,
} from "../types/ai.types.js";
import { SanitizedGenerationContext } from "../context/context.types.js";

export class AdaptiveUIAgent {
  constructor(private readonly provider: StructuredUIProvider) {}

  async run(input: {
    sanitizedMetadata: SanitizedFormMetadata;
    presentationGoal: PresentationGoal;
    sanitizedContext?: SanitizedGenerationContext;
  }): Promise<{
    rawCandidateSchema: unknown;
    tokenUsage?: TokenUsageSummary;
    providerType: "gemini_live" | "test_mock";
    modelName: string;
  }> {
    const vars = buildAdaptivePromptVariables(
      input.sanitizedMetadata,
      input.presentationGoal,
      input.sanitizedContext
    );

    const formattedMessages = await adaptiveUIPromptTemplate.formatMessages(
      vars
    );

    const systemPrompt = String(formattedMessages[0]?.content ?? "");
    const humanPrompt = String(formattedMessages[1]?.content ?? "");

    const { rawOutput, tokenUsage } =
      await this.provider.generateStructuredSchema({
        systemPrompt,
        humanPrompt,
        metadata: input.sanitizedMetadata,
        goal: input.presentationGoal,
      });

    return {
      rawCandidateSchema: rawOutput,
      tokenUsage,
      providerType: this.provider.providerType,
      modelName: this.provider.modelName,
    };
  }
}