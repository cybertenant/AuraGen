// Single source of truth for sections and fields.
// The NormalForm, ApplicationReview, validation, and (later) the WizardForm
// and Friction Engine all read from here.

export const CURRENCY_SYMBOL = "$";

export const EMPLOYMENT_TYPES = [
  "Salaried",
  "Self-employed",
  "Business Owner",
  "Student",
];

export const CREDIT_SCORE_RANGES = [
  "Below 580 (Poor)",
  "580 - 669 (Fair)",
  "670 - 739 (Good)",
  "740 - 799 (Very good)",
  "800 and above (Excellent)",
];

// Order of the form sections (the dashboard sits outside the form flow).
export const FORM_SECTIONS = [
  "personal",
  "employment",
  "financial",
  "documents",
  "review",
];

export const SECTION_META = {
  personal: {
    label: "Personal Information",
    title: "Personal information",
    description: "Tell us who you are so we can verify your application.",
  },
  employment: {
    label: "Employment Details",
    title: "Employment details",
    description: "Share where you work or study.",
  },
  financial: {
    label: "Financial Information",
    title: "Financial information",
    description: "Enter your income, expenses and existing obligations.",
  },
  documents: {
    label: "Document Upload",
    title: "Document upload",
    description: "Upload clear copies of the documents below. PDF, JPG or PNG, up to 5 MB each.",
  },
  review: {
    label: "Application Review",
    title: "Application review",
    description: "Check your answers. Edit any section before you submit.",
  },
};

const notStudent = (data) => data.employment.employmentType !== "Student";

export const FIELDS = {
  personal: [
    { name: "fullName", label: "Full name", required: true },
    { name: "dateOfBirth", label: "Date of birth", required: true, format: "date" },
    { name: "email", label: "Email address", required: true },
    { name: "phone", label: "Phone number", required: true },
    { name: "address", label: "Residential address", required: true },
  ],
  employment: [
    { name: "employmentType", label: "Employment type", required: true },
    { name: "organization", label: "Company or organization", required: true },
    { name: "jobTitle", label: "Job title", required: notStudent },
    { name: "yearsExperience", label: "Years of experience", required: notStudent, format: "years" },
  ],
  financial: [
    { name: "monthlyIncome", label: "Monthly income", required: true, format: "currency" },
    { name: "annualIncome", label: "Annual income", required: true, format: "currency" },
    { name: "monthlyExpenses", label: "Monthly expenses", required: true, format: "currency" },
    { name: "existingLoanAmount", label: "Existing loan amount", required: true, format: "currency" },
    { name: "creditScoreRange", label: "Credit score range", required: true },
  ],
  documents: [
    { name: "identity", label: "Identity document", required: true, format: "file" },
    { name: "addressProof", label: "Address proof", required: true, format: "file" },
    { name: "incomeProof", label: "Income proof", required: true, format: "file" },
  ],
};

export const INITIAL_FORM_DATA = {
  personal: { fullName: "", dateOfBirth: "", email: "", phone: "", address: "" },
  employment: { employmentType: "", organization: "", jobTitle: "", yearsExperience: "" },
  financial: {
    monthlyIncome: "",
    annualIncome: "",
    monthlyExpenses: "",
    existingLoanAmount: "",
    creditScoreRange: "",
  },
  documents: { identity: null, addressProof: null, incomeProof: null },
};
