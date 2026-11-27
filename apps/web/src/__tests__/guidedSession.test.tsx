import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GuidedSessionPanel } from "@/components/guided/GuidedSessionPanel";
import {
  GuidedSessionSchema,
  SanitizedGuidedContextSchema,
  buildSanitizedGuidedContext,
  type GuidedSession,
} from "@/components/guided/guided-session.contract";

const SESSION_ID = "6f0c1d2e-8b4a-4c31-9f5d-2a7e6c1b90d4";

function createValidSession(): GuidedSession {
  return GuidedSessionSchema.parse({
    id: SESSION_ID,
    title: "Simplified loan application",
    frictionLevel: "high",
    frictionScore: 78,
    steps: [
      {
        id: "step-income",
        fieldId: "annualIncome",
        title: "What is your approximate annual income?",
        helperText: "A rounded estimate is fine.",
        component: "number",
      },
      {
        id: "step-purpose",
        fieldId: "loanPurpose",
        title: "What will the loan be used for?",
        component: "select",
        options: [
          { value: "working_capital", label: "Working capital" },
          { value: "debt_refinancing", label: "Debt refinancing" },
        ],
      },
    ],
  });
}

describe("guided session contract guardrails", () => {
  it("accepts a well-formed structured session", () => {
    expect(createValidSession().steps).toHaveLength(2);
  });

  it("rejects unknown keys that could smuggle values into a schema", () => {
    const session = createValidSession();
    const result = GuidedSessionSchema.safeParse({
      ...session,
      formData: { annualIncome: 145000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects components outside the approved registry", () => {
    const session = createValidSession();
    const result = GuidedSessionSchema.safeParse({
      ...session,
      steps: [{ ...session.steps[0], component: "script" }],
    });
    expect(result.success).toBe(false);
  });

  it("builds an AI context containing field IDs but no answers", () => {
    const context = buildSanitizedGuidedContext(createValidSession(), 1);
    expect(SanitizedGuidedContextSchema.safeParse(context).success).toBe(true);
    expect(context.fieldIds).toEqual(["annualIncome", "loanPurpose"]);
    expect(JSON.stringify(context)).not.toContain("145000");
    expect(Object.keys(context).sort()).toEqual([
      "fieldIds",
      "frictionLevel",
      "frictionScore",
      "sessionId",
      "visibleStepIndex",
    ]);
  });
});

describe("GuidedSessionPanel", () => {
  it("renders one approved step at a time and completes the flow", () => {
    render(<GuidedSessionPanel session={createValidSession()} />);

    expect(screen.getByTestId("guided-field-annualIncome")).toBeInTheDocument();
    expect(screen.queryByTestId("guided-field-loanPurpose")).toBeNull();

    fireEvent.change(screen.getByTestId("guided-field-annualIncome"), {
      target: { value: "145000" },
    });
    fireEvent.click(screen.getByTestId("guided-next"));

    expect(screen.getByTestId("guided-field-loanPurpose")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("guided-next"));

    expect(screen.getByTestId("guided-complete")).toBeInTheDocument();
    expect(screen.getByTestId("guided-complete")).toHaveTextContent(
      "1 of 2 answers captured locally"
    );
  });

  it("fails closed when the schema is invalid", () => {
    const session = createValidSession();
    const invalidSession = {
      ...session,
      steps: [{ ...session.steps[0], component: "dangerousHtml" }],
    } as unknown as GuidedSession;

    render(<GuidedSessionPanel session={invalidSession} />);
    expect(screen.getByTestId("guided-invalid-session")).toBeInTheDocument();
    expect(screen.queryByTestId("guided-session-panel")).toBeNull();
  });
});
