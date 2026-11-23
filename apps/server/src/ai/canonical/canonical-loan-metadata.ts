import {
  SanitizedCanonicalFieldMetadata,
  SanitizedFormMetadata,
} from "../types/ai.types.js";

/**
 * Server-side Canonical Financial Loan Application Metadata (17 exact fields).
 * Contains ONLY structural field metadata — zero user values or PII.
 */
const CANONICAL_LOAN_FIELD_LIST: readonly SanitizedCanonicalFieldMetadata[] =
  Object.freeze([
      {
        fieldId: "fullName",
        componentType: "text",
        label: "Full Legal Name",
        required: true,
        originalSectionId: "personal_information",
        originalSectionTitle: "Personal Information",
        hasOptions: false,
      },
      {
        fieldId: "emailAddress",
        componentType: "email",
        label: "Primary Email Address",
        required: true,
        originalSectionId: "personal_information",
        originalSectionTitle: "Personal Information",
        hasOptions: false,
      },
      {
        fieldId: "phoneNumber",
        componentType: "phone",
        label: "Contact Phone Number",
        required: true,
        originalSectionId: "personal_information",
        originalSectionTitle: "Personal Information",
        hasOptions: false,
      },
      {
        fieldId: "residencyPostalCode",
        componentType: "text",
        label: "Residency Postal / ZIP Code",
        required: true,
        originalSectionId: "personal_information",
        originalSectionTitle: "Personal Information",
        hasOptions: false,
      },
      {
        fieldId: "employmentStatus",
        componentType: "select",
        label: "Employment Status",
        required: true,
        originalSectionId: "employment_details",
        originalSectionTitle: "Employment Details",
        hasOptions: true,
      },
      {
        fieldId: "employerOrEntityName",
        componentType: "text",
        label: "Employer or Business Entity Name",
        required: true,
        originalSectionId: "employment_details",
        originalSectionTitle: "Employment Details",
        hasOptions: false,
      },
      {
        fieldId: "yearsInCurrentRole",
        componentType: "number",
        label: "Years in Current Role",
        required: true,
        originalSectionId: "employment_details",
        originalSectionTitle: "Employment Details",
        hasOptions: false,
      },
      {
        fieldId: "annualIncome",
        componentType: "number",
        label: "Gross Annual Income (USD)",
        required: true,
        originalSectionId: "financial_information",
        originalSectionTitle: "Financial Information",
        hasOptions: false,
      },
      {
        fieldId: "monthlyHousingOrLeaseCost",
        componentType: "number",
        label: "Monthly Housing or Lease Cost (USD)",
        required: true,
        originalSectionId: "financial_information",
        originalSectionTitle: "Financial Information",
        hasOptions: false,
      },
      {
        fieldId: "existingMonthlyDebtObligations",
        componentType: "number",
        label: "Existing Monthly Debt Obligations (USD)",
        required: true,
        originalSectionId: "financial_information",
        originalSectionTitle: "Financial Information",
        hasOptions: false,
      },
      {
        fieldId: "liquidReservesUsd",
        componentType: "number",
        label: "Liquid Reserves (USD)",
        required: true,
        originalSectionId: "financial_information",
        originalSectionTitle: "Financial Information",
        hasOptions: false,
      },
      {
        fieldId: "requestedLoanAmount",
        componentType: "number",
        label: "Requested Loan Amount (USD)",
        required: true,
        originalSectionId: "loan_details",
        originalSectionTitle: "Loan Details",
        hasOptions: false,
      },
      {
        fieldId: "loanPurpose",
        componentType: "radio",
        label: "Primary Loan Purpose",
        required: true,
        originalSectionId: "loan_details",
        originalSectionTitle: "Loan Details",
        hasOptions: true,
      },
      {
        fieldId: "repaymentTermMonths",
        componentType: "number",
        label: "Repayment Term (Months)",
        required: true,
        originalSectionId: "loan_details",
        originalSectionTitle: "Loan Details",
        hasOptions: false,
      },
      {
        fieldId: "collateralType",
        componentType: "select",
        label: "Collateral Type",
        required: true,
        originalSectionId: "loan_details",
        originalSectionTitle: "Loan Details",
        hasOptions: true,
      },
      {
        fieldId: "syntheticDataDeclaration",
        componentType: "checkbox",
        label: "Synthetic Data Declaration",
        required: true,
        originalSectionId: "review_and_declaration",
        originalSectionTitle: "Review and Declaration",
        hasOptions: false,
      },
      {
        fieldId: "termsAndCreditCheckConsent",
        componentType: "checkbox",
        label: "Underwriting Terms & Consent",
        required: true,
        originalSectionId: "review_and_declaration",
        originalSectionTitle: "Review and Declaration",
        hasOptions: false,
      },
  ]);

export const SERVER_CANONICAL_LOAN_METADATA: SanitizedFormMetadata =
  Object.freeze({
    formId: "auragen_financial_loan_v1",
    formTitle: "Institutional & Commercial Financial Loan Application",
    version: 1,
    totalFields: CANONICAL_LOAN_FIELD_LIST.length,
    fields: CANONICAL_LOAN_FIELD_LIST,
  });

/**
 * Strict Allowlist Privacy Sanitizer.
 * Strips ALL extra keys (such as value, defaultValue, formData, fullName, annualIncome, etc.)
 * and emits ONLY approved structural metadata properties so personal or financial data
 * can never be transmitted to Gemini.
 */
export function sanitizeFormMetadataForAI(
  rawFormDefinition: unknown
): SanitizedFormMetadata {
  const source =
    rawFormDefinition &&
    typeof rawFormDefinition === "object" &&
    Array.isArray((rawFormDefinition as { fields?: unknown }).fields)
      ? (rawFormDefinition as {
          formId?: unknown;
          formTitle?: unknown;
          version?: unknown;
          fields: Array<Record<string, unknown>>;
        })
      : SERVER_CANONICAL_LOAN_METADATA;

  const allowedComponentTypes = new Set([
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

  const sanitizedFields: SanitizedCanonicalFieldMetadata[] = source.fields.map(
    (item) => {
      const rawField = item as Record<string, unknown>;
      const compType = String(rawField.componentType ?? "text");
      return {
        fieldId: String(rawField.fieldId ?? ""),
        componentType: (allowedComponentTypes.has(compType)
          ? compType
          : "text") as SanitizedCanonicalFieldMetadata["componentType"],
        label: String(rawField.label ?? ""),
        required: Boolean(rawField.required),
        originalSectionId: String(rawField.originalSectionId ?? "general"),
        originalSectionTitle: String(rawField.originalSectionTitle ?? "General"),
        hasOptions:
          Boolean(rawField.hasOptions) ||
          (Array.isArray(rawField.options) && rawField.options.length > 0),
      };
    }
  );

  return {
    formId: String(source.formId ?? SERVER_CANONICAL_LOAN_METADATA.formId),
    formTitle: String(
      source.formTitle ?? SERVER_CANONICAL_LOAN_METADATA.formTitle
    ),
    version: Number(source.version ?? 1),
    totalFields: sanitizedFields.length,
    fields: sanitizedFields,
  };
}