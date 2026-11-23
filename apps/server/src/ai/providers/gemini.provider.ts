import { resolveBackendGoogleApiKey } from "../../config/env.js";
import { getGeminiModelConfig } from "../config/model.config.js";
import {
  AdaptiveGenerationError,
  classifyProviderError,
} from "../errors/ai.errors.js";
import { logger } from "../../utils/logger.js";

export interface StructuredProviderInput {
  systemPrompt: string;
  humanPrompt: string;
  timeoutMs?: number;
  goal?: string;
  metadata?: unknown;
}

export interface StructuredProviderResponse {
  rawOutput: unknown;
  model?: string;
  providerType?: "gemini_live" | "test_mock";
  latencyMs?: number;
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface StructuredUIProvider {
  readonly providerType: "gemini_live" | "test_mock";
  readonly modelName: string;
  generateStructuredSchema(
    input: StructuredProviderInput
  ): Promise<StructuredProviderResponse>;
}

export interface GeminiProviderOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxRetries?: number;
  timeoutMs?: number;
}

function buildCanonicalTestSchema(input: StructuredProviderInput) {
  // Extract only the friction context block (before the canonical form metadata block)
  const frictionSection =
    input.humanPrompt.split(/CANONICAL|FORM_METADATA|Canonical Form/i)[0] ??
    input.humanPrompt;

  const isFinancial = /financial_information/i.test(frictionSection);
  const isEmployment =
    !isFinancial && /employment_details/i.test(frictionSection);

  const personalStep = {
    id: "step_personal_details",
    title: "Personal Information",
    description: "Applicant contact details.",
    fields: [
      { fieldId: "fullName", helperText: "Enter full legal name." },
      { fieldId: "emailAddress", helperText: "Synthetic contact email." },
      { fieldId: "phoneNumber", helperText: "Primary synthetic phone number." },
      { fieldId: "residencyPostalCode", helperText: "Current residential postal code." },
    ],
  };

  const employmentStep = {
    id: isEmployment ? "employment_simplified_guide" : "step_employment_details",
    title: isEmployment
      ? "Simplified Employment Verification"
      : "Employment Details",
    description: "Current occupation and tenure.",
    fields: [
      { fieldId: "employmentStatus", helperText: "Select current work classification." },
      { fieldId: "employerOrEntityName", helperText: "Legal name of employer or entity." },
      { fieldId: "yearsInCurrentRole", helperText: "Total years in current position." },
    ],
  };

  const financialStep = {
    id: isFinancial ? "financial_income_focus" : "step_financial_details",
    title: isFinancial
      ? "Simplified Financial Overview"
      : "Financial Information",
    description: "Guided breakdown of income, housing, debt, and reserves.",
    fields: [
      { fieldId: "annualIncome", helperText: "Gross annual income before taxes." },
      { fieldId: "monthlyHousingOrLeaseCost", helperText: "Monthly rent or mortgage cost." },
      { fieldId: "existingMonthlyDebtObligations", helperText: "Recurring monthly debt payments." },
      { fieldId: "liquidReservesUsd", helperText: "Available cash and liquid savings." },
    ],
  };

  const loanReviewStep = {
    id: "step_loan_review",
    title: "Loan Terms & Declaration",
    description: "Requested financing terms and synthetic consent.",
    fields: [
      { fieldId: "requestedLoanAmount", helperText: "Requested loan principal in USD." },
      { fieldId: "loanPurpose", helperText: "Primary purpose for this loan." },
      { fieldId: "repaymentTermMonths", helperText: "Preferred repayment duration in months." },
      { fieldId: "collateralType", helperText: "Collateral backing type if applicable." },
      { fieldId: "syntheticDataDeclaration", helperText: "Confirm synthetic test data only." },
      { fieldId: "termsAndCreditCheckConsent", helperText: "Confirm consent to simulated review." },
    ],
  };

  const orderedSteps = isFinancial
    ? [financialStep, personalStep, employmentStep, loanReviewStep]
    : isEmployment
      ? [employmentStep, personalStep, financialStep, loanReviewStep]
      : [personalStep, employmentStep, financialStep, loanReviewStep];

  return {
    version: 1 as const,
    mode: "wizard" as const,
    title: "Guided Loan Application Wizard",
    description: "Context-adapted multi-step flow reducing cognitive load.",
    steps: orderedSteps,
    navigation: {
      nextLabel: "Continue",
      previousLabel: "Back",
      submitLabel: "Submit Application",
    },
    appearance: {
      density: "comfortable" as const,
      showProgress: true,
    },
  };
}

/**
 * Live Google Gemini generation provider using structured JSON output (`responseMimeType: "application/json"`).
 * Keeps API keys strictly in backend memory and never logs prompts or credentials.
 */
export class GeminiLangChainProvider implements StructuredUIProvider {
  public readonly providerType = "gemini_live" as const;
  public readonly modelName: string;
  private readonly apiKey: string;
  private readonly temperature: number;
  private readonly maxOutputTokens: number;
  private readonly maxRetries: number;
  private readonly defaultTimeoutMs: number;

