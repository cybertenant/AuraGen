import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialLoanApplicationForm } from "../components/persistence/FinancialLoanApplicationForm";
import { ADAPTIVE_DEVELOPMENT_FIXTURES } from "../components/adaptive-ui/fixtures/adaptive-fixtures";

describe("Day 8 & 9: Frontend Adaptive UI Studio & Contextual Generation Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1–6. runs contextual simulation scenario, displays adaptation summary, preserves form values, and keeps fixtures working", async () => {
    const validGeneratedSchema = {
      ...ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema,
      title: "Contextual Financial Clarity Wizard",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        generationMode: "contextual",
        providerType: "test_mock",
        model: "gemini-2.5-flash",
        generationTimeMs: 390,
        validationStatus: "valid",
        persisted: true,
        contextSummary: {
          currentSection: "financial_information",
          dominantFrictionArea: "financial_information",
          frictionLevel: "high",
          smoothedScore: 78,
          source: "simulated_dev_scenario",
          simulationScenarioId: "financial_information_friction",
          highFrictionFieldIds: ["annualIncome", "existingMonthlyDebtObligations"],
        },
        adaptationSummary: [
          "Prioritized simplifying Financial Information based on high interaction friction (78/100)",
          "Added targeted helper guidance for high-friction fields: Gross Annual Income (USD)",
        ],
        schema: validGeneratedSchema,
      }),
    } as Response);

    render(
      <FinancialLoanApplicationForm
        sessionId="11111111-1111-4111-8111-111111111111"
        latestFrictionScore={78}
        onSaveDraft={vi.fn()}
      />
    );

    // Enter a value in the original 5-section form first
    const originalName = screen.getByLabelText(
      /Full Legal Name/i
    ) as HTMLInputElement;
    fireEvent.change(originalName, { target: { value: "Sophia Lindqvist" } });

    // Select Scenario 1: Financial Info Friction
    fireEvent.change(screen.getByTestId("contextual-scenario-select"), {
      target: { value: "financial_information_friction" },
    });

    // Click "Generate Adaptive Layout"
    fireEvent.click(screen.getByTestId("generate-adaptive-layout-btn"));

    await waitFor(() => {
      expect(
        screen.getByTestId("ai-generation-status-badge")
      ).toHaveTextContent("Generated");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByTestId("dominant-friction-area-value")
    ).toHaveTextContent("financial_information");
    expect(screen.getByTestId("adaptation-summary-list")).toHaveTextContent(
      /Prioritized simplifying Financial Information/i
    );
    expect(screen.getByTestId("adaptive-wizard-title")).toHaveTextContent(
      "Contextual Financial Clarity Wizard"
    );

    // Form value entered before AI generation is preserved!
    expect(
      (screen.getByTestId("adaptive-input-fullName") as HTMLInputElement).value
    ).toBe("Sophia Lindqvist");

    // Manual development fixtures continue working seamlessly
    fireEvent.click(screen.getByTestId("select-fixture-compact_wizard"));
    expect(screen.getByTestId("adaptive-wizard-title")).toHaveTextContent(
      "Compact Financial Application"
    );
  });

  it("safely rejects failed AI generation and keeps the original form untouched", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({
        success: false,
        errorCode: "MISSING_API_KEY",
        errorMessage: "Google Gemini API key is not configured on the server.",
      }),
    } as Response);

    render(
      <FinancialLoanApplicationForm
        sessionId="11111111-1111-4111-8111-111111111111"
        onSaveDraft={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("generate-adaptive-layout-btn"));

    await waitFor(() => {
      expect(
        screen.getByTestId("ai-generation-status-badge")
      ).toHaveTextContent("API Unavailable");
    });

    // Original 5-section form remains intact and accessible
    expect(screen.getByLabelText(/Full Legal Name/i)).toBeInTheDocument();
  });
});