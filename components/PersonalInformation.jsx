"use client";

import { TextAreaField, TextField } from "@/components/ui/FormControls";

const today = new Date().toISOString().slice(0, 10);

export default function PersonalInformation({ data, errors, onChange, onBlur }) {
  const shared = { section: "personal", onChange, onBlur };

  return (
    <div className="grid gap-5 sm:grid-cols-2" data-section-root="personal">
      <div className="sm:col-span-2">
        <TextField
          {...shared}
          name="fullName"
          label="Full name"
          required
          autoComplete="name"
          placeholder="As shown on your identity document"
          value={data.fullName}
          error={errors.fullName}
        />
      </div>
      <TextField
        {...shared}
        name="dateOfBirth"
        label="Date of birth"
        type="date"
        required
        max={today}
        autoComplete="bday"
        value={data.dateOfBirth}
        error={errors.dateOfBirth}
      />
      <TextField
        {...shared}
        name="phone"
        label="Phone number"
        type="tel"
        required
        inputMode="tel"
        autoComplete="tel"
        placeholder="+1 555 123 4567"
        value={data.phone}
        error={errors.phone}
      />
      <div className="sm:col-span-2">
        <TextField
          {...shared}
          name="email"
          label="Email address"
          type="email"
          required
          autoComplete="email"
          placeholder="name@example.com"
          value={data.email}
          error={errors.email}
        />
      </div>
      <div className="sm:col-span-2">
        <TextAreaField
          {...shared}
          name="address"
          label="Residential address"
          required
          autoComplete="street-address"
          placeholder="Street, city, state and postal code"
          value={data.address}
          error={errors.address}
        />
      </div>
    </div>
  );
}
