import {
  CanonicalFieldDefinition,
  CanonicalFormDefinition,
  CanonicalLoanFieldId,
} from "../types/adaptive-ui.types";

/**
 * Canonical Financial Loan Application Definition (17 exact fields from FinancialLoanApplicationSchema).
 * Single source of truth for field IDs, approved component types, required flags,
 * allowed options, and validation rules.
 */
export const CANONICAL_LOAN_FIELDS: readonly CanonicalFieldDefinition[] = [
  // Section 1: Personal Information
  {
    fieldId: "fullName",
    componentType: "text",
    label: "Full Legal Name",
    placeholder: "e.g., Jordan Vance",
    defaultHelperText: "Full legal name must be at least 3 characters.",
    required: true,
    originalSectionId: "personal",
    originalSectionTitle: "Personal Information",
    validation: {
      minLength: 3,
      maxLength: 120,
    },
  },
  {
    fieldId: "emailAddress",
    componentType: "email",
    label: "Primary Email Address",
    placeholder: "jordan.vance@enterprise.io",
    defaultHelperText: "Enter a valid synthetic email address.",
    required: true,
    originalSectionId: "personal",
    originalSectionTitle: "Personal Information",
    validation: {
      pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      patternMessage: "Enter a valid synthetic email address",
    },
  },
  {
    fieldId: "phoneNumber",
    componentType: "phone",
    label: "Contact Phone Number",
    placeholder: "+1 (555) 234-5678",
    defaultHelperText: "Phone number must be at least 7 characters.",
    required: true,
    originalSectionId: "personal",
    originalSectionTitle: "Personal Information",
    validation: {
      minLength: 7,
      maxLength: 25,
    },
  },
  {
    fieldId: "residencyPostalCode",
    componentType: "text",
    label: "Residency Postal / ZIP Code",
    placeholder: "10001",
    defaultHelperText: "Postal/ZIP code must be at least 4 characters.",
    required: true,
    originalSectionId: "personal",
    originalSectionTitle: "Personal Information",
    validation: {
      minLength: 4,
      maxLength: 20,
    },
  },

  // Section 2: Employment Details
  {
    fieldId: "employmentStatus",
    componentType: "select",
    label: "Employment Status",
    defaultHelperText: "Select your primary employment classification.",
    required: true,
    originalSectionId: "employment",
    originalSectionTitle: "Employment Details",
    options: [
      { value: "full_time", label: "Full-Time Employed" },
      { value: "part_time", label: "Part-Time Employed" },
      { value: "self_employed", label: "Self-Employed / Principal" },
      { value: "business_owner", label: "Business Owner / Executive" },
      { value: "retired", label: "Retired" },
      { value: "student", label: "Student" },
      { value: "unemployed", label: "Currently Unemployed" },
    ],
    validation: {},
  },
  {
    fieldId: "employerOrEntityName",
    componentType: "text",
    label: "Employer or Business Entity Name",
    placeholder: "e.g., Meridian Capital Holdings LLC",
    defaultHelperText: "Employer or business entity name is required.",
    required: true,
    originalSectionId: "employment",
    originalSectionTitle: "Employment Details",
    validation: {
      minLength: 2,
      maxLength: 150,
    },
  },
  {
    fieldId: "yearsInCurrentRole",
    componentType: "number",
    label: "Years in Current Role",
    placeholder: "4",
    defaultHelperText: "Enter 0 to 60 years in current role.",
    required: true,
    originalSectionId: "employment",
    originalSectionTitle: "Employment Details",
    validation: {
      min: 0,
      max: 60,
      valueAsNumber: true,
    },
  },

  // Section 3: Financial Information
  {
    fieldId: "annualIncome",
    componentType: "number",
    label: "Gross Annual Income (USD)",
    placeholder: "145000",
    defaultHelperText: "Minimum $12,000 up to $50,000,000.",
    required: true,
    originalSectionId: "financial",
    originalSectionTitle: "Financial Information",
    validation: {
      min: 12000,
      max: 50000000,
      valueAsNumber: true,
    },
  },
  {
    fieldId: "monthlyHousingOrLeaseCost",
    componentType: "number",
    label: "Monthly Housing or Lease Cost (USD)",
    placeholder: "2500",
    defaultHelperText: "Monthly housing/lease cost cannot be negative.",
    required: true,
    originalSectionId: "financial",
    originalSectionTitle: "Financial Information",
    validation: {
      min: 0,
      max: 1000000,
      valueAsNumber: true,
    },
  },
  {
    fieldId: "existingMonthlyDebtObligations",
    componentType: "number",
    label: "Existing Monthly Debt Obligations (USD)",
    placeholder: "900",
    defaultHelperText: "Recurring monthly debt service obligations.",
    required: true,
    originalSectionId: "financial",
    originalSectionTitle: "Financial Information",
    validation: {
      min: 0,
      max: 1000000,
      valueAsNumber: true,
    },
  },
  {
    fieldId: "liquidReservesUsd",
    componentType: "number",
    label: "Liquid Reserves (USD)",
    placeholder: "85000",
    defaultHelperText: "Verified cash and marketable liquid reserves.",
    required: true,
    originalSectionId: "financial",
    originalSectionTitle: "Financial Information",
    validation: {
      min: 0,
      max: 100000000,
      valueAsNumber: true,
    },
  },

  // Section 4: Loan Details
  {
    fieldId: "requestedLoanAmount",
    componentType: "number",
    label: "Requested Loan Amount (USD)",
    placeholder: "50000",
    defaultHelperText: "Minimum $5,000 up to $25,000,000.",
    required: true,
    originalSectionId: "loan",
    originalSectionTitle: "Loan Details",
    validation: {
      min: 5000,
      max: 25000000,
      valueAsNumber: true,
    },
  },
  {
    fieldId: "loanPurpose",
    componentType: "radio",
    label: "Primary Loan Purpose",
    defaultHelperText: "Select the primary purpose for this facility.",
    required: true,
    originalSectionId: "loan",
    originalSectionTitle: "Loan Details",
    options: [
      { value: "working_capital", label: "Working Capital & Operations" },
      { value: "equipment_purchase", label: "Equipment & Infrastructure" },
      { value: "debt_consolidation", label: "Debt Consolidation" },
      { value: "commercial_expansion", label: "Commercial Expansion" },
      { value: "personal_major", label: "Major Personal Financing" },
    ],
    validation: {},
  },
  {
    fieldId: "repaymentTermMonths",
    componentType: "number",
    label: "Repayment Term (Months)",
    placeholder: "36",
    defaultHelperText: "Enter 6 to 360 months.",
    required: true,
    originalSectionId: "loan",
    originalSectionTitle: "Loan Details",
    validation: {
      min: 6,
      max: 360,
      valueAsNumber: true,
    },
  },
  {
    fieldId: "collateralType",
    componentType: "select",
    label: "Collateral Type",
    defaultHelperText: "Select collateral security backing this facility.",
    required: true,
    originalSectionId: "loan",
    originalSectionTitle: "Loan Details",
    options: [
      { value: "unsecured", label: "Unsecured Facility" },
      { value: "commercial_receivables", label: "Commercial Receivables" },
      { value: "real_estate", label: "Commercial / Residential Real Estate" },
      { value: "equipment", label: "Capital Equipment" },
      { value: "cash_deposit", label: "Cash / Treasury Deposit" },
      { value: "securities", label: "Marketable Securities" },
    ],
    validation: {},
  },

  // Section 5: Review and Declaration
  {
    fieldId: "syntheticDataDeclaration",
    componentType: "checkbox",
    label: "Synthetic Data Declaration",
    placeholder: "I confirm that all entered data is synthetic demo data.",
    required: true,
    originalSectionId: "declaration",
    originalSectionTitle: "Review and Declaration",
    validation: {},
  },
  {
    fieldId: "termsAndCreditCheckConsent",
    componentType: "checkbox",
    label: "Underwriting Terms & Consent",
    placeholder: "I accept the synthetic underwriting terms to submit.",
    required: true,
    originalSectionId: "declaration",
    originalSectionTitle: "Review and Declaration",
    validation: {},
  },
] as const;

const fieldMapAccumulator = {} as Record<
  CanonicalLoanFieldId,
  CanonicalFieldDefinition
>;
for (const field of CANONICAL_LOAN_FIELDS) {
  fieldMapAccumulator[field.fieldId] = field;
}

export const CANONICAL_FINANCIAL_LOAN_FORM: CanonicalFormDefinition = {
  formId: "auragen_financial_loan_v1",
  formTitle: "Institutional & Commercial Financial Loan Application",
  version: 1,
  fields: CANONICAL_LOAN_FIELDS,
  fieldMap: fieldMapAccumulator,
};