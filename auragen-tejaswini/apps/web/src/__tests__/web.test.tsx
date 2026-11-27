import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  GeneratedUiSchema,
  type GeneratedField,
  type GeneratedUi,
} from "@tejaswini/shared";
import { ApprovedFieldRenderer } from "@/components/ApprovedFieldRenderer";
import { GuidedView } from "@/components/GuidedView";

function makeField(component: GeneratedField["component"]): GeneratedField {
  return GeneratedUiSchema.parse({
    schemaVersion: 1,
    sessionId: "session-123",
    steps: [
      {
        id: "step-1",
        title: "Step one",
        fields: [
          {
            id: "annualIncome",
            label: "Annual income",
            component,
            ...(component === "select"
              ? {
                  options: [
                    { value: "working_capital", label: "Working capital" },
                  ],
                }
              : {}),
          },
        ],
      },
    ],
  }).steps[0].fields[0];
}

function makeUi(): GeneratedUi {
  return GeneratedUiSchema.parse({
    schemaVersion: 1,
    sessionId: "session-123",
    steps: [
      {
        id: "step-income",
        title: "What is your income?",
        fields: [
          { id: "annualIncome", label: "Annual income", component: "number" },
        ],
      },
      {
        id: "step-purpose",
        title: "What is the purpose?",
        fields: [
          {
            id: "loanPurpose",
            label: "Loan purpose",
            component: "select",
            options: [{ value: "working_capital", label: "Working capital" }],
          },
        ],
      },
    ],
  });
}

describe("ApprovedFieldRenderer", () => {
  it("renders only approved, safe controls", () => {
    const onChange = vi.fn();
    render(
      <ApprovedFieldRenderer field={makeField("number")} onChange={onChange} />
    );
    const input = screen.getByTestId("field-annualIncome");
    expect(input).toHaveAttribute("type", "number");
    fireEvent.change(input, { target: { value: "145000" } });
    expect(onChange).toHaveBeenCalledWith("145000");
  });

  it("renders select options and checkbox state", () => {
    const { rerender } = render(
      <ApprovedFieldRenderer field={makeField("select")} onChange={vi.fn()} />
    );
    expect(screen.getByRole("option", { name: "Working capital" })).toBeInTheDocument();

    rerender(
      <ApprovedFieldRenderer
        field={makeField("checkbox")}
        value={true}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByTestId("field-annualIncome")).toBeChecked();
  });
});

describe("GuidedView guardrails", () => {
  it("validates the schema and fails closed for unknown components", () => {
    const unsafe = {
      ...makeUi(),
      steps: [
        {
          ...makeUi().steps[0],
          fields: [{ id: "x", label: "x", component: "script" }],
        },
      ],
    };
    render(<GuidedView rawUi={unsafe} />);
    expect(screen.getByTestId("guided-rejected")).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
  });

  it("walks through steps and keeps answers in browser state", () => {
    render(<GuidedView rawUi={makeUi()} />);
    expect(screen.getByTestId("field-annualIncome")).toBeInTheDocument();
    expect(screen.queryByTestId("field-loanPurpose")).toBeNull();

    fireEvent.change(screen.getByTestId("field-annualIncome"), {
      target: { value: "145000" },
    });
    fireEvent.click(screen.getByTestId("guided-next"));

    expect(screen.getByTestId("field-loanPurpose")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("guided-next"));

    expect(screen.getByTestId("guided-complete")).toHaveTextContent(
      "1 answers captured locally"
    );
  });
});
