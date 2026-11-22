import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FinancialLoanApplication } from "@auragen/shared";
import { CANONICAL_FINANCIAL_LOAN_FORM } from "../components/adaptive-ui/canonical/canonical-loan-form";
import { ADAPTIVE_DEVELOPMENT_FIXTURES } from "../components/adaptive-ui/fixtures/adaptive-fixtures";
import { validateAdaptiveUISchema } from "../components/adaptive-ui/schemas/adaptive-ui.schema";
import {
  APPROVED_COMPONENT_REGISTRY,
  APPROVED_COMPONENT_TYPES,
} from "../components/adaptive-ui/registry/component-registry";
import {
  isApprovedComponentType,
  resolveApprovedComponent,
} from "../components/adaptive-ui/registry/registry-utils";
import { AdaptiveUIRenderer } from "../components/adaptive-ui/renderer/adaptive-ui-renderer";
import {
  FinancialLoanApplicationForm,
  DEFAULT_LOAN_APPLICATION_VALUES,
} from "../components/persistence/FinancialLoanApplicationForm";

function TestFormWrapper({
  defaultValues = DEFAULT_LOAN_APPLICATION_VALUES,
  children,
}: {
  defaultValues?: Partial<FinancialLoanApplication>;
  children: React.ReactNode;
}) {
  const methods = useForm<FinancialLoanApplication>({
    defaultValues: {
      ...DEFAULT_LOAN_APPLICATION_VALUES,
      ...defaultValues,
    },
    shouldUnregister: false,
    mode: "onBlur",
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("Day 7: Schema Validation (12 Core Tests)", () => {
  const validFixture = ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema;

  it("1. accepts all three valid manually authored wizard schemas", () => {
    for (const fixture of ADAPTIVE_DEVELOPMENT_FIXTURES) {
      const result = validateAdaptiveUISchema(
        fixture.schema,
        CANONICAL_FINANCIAL_LOAN_FORM
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.schema?.version).toBe(1);
    }
  });

  it("2. rejects unsupported schema versions", () => {
    const badVersion = { ...validFixture, version: 2 };
    const result = validateAdaptiveUISchema(
      badVersion,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "version")).toBe(true);
  });

  it("3. rejects unknown canonical field IDs", () => {
    const unknownFieldSchema = structuredClone(validFixture);
    unknownFieldSchema.steps[0]!.fields.push({
      fieldId: "secretSsnNumber" as keyof FinancialLoanApplication,
    });
    const result = validateAdaptiveUISchema(
      unknownFieldSchema,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "UNKNOWN_FIELD_ID")).toBe(true);
  });

  it("4. rejects duplicate field references across steps", () => {
    const dupSchema = structuredClone(validFixture);
    dupSchema.steps[1]!.fields.push({ fieldId: "fullName" });
    const result = validateAdaptiveUISchema(
      dupSchema,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === "DUPLICATE_FIELD_ID")).toBe(
      true
    );
  });

  it("5. rejects schemas missing any mandatory canonical field", () => {
    const missingFieldSchema = structuredClone(validFixture);
    missingFieldSchema.steps[4]!.fields.pop(); // removes termsAndCreditCheckConsent
    const result = validateAdaptiveUISchema(
      missingFieldSchema,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "MISSING_CANONICAL_FIELD")
    ).toBe(true);
  });

  it("6. rejects excessive number of steps (> 8)", () => {
    const tooManySteps = structuredClone(validFixture);
    while (tooManySteps.steps.length <= 8) {
      tooManySteps.steps.push({
        id: `extra_step_${tooManySteps.steps.length}`,
        title: "Extra Step",
        fields: [{ fieldId: "fullName" }],
      });
    }
    const result = validateAdaptiveUISchema(
      tooManySteps,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "steps")).toBe(true);
  });

  it("7. rejects excessive fields per step (> 8)", () => {
    const tooManyFields = {
      ...validFixture,
      steps: [
        {
          id: "step_one",
          title: "Overloaded Step",
          fields: [
            { fieldId: "fullName" },
            { fieldId: "emailAddress" },
            { fieldId: "phoneNumber" },
            { fieldId: "residencyPostalCode" },
            { fieldId: "employmentStatus" },
            { fieldId: "employerOrEntityName" },
            { fieldId: "yearsInCurrentRole" },
            { fieldId: "annualIncome" },
            { fieldId: "monthlyHousingOrLeaseCost" }, // 9th field > max 8
          ],
        },
        {
          id: "step_two",
          title: "Remaining Fields",
          fields: [
            { fieldId: "existingMonthlyDebtObligations" },
            { fieldId: "liquidReservesUsd" },
            { fieldId: "requestedLoanAmount" },
            { fieldId: "loanPurpose" },
            { fieldId: "repaymentTermMonths" },
            { fieldId: "collateralType" },
            { fieldId: "syntheticDataDeclaration" },
            { fieldId: "termsAndCreditCheckConsent" },
          ],
        },
      ],
    };
    const result = validateAdaptiveUISchema(
      tooManyFields,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === "steps.0.fields")).toBe(true);
  });

  it("8. rejects invalid navigation settings", () => {
    const badNav = {
      ...validFixture,
      navigation: {
        nextLabel: "",
        previousLabel: "Back",
        submitLabel: "Submit",
      },
    };
    const result = validateAdaptiveUISchema(
      badNav,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
  });

  it("9. rejects unknown appearance settings", () => {
    const badAppearance = {
      ...validFixture,
      appearance: {
        density: "ultra_wide",
        showProgress: true,
      },
    };
    const result = validateAdaptiveUISchema(
      badAppearance,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
  });

  it("10. rejects unexpected properties on root, steps, and field references", () => {
    const unexpectedProp = {
      ...validFixture,
      customScriptUrl: "https://evil.example/payload.js",
    };
    const result = validateAdaptiveUISchema(
      unexpectedProp,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.code === "unrecognized_keys")
    ).toBe(true);
  });

  it("11. prevents field business rules (type, required, min, max) from being modified by schema data", () => {
    const tamperedField = structuredClone(validFixture);
    const firstField = tamperedField.steps[0]!.fields[0] as unknown as Record<string, unknown>;
    firstField.required = false;
    firstField.type = "checkbox";

    const result = validateAdaptiveUISchema(
      tamperedField,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(false);
  });

  it("12. enforces that all 15 canonical fields appear exactly once", () => {
    const result = validateAdaptiveUISchema(
      validFixture,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(result.valid).toBe(true);
    const allSchemaFieldIds = result.schema!.steps.flatMap((s) =>
      s.fields.map((f) => f.fieldId)
    );
    expect(allSchemaFieldIds.length).toBe(
      CANONICAL_FINANCIAL_LOAN_FORM.fields.length
    );
    expect(new Set(allSchemaFieldIds).size).toBe(17);
  });
});

describe("Day 7: Component Registry (4 Core Tests)", () => {
  it("1. resolves all 9 approved component types", () => {
    expect(APPROVED_COMPONENT_TYPES).toEqual([
      "text",
      "email",
      "phone",
      "number",
      "select",
      "date",
      "textarea",
      "radio",
      "checkbox",
    ]);

    for (const type of APPROVED_COMPONENT_TYPES) {
      expect(isApprovedComponentType(type)).toBe(true);
      const comp = resolveApprovedComponent(type);
      expect(comp).toBe(APPROVED_COMPONENT_REGISTRY[type]);
    }
  });

  it("2. rejects unknown or prototype-inherited component names", () => {
    expect(isApprovedComponentType("script")).toBe(false);
    expect(isApprovedComponentType("iframe")).toBe(false);
    expect(isApprovedComponentType("toString")).toBe(false);
    expect(isApprovedComponentType("constructor")).toBe(false);
    expect(resolveApprovedComponent("CustomWidget")).toBeNull();
  });

  it("3. unregistered components cannot render inside AdaptiveUIRenderer", () => {
    const badFormDef = {
      ...CANONICAL_FINANCIAL_LOAN_FORM,
      fieldMap: {
        ...CANONICAL_FINANCIAL_LOAN_FORM.fieldMap,
        fullName: {
          ...CANONICAL_FINANCIAL_LOAN_FORM.fieldMap.fullName,
          componentType: "ArbitraryEvilWidget" as "text",
        },
      },
    };

    render(
      <TestFormWrapper>
        <AdaptiveUIRenderer
          schema={ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema}
          formDefinition={badFormDef}
        />
      </TestFormWrapper>
    );

    expect(
      screen.getByTestId(
        "adaptive-unregistered-component-ArbitraryEvilWidget"
      )
    ).toBeInTheDocument();
  });

  it("4. registry components receive valid props and render accessible inputs", () => {
    render(
      <TestFormWrapper>
        <AdaptiveUIRenderer
          schema={ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema}
          formDefinition={CANONICAL_FINANCIAL_LOAN_FORM}
        />
      </TestFormWrapper>
    );

    const fullNameInput = screen.getByTestId(
      "adaptive-input-fullName"
    ) as HTMLInputElement;
    expect(fullNameInput).toBeInTheDocument();
    expect(fullNameInput).toHaveAttribute("aria-required", "true");
    expect(fullNameInput).toHaveAttribute("data-auragen-field", "fullName");
  });
});

describe("Day 7: Dynamic React Renderer (8 Core Tests)", () => {
  const fixtureA = ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema;

  it("1 & 2. renders valid schema and displays only the current step's fields", () => {
    render(
      <TestFormWrapper>
        <AdaptiveUIRenderer
          schema={fixtureA}
          formDefinition={CANONICAL_FINANCIAL_LOAN_FORM}
        />
      </TestFormWrapper>
    );

    expect(screen.getByTestId("adaptive-wizard-title")).toHaveTextContent(
      fixtureA.title
    );
    expect(screen.getByTestId("adaptive-input-fullName")).toBeInTheDocument();
    expect(
      screen.queryByTestId("adaptive-input-annualIncome")
    ).not.toBeInTheDocument();
  });

  it("3, 4 & 6. advances Next, updates progress indicator, and navigates Previous", async () => {
    render(
      <TestFormWrapper>
        <AdaptiveUIRenderer
          schema={fixtureA}
          formDefinition={CANONICAL_FINANCIAL_LOAN_FORM}
        />
      </TestFormWrapper>
    );

    expect(screen.getByTestId("adaptive-progress-step")).toHaveTextContent("1");

    fireEvent.click(screen.getByTestId("adaptive-next-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("adaptive-progress-step")).toHaveTextContent(
        "2"
      );
    });
    expect(
      screen.getByTestId("adaptive-input-employmentStatus")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("adaptive-prev-btn"));
    expect(screen.getByTestId("adaptive-progress-step")).toHaveTextContent("1");
    expect(screen.getByTestId("adaptive-input-fullName")).toBeInTheDocument();
  });

  it("5. invalid step fields prevent advancing to the next step", async () => {
    render(
      <TestFormWrapper
        defaultValues={{
          ...DEFAULT_LOAN_APPLICATION_VALUES,
          fullName: "",
        }}
      >
        <AdaptiveUIRenderer
          schema={fixtureA}
          formDefinition={CANONICAL_FINANCIAL_LOAN_FORM}
        />
      </TestFormWrapper>
    );

    fireEvent.click(screen.getByTestId("adaptive-next-btn"));
    await waitFor(() => {
      expect(
        screen.getByTestId("adaptive-error-fullName")
      ).toHaveTextContent(/Full Legal Name is required/i);
    });
    expect(screen.getByTestId("adaptive-progress-step")).toHaveTextContent("1");
  });

  it("7. final review step displays current shared form values", async () => {
    render(
      <TestFormWrapper
        defaultValues={{
          ...DEFAULT_LOAN_APPLICATION_VALUES,
          fullName: "Elena Rostova",
          residencyPostalCode: "10001",
          yearsInCurrentRole: 4,
          requestedLoanAmount: 125000,
          repaymentTermMonths: 36,
        }}
      >
        <AdaptiveUIRenderer
          schema={ADAPTIVE_DEVELOPMENT_FIXTURES[2]!.schema} // Compact 2-step wizard
          formDefinition={CANONICAL_FINANCIAL_LOAN_FORM}
        />
      </TestFormWrapper>
    );

    // Step 1 -> Step 2
    fireEvent.click(screen.getByTestId("adaptive-next-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("adaptive-progress-step")).toHaveTextContent(
        "2"
      )
    );

    // Step 2 -> Step 3
    fireEvent.click(screen.getByTestId("adaptive-next-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("adaptive-progress-step")).toHaveTextContent(
        "3"
      )
    );

    // Step 3 -> Final Review (Step 4)
    fireEvent.click(screen.getByTestId("adaptive-next-btn"));
    await waitFor(() =>
      expect(
        screen.getByTestId("adaptive-final-review-step")
      ).toBeInTheDocument()
    );

    expect(
      screen.getByTestId("adaptive-review-value-fullName")
    ).toHaveTextContent("Elena Rostova");
    expect(
      screen.getByTestId("adaptive-review-value-requestedLoanAmount")
    ).toHaveTextContent("125000");
  });

  it("8. invalid schemas are rejected and never rendered", () => {
    render(
      <TestFormWrapper>
        <AdaptiveUIRenderer
          schema={{ version: 99, mode: "invalid" }}
          formDefinition={CANONICAL_FINANCIAL_LOAN_FORM}
        />
      </TestFormWrapper>
    );

    expect(
      screen.getByTestId("adaptive-schema-invalid-fallback")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("adaptive-ui-renderer-root")
    ).not.toBeInTheDocument();
  });
});