  constructor(options: GeminiProviderOptions = {}) {
    const resolvedKey =
      options.apiKey !== undefined ? options.apiKey : resolveBackendGoogleApiKey();
    if (!resolvedKey || resolvedKey.trim().length === 0) {
      throw new AdaptiveGenerationError(
        "MISSING_API_KEY",
        "Google Gemini API key is not configured on the server.",
        503,
        false
      );
    }

    const modelCfg = getGeminiModelConfig(options.model);
    this.apiKey = resolvedKey;
    this.modelName = modelCfg.model;
    this.temperature = options.temperature ?? modelCfg.temperature;
    this.maxOutputTokens = options.maxOutputTokens ?? modelCfg.maxOutputTokens;
    this.maxRetries = Math.max(options.maxRetries ?? modelCfg.maxRetries, 2);
    this.defaultTimeoutMs = options.timeoutMs ?? modelCfg.timeoutMs;
  }

  public async generateStructuredSchema(
    input: StructuredProviderInput
  ): Promise<StructuredProviderResponse> {
    const startMs = Date.now();
    const timeoutMs = input.timeoutMs ?? this.defaultTimeoutMs;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.modelName
    )}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    let lastError: unknown;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: input.systemPrompt }],
            },
            contents: [
              {
                role: "user",
                parts: [{ text: input.humanPrompt }],
              },
            ],
            generationConfig: {
              temperature: this.temperature,
              maxOutputTokens: this.maxOutputTokens,
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                required: [
                  "version",
                  "mode",
                  "title",
                  "steps",
                  "navigation",
                  "appearance",
                ],
                properties: {
                  version: { type: "INTEGER" },
                  mode: { type: "STRING" },
                  title: { type: "STRING" },
                  description: { type: "STRING" },
                  steps: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      required: ["id", "title", "fields"],
                      properties: {
                        id: { type: "STRING" },
                        title: { type: "STRING" },
                        description: { type: "STRING" },
                        fields: {
                          type: "ARRAY",
                          items: {
                            type: "OBJECT",
                            required: ["fieldId"],
                            properties: {
                              fieldId: { type: "STRING" },
                              helperText: { type: "STRING" },
                              placeholder: { type: "STRING" },
                            },
                          },
                        },
                      },
                    },
                  },
                  navigation: {
                    type: "OBJECT",
                    required: ["nextLabel", "previousLabel", "submitLabel"],
                    properties: {
                      nextLabel: { type: "STRING" },
                      previousLabel: { type: "STRING" },
                      submitLabel: { type: "STRING" },
                    },
                  },
                  appearance: {
                    type: "OBJECT",
                    required: ["density", "showProgress"],
                    properties: {
                      density: {
                        type: "STRING",
                        enum: ["comfortable", "compact"],
                      },
                      showProgress: { type: "BOOLEAN" },
                    },
                  },
                },
              },
            },
          }),
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const payload = (await response.json()) as {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        };

        const rawText =
          payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const parsedOutput = JSON.parse(rawText);

        return {
          rawOutput: parsedOutput,
          model: this.modelName,
          providerType: this.providerType,
          latencyMs: Date.now() - startMs,
          ...(payload.usageMetadata
            ? {
                tokenUsage: {
                  promptTokens: payload.usageMetadata.promptTokenCount,
                  completionTokens: payload.usageMetadata.candidatesTokenCount,
                  totalTokens: payload.usageMetadata.totalTokenCount,
                },
              }
            : {}),
        };
      } catch (err) {
        lastError = err;
        const classified = classifyProviderError(err);
        if (!classified.isRetryable || attempt >= this.maxRetries) {
          logger.error("Gemini live structured generation failed", {
            model: this.modelName,
            errorCode: classified.code,
            httpStatus: classified.httpStatus,
            attempt: attempt + 1,
          });
          throw classified;
        }
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      }
    }

    throw classifyProviderError(lastError);
  }
}

/**
 * Deterministic test provider for unit and API integration tests without external network calls.
 */
export class DeterministicTestUIProvider implements StructuredUIProvider {
  public readonly providerType = "test_mock" as const;
  public readonly modelName = "deterministic-test-provider";
  private readonly customOutput?: unknown | ((input: StructuredProviderInput) => unknown);
  private readonly forceError?: Error;

  constructor(options?: {
    customOutput?: unknown | ((input: StructuredProviderInput) => unknown);
    forceError?: Error;
  }) {
    this.customOutput = options?.customOutput;
    this.forceError = options?.forceError;
  }

  public async generateStructuredSchema(
    input: StructuredProviderInput
  ): Promise<StructuredProviderResponse> {
    const startMs = Date.now();
    if (this.forceError) {
      throw this.forceError;
    }

    const rawOutput =
      typeof this.customOutput === "function"
        ? (this.customOutput as (i: StructuredProviderInput) => unknown)(input)
        : this.customOutput ?? buildCanonicalTestSchema(input);

    return {
      rawOutput,
      model: this.modelName,
      providerType: this.providerType,
      latencyMs: Date.now() - startMs,
    };
  }
}