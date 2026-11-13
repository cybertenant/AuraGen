"use client";

import { SelectField, TextField } from "@/components/ui/FormControls";
import { EMPLOYMENT_TYPES } from "@/lib/fields";

export default function EmploymentInformation({ data, errors, onChange, onBlur }) {
  const shared = { section: "employment", onChange, onBlur };
  const isStudent = data.employmentType === "Student";

  return (
    <div className="grid gap-5 sm:grid-cols-2" data-section-root="employment">
      <div className="sm:col-span-2">
        <SelectField
          {...shared}
          name="employmentType"
          label="Employment type"
          required
          options={EMPLOYMENT_TYPES}
          value={data.employmentType}
          error={errors.employmentType}
        />
      </div>
      <div className="sm:col-span-2">
        <TextField
          {...shared}
          name="organization"
          label={isStudent ? "School or university" : "Company or organization"}
          required
          autoComplete="organization"
          value={data.organization}
          error={errors.organization}
        />
      </div>
      <TextField
        {...shared}
        name="jobTitle"
        label="Job title"
        required={!isStudent}
        autoComplete="organization-title"
        value={data.jobTitle}
        error={errors.jobTitle}
      />
      <TextField
        {...shared}
        name="yearsExperience"
        label="Years of experience"
        type="number"
        required={!isStudent}
        min="0"
        max="60"
        step="0.5"
        inputMode="decimal"
        value={data.yearsExperience}
        error={errors.yearsExperience}
      />
    </div>
  );
}
