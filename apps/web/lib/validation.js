import { FIELDS, FORM_SECTIONS } from "./fields";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const isEmpty = (value) =>
  value === undefined || value === null || String(value).trim() === "";

export function isFieldRequired(field, data) {
  return typeof field.required === "function" ? field.required(data) : !!field.required;
}

export function validateFile(file) {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return "Upload a PDF, JPG or PNG file.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "This file is larger than 5 MB. Upload a smaller file.";
  }
  return "";
}

function calculateAge(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
}

function validateNumber(value, label) {
  const n = Number(value);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < 0) return `${label} cannot be negative.`;
  return "";
}

function validateValue(name, rawValue, data) {
  const value = String(rawValue).trim();

  switch (name) {
    case "fullName":
      if (value.length < 2) return "Enter your full name.";
      if (!/^[A-Za-z][A-Za-z\s.'-]*$/.test(value)) {
        return "Use letters, spaces, hyphens or apostrophes only.";
      }
      return "";

    case "dateOfBirth": {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "Enter a valid date.";
      if (date > new Date()) return "Date of birth cannot be in the future.";
      const age = calculateAge(date);
      if (age < 18) return "You must be at least 18 years old to apply.";
      if (age > 110) return "Enter a valid date of birth.";
      return "";
    }

    case "email":
      return EMAIL_RE.test(value) ? "" : "Enter a valid email address, like name@example.com.";

    case "phone": {
      if (!/^\+?[\d\s()-]+$/.test(value)) return "Use digits, spaces, + or - only.";
      const digits = value.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 15) {
        return "Enter a phone number with 10 to 15 digits.";
      }
      return "";
    }

    case "address":
      return value.length >= 10 ? "" : "Enter your full address, including street and city.";

    case "organization":
      return value.length >= 2 ? "" : "Enter at least 2 characters.";

    case "yearsExperience": {
      const n = Number(value);
      if (Number.isNaN(n)) return "Years of experience must be a number.";
      if (n < 0 || n > 60) return "Enter a value between 0 and 60.";
      return "";
    }

    case "monthlyIncome":
      return validateNumber(value, "Monthly income");

    case "annualIncome": {
      const base = validateNumber(value, "Annual income");
      if (base) return base;
      const monthly = data.financial.monthlyIncome;
      if (!isEmpty(monthly) && !Number.isNaN(Number(monthly)) && Number(value) < Number(monthly)) {
        return "Annual income cannot be lower than monthly income.";
      }
      return "";
    }

    case "monthlyExpenses":
      return validateNumber(value, "Monthly expenses");

    case "existingLoanAmount":
      return validateNumber(value, "Existing loan amount");

    default:
      return "";
  }
}

// Returns { fieldName: "message" } for one section.
export function validateSection(sectionId, data) {
  const fields = FIELDS[sectionId];
  if (!fields) return {};
  const errors = {};

  for (const field of fields) {
    const value = data[sectionId][field.name];

    if (sectionId === "documents") {
      if (!value) errors[field.name] = `Upload your ${field.label.toLowerCase()}.`;
      continue;
    }

    if (isEmpty(value)) {
      if (isFieldRequired(field, data)) errors[field.name] = `${field.label} is required.`;
      continue;
    }

    const message = validateValue(field.name, value, data);
    if (message) errors[field.name] = message;
  }

  return errors;
}

export function validateField(sectionId, name, data) {
  return validateSection(sectionId, data)[name] || "";
}

// Returns only the sections that have errors: { personal: {...}, ... }
export function validateAll(data) {
  const result = {};
  for (const sectionId of FORM_SECTIONS) {
    const errors = validateSection(sectionId, data);
    if (Object.keys(errors).length > 0) result[sectionId] = errors;
  }
  return result;
}

export function getSectionProgress(sectionId, data) {
  const fields = FIELDS[sectionId];
  if (!fields) return { filled: 0, total: 0 };
  const errors = validateSection(sectionId, data);
  const required = fields.filter((f) => isFieldRequired(f, data));
  const filled = required.filter(
    (f) => !isEmpty(data[sectionId][f.name]) && !errors[f.name]
  ).length;
  return { filled, total: required.length };
}

export function getOverallProgress(data) {
  let filled = 0;
  let total = 0;
  for (const sectionId of FORM_SECTIONS) {
    const progress = getSectionProgress(sectionId, data);
    filled += progress.filled;
    total += progress.total;
  }
  return {
    filled,
    total,
    percentage: total === 0 ? 0 : Math.round((filled / total) * 100),
  };
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
