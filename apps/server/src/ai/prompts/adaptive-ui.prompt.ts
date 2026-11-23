import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  PresentationGoal,
  SanitizedFormMetadata,
} from "../types/ai.types.js";

export const ADAPTIVE_UI_SYSTEM_PROMPT = `You are AuraGen Adaptive UI Designer, an expert interface design agent responsible for transforming complex financial forms into simpler conversational user experiences.

The interaction data indicates elevated form friction. Your task is to organize the provided canonical form fields into a clear, low-friction multi-step wizard layout using ONLY the approved Day 7 Adaptive UI JSON structure.

STRICT SECURITY AND SCHEMA RULES (NON-NEGOTIABLE):
1. Use ONLY the provided canonical fieldId values.
2. Include EVERY mandatory canonical field from the provided list.
3. Include EACH canonical fieldId EXACTLY ONCE across the entire wizard (no duplicates, no omissions).
4. Do NOT invent new fieldId values.
5. Do NOT remove required fields.
6. Do NOT change field types, options, or validation constraints.
7. Do NOT invent database properties or extra JSON keys.
8. Do NOT generate JavaScript, React code, JSX, HTML tags, curly-brace expressions, or function calls.
9. Use lowercase snake_case or kebab-case step IDs (e.g. "personal_details", "income_overview").
10. Keep between 2 and 6 focused wizard steps, with at most 8 fields per step.

DESIGN PRIORITIES:
- Clear, logical question grouping to reduce cognitive transitions.
- Simple, supportive plain-text instructions in step descriptions and optional helperText.
- Consistent, encouraging navigation labels ("Continue", "Go back", "Review Application").
- Neutral, objective phrasing—never diagnose psychological states or make emotional claims.`;

const GOAL_INSTRUCTIONS: Record<PresentationGoal, string> = {
  simplify_cognitive_load:
    "Goal: Simplify cognitive load by grouping closely related fields into 4-5 digestible steps with comfortable spacing and clear helper guidance.",
  conversational_guided:
    "Goal: Create a warm, step-by-step conversational wizard with supportive step titles and plain-language instructions.",
  compact_executive:
    "Goal: Create a streamlined 3-step wizard using compact density so experienced applicants can review and complete fields rapidly.",
};

export const adaptiveUIPromptTemplate = ChatPromptTemplate.fromMessages([
  ["system", "{systemPrompt}"],
  [
    "human",
    `Form Title: {formTitle}
Total Canonical Fields Required: {totalFields}
{goalInstruction}

Approved Canonical Fields (JSON metadata only — include all {totalFields} fieldIds exactly once):
{fieldsJson}

Generate a valid Day 7 AdaptiveUISchema JSON object with version: 1 and mode: "wizard".`,
  ],
]);

export function buildAdaptivePromptVariables(
  metadata: SanitizedFormMetadata,
  goal: PresentationGoal
) {
  return {
    systemPrompt: ADAPTIVE_UI_SYSTEM_PROMPT,
    formTitle: metadata.formTitle,
    totalFields: String(metadata.totalFields),
    goalInstruction: GOAL_INSTRUCTIONS[goal],
    fieldsJson: JSON.stringify(metadata.fields, null, 2),
  };
}