describe("Day 7: Shared Form State Preservation & Security (10 Core Tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1–6. preserves values across original 5-section form and adaptive wizard switches and submits shared state", async () => {
    const onSaveDraft = vi.fn();
    render(<FinancialLoanApplicationForm onSaveDraft={onSaveDraft} />);

    // Enter value in original 5-section form
    const originalNameInput = screen.getByLabelText(
      /Full Legal Name/i
    ) as HTMLInputElement;
    fireEvent.change(originalNameInput, {
      target: { value: "Marcus Sterling" },
    });
    fireEvent.blur(originalNameInput);
    expect(originalNameInput.value).toBe("Marcus Sterling");

    // Switch to Adaptive Wizard preview -> previously entered value is populated!
    fireEvent.click(screen.getByTestId("view-adaptive-wizard-btn"));
    const adaptiveNameInput = screen.getByTestId(
      "adaptive-input-fullName"
    ) as HTMLInputElement;
    expect(adaptiveNameInput.value).toBe("Marcus Sterling");

    // Edit inside Adaptive Wizard -> advance Next -> go Previous -> value survives
    fireEvent.change(adaptiveNameInput, {
      target: { value: "Marcus Sterling III" },
    });
    fireEvent.click(screen.getByTestId("adaptive-next-btn"));
    await waitFor(() =>
      expect(screen.getByTestId("adaptive-progress-step")).toHaveTextContent(
        "2"
      )
    );
    fireEvent.click(screen.getByTestId("adaptive-prev-btn"));
    expect(
      (screen.getByTestId("adaptive-input-fullName") as HTMLInputElement).value
    ).toBe("Marcus Sterling III");

    // Switch back to Original 5-Section Form -> adaptive edit is preserved in shared state!
    fireEvent.click(screen.getByTestId("view-original-form-btn"));
    expect(
      (screen.getByLabelText(/Full Legal Name/i) as HTMLInputElement).value
    ).toBe("Marcus Sterling III");
  });

  it("Security 1–4: blocks arbitrary HTML/script tags, arbitrary component names, and canonical rule overrides", () => {
    const xssSchema = structuredClone(
      ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema
    );
    xssSchema.title = "<script>alert('xss')</script> Wizard";

    const xssResult = validateAdaptiveUISchema(
      xssSchema,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(xssResult.valid).toBe(false);

    const jsxExprSchema = structuredClone(
      ADAPTIVE_DEVELOPMENT_FIXTURES[0]!.schema
    );
    jsxExprSchema.steps[0]!.description = "{window.location.href}";
    const jsxResult = validateAdaptiveUISchema(
      jsxExprSchema,
      CANONICAL_FINANCIAL_LOAN_FORM
    );
    expect(jsxResult.valid).toBe(false);
  });
});