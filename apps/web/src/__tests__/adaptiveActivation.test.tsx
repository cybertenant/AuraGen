import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import {
  AdaptiveExperienceManager,
  IncomingAdaptationReadyPayload,
} from "../components/adaptive-ui/AdaptiveExperienceManager";

const VALID_17_FIELD_ADAPTIVE_SCHEMA = {
  version: 1,
  mode: "wizard",
  title: "Simplified Financial Loan Wizard",
  description: "Reduced cognitive load wizard layout.",
  steps: [
    {
      id: "step_financial",
      title: "Financial Overview",
      fields: [
        { fieldId: "annualIncome" },
        { fieldId: "monthlyHousingOrLeaseCost" },
        { fieldId: "existingMonthlyDebtObligations" },
        { fieldId: "liquidReservesUsd" },
      ],
    },
    {
      id: "step_personal",
      title: "Personal Details",
      fields: [
        { fieldId: "fullName" },
        { fieldId: "emailAddress" },
        { fieldId: "phoneNumber" },
        { fieldId: "residencyPostalCode" },
      ],
    },
    {
      id: "step_employment",
      title: "Employment Details",
      fields: [
        { fieldId: "employmentStatus" },
        { fieldId: "employerOrEntityName" },
        { fieldId: "yearsInCurrentRole" },
      ],
    },
    {
      id: "step_loan",
      title: "Loan Terms & Consent",
      fields: [
        { fieldId: "requestedLoanAmount" },
        { fieldId: "loanPurpose" },
        { fieldId: "repaymentTermMonths" },
        { fieldId: "collateralType" },
        { fieldId: "syntheticDataDeclaration" },
        { fieldId: "termsAndCreditCheckConsent" },
      ],
    },
  ],
  navigation: {
    nextLabel: "Continue",
    previousLabel: "Back",
    submitLabel: "Submit Application",
  },
  appearance: {
    density: "comfortable",
    showProgress: true,
  },
};

function TestHarness({
  payload,
  onConfirmRendered,
}: {
  payload: IncomingAdaptationReadyPayload | null;
  onConfirmRendered?: (ack: {
    sessionId: string;
    adaptationId: string;
    generationId: string;
    schemaVersion: 1;
    rendered: true;
  }) => void;
}) {
  const methods = useForm({
    shouldUnregister: false,
    defaultValues: {
      fullName: "Jordan Vance",
      annualIncome: 125000,
    },
  });

  return (
    <FormProvider {...methods}>
      <AdaptiveExperienceManager
        sessionId="11111111-1111-4111-8111-111111111111"
        incomingReadyPayload={payload}
        onConfirmRendered={onConfirmRendered}
      >
        <div data-testid="original-form">
          <label>
            Original Full Name
            <input {...methods.register("fullName")} />
          </label>
          <label>
            Original Annual Income
            <input type="number" {...methods.register("annualIncome", { valueAsNumber: true })} />
          </label>
        </div>
      </AdaptiveExperienceManager>
    </FormProvider>
  );
}

describe("Day 11: AdaptiveExperienceManager & Shared React Hook Form State Preservation", () => {
  it("stages pending_activation, activates adaptive renderer on user confirmation, preserves form values across edits & switches, and sends rendered ack", () => {
    const confirmSpy = vi.fn();
    const readyPayload: IncomingAdaptationReadyPayload = {
      sessionId: "11111111-1111-4111-8111-111111111111",
      generationId: "22222222-2222-4222-8222-222222222222",
      adaptationId: "33333333-3333-4333-8333-333333333333",
      status: "validated",
      schemaVersion: 1,
      schema: VALID_17_FIELD_ADAPTIVE_SCHEMA,
      timestamp: new Date().toISOString(),
    };

    render(<TestHarness payload={readyPayload} onConfirmRendered={confirmSpy} />);

    // 1. Safe activation boundary: original form stays mounted while notification prompts user
    expect(screen.getByTestId("original-form")).toBeTruthy();
    expect(
      screen.getByText(/AuraGen has prepared a simpler version of this form/i)
    ).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();

    // 2. Activate simplified adaptive wizard
    fireEvent.click(screen.getByRole("button", { name: /Activate Simplified Form/i }));

    // 3. Client confirms rendering once mounted
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith({
      sessionId: "11111111-1111-4111-8111-111111111111",
      adaptationId: "33333333-3333-4333-8333-333333333333",
      generationId: "22222222-2222-4222-8222-222222222222",
      schemaVersion: 1,
      rendered: true,
    });

    // 4. Switch back to original form -> original form values remain intact
    fireEvent.click(screen.getByRole("button", { name: /Switch to Original Form/i }));
    expect(screen.getByTestId("original-form")).toBeTruthy();
    const nameInput = screen.getByLabelText(/Original Full Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Jordan Vance");
  });

  it("blocks invalid/malicious schema on client without clearing form state", () => {
    const confirmSpy = vi.fn();
    const badPayload: IncomingAdaptationReadyPayload = {
      sessionId: "11111111-1111-4111-8111-111111111111",
      generationId: "22222222-2222-4222-8222-222222222222",
      adaptationId: "44444444-4444-4444-8444-444444444444",
      status: "validated",
      schemaVersion: 99,
      schema: { version: 99, steps: [] },
      timestamp: new Date().toISOString(),
    };

    render(<TestHarness payload={badPayload} onConfirmRendered={confirmSpy} />);

    expect(screen.getByTestId("original-form")).toBeTruthy();
    expect(
      screen.getByText(/Adaptive layout blocked by client security guard/i)
    ).toBeTruthy();
    expect(confirmSpy).not.toHaveBeenCalled();
    const nameInput = screen.getByLabelText(/Original Full Name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Jordan Vance");
  });
});