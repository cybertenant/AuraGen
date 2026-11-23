"use client";

import React, { useState, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { AdaptivePreviewWorkbench } from "@/components/adaptive-ui/preview/AdaptivePreviewWorkbench";
import type { AdaptiveUISchema } from "@/components/adaptive-ui/types/adaptive-ui.types";
import {
  User,
  Briefcase,
  DollarSign,
  Landmark,
  FileCheck2,
  ArrowLeft,
  ArrowRight,
  Save,
  Send,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import type {
  FinancialLoanApplication,
  ValidationErrorCategory,
} from "@auragen/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const DEFAULT_LOAN_APPLICATION_VALUES: FinancialLoanApplication = {
  // 1. Personal Information
  fullName: "Aarav Mehta (Synthetic Demo)",
  emailAddress: "aarav.mehta.synth@example.com",
  phoneNumber: "+1-555-019-2834",
  residencyPostalCode: "94105",

  // 2. Employment Details
  employmentStatus: "full_time",
  employerOrEntityName: "Vanguard Meridian Synth Corp",
  yearsInCurrentRole: 6,

  // 3. Financial Information
  annualIncome: 185000,
  monthlyHousingOrLeaseCost: 3200,
  existingMonthlyDebtObligations: 1450,
  liquidReservesUsd: 95000,

  // 4. Loan Details
  requestedLoanAmount: 450000,
  loanPurpose: "working_capital",
  repaymentTermMonths: 60,
  collateralType: "commercial_receivables",

  // 5. Review & Declaration
  syntheticDataDeclaration: true,
  termsAndCreditCheckConsent: true,
};

export interface LoanFormSectionMeta {
  index: number;
  id: string;
  title: string;
  shortTitle: string;
  fields: (keyof FinancialLoanApplication)[];
}

export const LOAN_FORM_SECTIONS: LoanFormSectionMeta[] = [
  {
    index: 1,
    id: "personal_information",
    title: "1. Personal Information",
    shortTitle: "Personal",
    fields: [
      "fullName",
      "emailAddress",
      "phoneNumber",
      "residencyPostalCode",
    ],
  },
  {
    index: 2,
    id: "employment_details",
    title: "2. Employment Details",
    shortTitle: "Employment",
    fields: [
      "employmentStatus",
      "employerOrEntityName",
      "yearsInCurrentRole",
    ],
  },
  {
    index: 3,
    id: "financial_information",
    title: "3. Financial Information",
    shortTitle: "Financials",
    fields: [
      "annualIncome",
      "monthlyHousingOrLeaseCost",
      "existingMonthlyDebtObligations",
      "liquidReservesUsd",
    ],
  },
  {
    index: 4,
    id: "loan_details",
    title: "4. Loan Details",
    shortTitle: "Loan Request",
    fields: [
      "requestedLoanAmount",
      "loanPurpose",
      "repaymentTermMonths",
      "collateralType",
    ],
  },
  {
    index: 5,
    id: "review_and_declaration",
    title: "5. Review & Declaration",
    shortTitle: "Review",
    fields: ["syntheticDataDeclaration", "termsAndCreditCheckConsent"],
  },
];

export interface FinancialLoanApplicationFormProps {
  initialValues?: Partial<FinancialLoanApplication>;
  disabled?: boolean;
  onSaveDraft: (values: FinancialLoanApplication) => Promise<void> | void;
  onValidationError?: (
    fieldId: string,
    category: ValidationErrorCategory
  ) => void;
  onBacktrack?: (reason: string) => void;
  adaptiveSchema?: AdaptiveUISchema | null;
  sessionId?: string | null;
  latestFrictionScore?: number;
}

export function FinancialLoanApplicationForm({
  initialValues,
  disabled = false,
  onSaveDraft,
  onValidationError,
  onBacktrack,
  adaptiveSchema = null,
  sessionId = null,
  latestFrictionScore = 0,
}: FinancialLoanApplicationFormProps) {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submittedFinal, setSubmittedFinal] = useState<boolean>(false);

  const methods = useForm<FinancialLoanApplication>({
    defaultValues: {
      ...DEFAULT_LOAN_APPLICATION_VALUES,
      ...initialValues,
    },
    shouldUnregister: false,
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    reset,
    formState: { errors },
  } = methods;

  // Restore saved draft values when Neon draft loads
  useEffect(() => {
    if (initialValues && Object.keys(initialValues).length > 0) {
      reset({
        ...DEFAULT_LOAN_APPLICATION_VALUES,
        ...initialValues,
      });
    }
  }, [initialValues, reset]);

  const currentSection =
    LOAN_FORM_SECTIONS.find((s) => s.index === currentStep) ??
    LOAN_FORM_SECTIONS[0]!;

  const progressPercentage = Math.round(
    (currentStep / LOAN_FORM_SECTIONS.length) * 100
  );

  const validateCurrentSectionFields = async (): Promise<boolean> => {
    const isValid = await trigger(currentSection.fields);
    if (!isValid) {
      for (const fieldName of currentSection.fields) {
        const fieldError = errors[fieldName];
        if (fieldError) {
          const category: ValidationErrorCategory =
            fieldError.type === "required"
              ? "required"
              : fieldError.type === "min" || fieldError.type === "max"
              ? "range"
              : fieldError.type === "pattern"
              ? "format"
              : "custom";
          onValidationError?.(String(fieldName), category);
        } else {
          // Ensure telemetry records at least the first failing field on initial trigger
          const val = getValues(fieldName);
          if (
            val === "" ||
            val === undefined ||
            val === null ||
            (typeof val === "number" && (Number.isNaN(val) || val < 0))
          ) {
            onValidationError?.(String(fieldName), "required");
          }
        }
      }
    }
    return isValid;
  };

  const handleNextStep = async () => {
    const valid = await validateCurrentSectionFields();
    if (!valid) return;
    if (currentStep < LOAN_FORM_SECTIONS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      const targetStep = currentStep - 1;
      onBacktrack?.(`section_${currentStep}_to_${targetStep}`);
      setCurrentStep(targetStep);
    }
  };

  const handleJumpToSection = async (targetStep: number) => {
    if (targetStep === currentStep) return;
    if (targetStep < currentStep) {
      onBacktrack?.(`section_${currentStep}_to_${targetStep}`);
      setCurrentStep(targetStep);
      return;
    }
    const valid = await validateCurrentSectionFields();
    if (valid) {
      setCurrentStep(targetStep);
    }
  };

  const handleManualDraftSave = async () => {
    const valid = await validateCurrentSectionFields();
    if (!valid) return;
    const allValues = getValues();
    await onSaveDraft(allValues);
  };

  const onFinalSubmit = async (values: FinancialLoanApplication) => {
    await onSaveDraft(values);
    setSubmittedFinal(true);
  };

  const watchedAll = currentStep === 5 ? getValues() : DEFAULT_LOAN_APPLICATION_VALUES;

  return (
    <FormProvider {...methods}>
      <AdaptivePreviewWorkbench
        sessionId={sessionId}
        latestFrictionScore={latestFrictionScore}
        externalAdaptiveSchema={adaptiveSchema}
        disabled={disabled}
        onSaveDraft={onSaveDraft}
        onValidationError={onValidationError}
        onBacktrack={onBacktrack}
        renderOriginalForm={() => (
          <div className="space-y-5" data-testid="financial-loan-form-root">
      {/* Progress Header & 5-Section Stepper */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">
            {currentSection.title}
          </span>
          <span
            data-testid="loan-form-progress-text"
            className="text-emerald-400 font-medium"
          >
            Section {currentStep} of {LOAN_FORM_SECTIONS.length} (
            {progressPercentage}%)
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            data-testid="loan-form-progress-bar"
            className="h-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        {/* Stepper Pills */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {LOAN_FORM_SECTIONS.map((sec) => {
            const isActive = sec.index === currentStep;
            const isCompleted = sec.index < currentStep;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => void handleJumpToSection(sec.index)}
                data-auragen-action={`step-tab-${sec.index}`}
                data-testid={`step-tab-${sec.index}`}
                className={`rounded-md px-2 py-1.5 text-[11px] font-medium text-left transition-colors border ${
                  isActive
                    ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                    : isCompleted
                    ? "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"
                    : "border-slate-800/80 bg-slate-950/60 text-slate-500 hover:text-slate-300"
                }`}
              >
                <div className="truncate">
                  {sec.index}. {sec.shortTitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {submittedFinal && (
        <div
          role="status"
          data-testid="final-application-submitted-banner"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>
            Synthetic Financial Loan Application submitted and persisted to Neon
            PostgreSQL.
          </span>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onFinalSubmit, (fieldErrors) => {
          const firstKey = Object.keys(fieldErrors)[0];
          if (firstKey) {
            onValidationError?.(firstKey, "required");
          }
        })}
        noValidate
        className="space-y-4"
      >
        {/* SECTION 1: PERSONAL INFORMATION (4 Fields) */}
        {currentStep === 1 && (
          <div
            data-auragen-section="personal_information"
            data-auragen-section-index="1"
            data-testid="section-personal-information"
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <User className="h-4 w-4" />
              <span>Applicant Personal & Contact Details (Synthetic)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="fullName"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Full Legal Name (Synthetic Entity/Applicant)
                </label>
                <input
                  id="fullName"
                  type="text"
                  data-auragen-field="fullName"
                  {...register("fullName", {
                    required: "Full legal name is required (min 3 chars)",
                    minLength: {
                      value: 3,
                      message: "Full name must be at least 3 characters",
                    },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.fullName && (
                  <p
                    role="alert"
                    className="mt-1 text-xs text-rose-400 flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {errors.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="emailAddress"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Synthetic Email Address
                </label>
                <input
                  id="emailAddress"
                  type="email"
                  data-auragen-field="emailAddress"
                  {...register("emailAddress", {
                    required: "Synthetic email address is required",
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: "Enter a valid email format",
                    },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.emailAddress && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.emailAddress.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="phoneNumber"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Primary Contact Phone
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  data-auragen-field="phoneNumber"
                  {...register("phoneNumber", {
                    required: "Phone number is required",
                    minLength: {
                      value: 7,
                      message: "Phone number must be at least 7 characters",
                    },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.phoneNumber && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.phoneNumber.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="residencyPostalCode"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Primary Postal / ZIP Code
                </label>
                <input
                  id="residencyPostalCode"
                  type="text"
                  data-auragen-field="residencyPostalCode"
                  {...register("residencyPostalCode", {
                    required: "Postal/ZIP code is required",
                    minLength: {
                      value: 4,
                      message: "Postal code must be at least 4 characters",
                    },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.residencyPostalCode && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.residencyPostalCode.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: EMPLOYMENT DETAILS (3 Fields) */}
        {currentStep === 2 && (
          <div
            data-auragen-section="employment_details"
            data-auragen-section-index="2"
            data-testid="section-employment-details"
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Briefcase className="h-4 w-4" />
              <span>Employment & Corporate Affiliation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="employmentStatus"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Employment Classification
                </label>
                <select
                  id="employmentStatus"
                  data-auragen-field="employmentStatus"
                  {...register("employmentStatus", { required: true })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="full_time">Full-Time Salaried Officer</option>
                  <option value="self_employed">Self-Employed Principal</option>
                  <option value="contractor">Independent Contractor</option>
                  <option value="business_owner">
                    Managing Business Owner
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="yearsInCurrentRole"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Years in Current Role / Operating History
                </label>
                <input
                  id="yearsInCurrentRole"
                  type="number"
                  data-auragen-field="yearsInCurrentRole"
                  {...register("yearsInCurrentRole", {
                    valueAsNumber: true,
                    required: "Years in role is required",
                    min: { value: 0, message: "Cannot be negative" },
                    max: { value: 60, message: "Must be 60 years or less" },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.yearsInCurrentRole && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.yearsInCurrentRole.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="employerOrEntityName"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Synthetic Entity Legal Name / Employer
              </label>
              <input
                id="employerOrEntityName"
                type="text"
                data-auragen-field="employerOrEntityName"
                {...register("employerOrEntityName", {
                  required: "Employer or entity legal name is required",
                  minLength: {
                    value: 2,
                    message: "Entity name must be at least 2 characters",
                  },
                })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
              {errors.employerOrEntityName && (
                <p role="alert" className="mt-1 text-xs text-rose-400">
                  {errors.employerOrEntityName.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* SECTION 3: FINANCIAL INFORMATION (4 Fields) */}
        {currentStep === 3 && (
          <div
            data-auragen-section="financial_information"
            data-auragen-section-index="3"
            data-testid="section-financial-information"
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <DollarSign className="h-4 w-4" />
              <span>Synthetic Income, Obligations & Liquidity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="annualIncome"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Gross Annual Income / Revenue (USD)
                </label>
                <input
                  id="annualIncome"
                  type="number"
                  data-auragen-field="annualIncome"
                  {...register("annualIncome", {
                    valueAsNumber: true,
                    required: "Annual income is required",
                    min: {
                      value: 12000,
                      message: "Annual income must be at least $12,000",
                    },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.annualIncome && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.annualIncome.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="liquidReservesUsd"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Verified Liquid Cash Reserves (USD)
                </label>
                <input
                  id="liquidReservesUsd"
                  type="number"
                  data-auragen-field="liquidReservesUsd"
                  {...register("liquidReservesUsd", {
                    valueAsNumber: true,
                    required: "Liquid reserves amount is required",
                    min: { value: 0, message: "Cannot be negative" },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.liquidReservesUsd && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.liquidReservesUsd.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="monthlyHousingOrLeaseCost"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Monthly Housing / Commercial Lease (USD)
                </label>
                <input
                  id="monthlyHousingOrLeaseCost"
                  type="number"
                  data-auragen-field="monthlyHousingOrLeaseCost"
                  {...register("monthlyHousingOrLeaseCost", {
                    valueAsNumber: true,
                    required: "Monthly housing/lease cost is required",
                    min: { value: 0, message: "Cannot be negative" },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.monthlyHousingOrLeaseCost && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.monthlyHousingOrLeaseCost.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="existingMonthlyDebtObligations"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Existing Monthly Debt Service (USD)
                </label>
                <input
                  id="existingMonthlyDebtObligations"
                  type="number"
                  data-auragen-field="existingMonthlyDebtObligations"
                  {...register("existingMonthlyDebtObligations", {
                    valueAsNumber: true,
                    required: "Existing debt service is required",
                    min: { value: 0, message: "Cannot be negative" },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.existingMonthlyDebtObligations && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.existingMonthlyDebtObligations.message}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: LOAN DETAILS (4 Fields) */}
        {currentStep === 4 && (
          <div
            data-auragen-section="loan_details"
            data-auragen-section-index="4"
            data-testid="section-loan-details"
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <Landmark className="h-4 w-4" />
              <span>Facility Sizing, Term & Collateral Structure</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="requestedLoanAmount"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Requested Facility / Loan Amount (USD)
                </label>
                <input
                  id="requestedLoanAmount"
                  type="number"
                  data-auragen-field="requestedLoanAmount"
                  {...register("requestedLoanAmount", {
                    valueAsNumber: true,
                    required: "Requested loan amount is required",
                    min: {
                      value: 5000,
                      message: "Minimum loan request is $5,000",
                    },
                    max: {
                      value: 25000000,
                      message: "Maximum synthetic loan request is $25,000,000",
                    },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.requestedLoanAmount && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.requestedLoanAmount.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="repaymentTermMonths"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Amortization / Repayment Term (Months)
                </label>
                <input
                  id="repaymentTermMonths"
                  type="number"
                  data-auragen-field="repaymentTermMonths"
                  {...register("repaymentTermMonths", {
                    valueAsNumber: true,
                    required: "Repayment term is required",
                    min: { value: 6, message: "Minimum term is 6 months" },
                    max: { value: 360, message: "Maximum term is 360 months" },
                  })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                {errors.repaymentTermMonths && (
                  <p role="alert" className="mt-1 text-xs text-rose-400">
                    {errors.repaymentTermMonths.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="loanPurpose"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Primary Facility Purpose
                </label>
                <select
                  id="loanPurpose"
                  data-auragen-field="loanPurpose"
                  {...register("loanPurpose", { required: true })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="working_capital">
                    Working Capital & Treasury Liquidity
                  </option>
                  <option value="equipment_acquisition">
                    Capital Equipment Acquisition
                  </option>
                  <option value="debt_refinancing">
                    Institutional Debt Refinancing
                  </option>
                  <option value="commercial_expansion">
                    Commercial Facility Expansion
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="collateralType"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Pledged Collateral Classification
                </label>
                <select
                  id="collateralType"
                  data-auragen-field="collateralType"
                  {...register("collateralType", { required: true })}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="commercial_receivables">
                    Tier-1 Commercial Receivables
                  </option>
                  <option value="real_estate_equity">
                    Commercial Real Estate Equity
                  </option>
                  <option value="equipment_lien">
                    Senior Equipment Lien
                  </option>
                  <option value="unsecured_guaranty">
                    Unsecured Corporate Guaranty
                  </option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: REVIEW AND DECLARATION (Summary + 2 Checkboxes) */}
        {currentStep === 5 && (
          <div
            data-auragen-section="review_and_declaration"
            data-auragen-section-index="5"
            data-testid="section-review-declaration"
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <FileCheck2 className="h-4 w-4" />
              <span>Application Summary & Synthetic Data Attestation</span>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-950/90 p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Applicant</span>
                <span className="font-medium text-slate-200">
                  {watchedAll.fullName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Entity / Employer</span>
                <span className="font-medium text-slate-200">
                  {watchedAll.employerOrEntityName}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Annual Income</span>
                <span className="font-medium text-emerald-400">
                  ${Number(watchedAll.annualIncome || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Requested Loan</span>
                <span className="font-medium text-emerald-400">
                  ${Number(watchedAll.requestedLoanAmount || 0).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Term</span>
                <span className="font-medium text-slate-200">
                  {watchedAll.repaymentTermMonths} Months
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">Liquid Reserves</span>
                <span className="font-medium text-slate-200">
                  ${Number(watchedAll.liquidReservesUsd || 0).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  id="syntheticDataDeclaration"
                  type="checkbox"
                  data-auragen-field="syntheticDataDeclaration"
                  {...register("syntheticDataDeclaration", {
                    required:
                      "You must attest that all entered data is synthetic",
                  })}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>
                  I confirm that all personal, employment, and financial figures
                  entered in this form are <strong>100% synthetic</strong> for
                  demonstration purposes only.
                </span>
              </label>
              {errors.syntheticDataDeclaration && (
                <p role="alert" className="text-xs text-rose-400">
                  {errors.syntheticDataDeclaration.message}
                </p>
              )}

              <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
                <input
                  id="termsAndCreditCheckConsent"
                  type="checkbox"
                  data-auragen-field="termsAndCreditCheckConsent"
                  {...register("termsAndCreditCheckConsent", {
                    required:
                      "You must accept the synthetic underwriting terms",
                  })}
                  className="mt-0.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <span>
                  I authorize AuraGen to persist this synthetic application draft
                  and evaluate anonymous interaction telemetry.
                </span>
              </label>
              {errors.termsAndCreditCheckConsent && (
                <p role="alert" className="text-xs text-rose-400">
                  {errors.termsAndCreditCheckConsent.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Navigation & Persistence Action Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentStep === 1 || disabled}
              onClick={handlePreviousStep}
              data-auragen-action="wizard-prev-step"
              data-testid="wizard-prev-step-btn"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Previous Section
            </Button>

            {currentStep < LOAN_FORM_SECTIONS.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => void handleNextStep()}
                data-auragen-action="wizard-next-step"
                data-testid="wizard-next-step-btn"
              >
                Next Section
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => void handleManualDraftSave()}
              data-auragen-action="save-draft"
              data-testid="save-draft-btn"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Draft to Neon
            </Button>

            {currentStep === LOAN_FORM_SECTIONS.length && (
              <Button
                type="submit"
                size="sm"
                disabled={disabled}
                data-auragen-action="submit"
                data-testid="submit-loan-application-btn"
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Submit Application
              </Button>
            )}
          </div>
        </div>
      </form>
          </div>
        )}
      />
    </FormProvider>
  );
}