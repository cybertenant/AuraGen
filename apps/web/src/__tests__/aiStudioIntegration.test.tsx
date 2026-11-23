import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinancialLoanApplicationForm } from "../components/persistence/FinancialLoanApplicationForm";
import { ADAPTIVE_DEVELOPMENT_FIXTURES } from "../components/adaptive-ui/fixtures/adaptive-fixtures";

describe("Day 8: Frontend Adaptive UI Studio & Gemini Generation Integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1–6. invokes backend generator, renders valid AI schema, preserves form values, and keeps manual fixtures working", async () => {
    const validGeneratedSchema = {
      ...ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema,
      title: "AI Simplified Loan Application Wizard",
    };

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        providerType: "test_mock",
        model: "gemini-2.5-flash",
        generationTimeMs: 420,
        validationStatus: "valid",
        persisted: true,
        schema: validGeneratedSchema,
      }),
    } as Response);

    render(
      <FinancialLoanApplicationForm
        sessionId="11111111-1111-4111-8111-111111111111"
        latestFrictionScore={74}
        onSaveDraft={vi.fn()}
      />
    );

    // Enter a value in the original 5-section form first
    const originalName = screen.getByLabelText(
      /Full Legal Name/i
    ) as HTMLInputElement;
    fireEvent.change(originalName, { target: { value: "Sophia Lindqvist" } });

    // Click "Generate Adaptive Layout"
    fireEvent.click(screen.getByTestId("generate-adaptive-layout-btn"));

    await waitFor(() => {
      expect(
        screen.getByTestId("ai-generation-status-badge")
      ).toHaveTextContent("Generated");
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("adaptive-wizard-title")).toHaveTextContent(
      "AI Simplified Loan Application Wizard"
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

  it("4. safely rejects invalid AI output and keeps the original form untouched", async () => {
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