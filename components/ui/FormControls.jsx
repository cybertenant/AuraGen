
"use client";

import { AlertCircle, Lightbulb } from "lucide-react";

const baseInput =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25";

const inputClass = (error) =>
  `${baseInput} ${error ? "border-red-400 bg-red-50/40" : "border-slate-300 hover:border-slate-400"}`;

export function FieldShell({
  id,
  label,
  required,
  error,
  hint,
  adaptiveMessage,
  children,
}) {
  const describedBy = [
    error ? `${id}-error` : null,
    hint && !error ? `${id}-hint` : null,
    adaptiveMessage ? `${id}-adaptive` : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-slate-700"
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-slate-400">
            Optional
          </span>
        )}
      </label>

      {children(describedBy)}

      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}

      {adaptiveMessage ? (
        <p
          id={`${id}-adaptive`}
          className="mt-2 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs leading-5 text-indigo-800"
        >
          <Lightbulb
            className="mt-0.5 h-4 w-4 shrink-0"
            aria-hidden="true"
          />
          <span>{adaptiveMessage}</span>
        </p>
      ) : null}

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600"
        >
          <AlertCircle
            className="mt-px h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

function getAdaptiveMessage(adaptiveGuidance, section, name) {
  if (
    adaptiveGuidance?.section === section &&
    adaptiveGuidance?.field === name &&
    adaptiveGuidance?.isAdaptive
  ) {
    return adaptiveGuidance.message;
  }

  return "";
}

export function TextField({
  section,
  name,
  label,
  value,
  error,
  required,
  hint,
  prefix,
  type = "text",
  onChange,
  onBlur,
  adaptiveGuidance,
  ...rest
}) {
  const id = `${section}-${name}`;
  const adaptiveMessage = getAdaptiveMessage(
    adaptiveGuidance,
    section,
    name
  );

  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      adaptiveMessage={adaptiveMessage}
    >
      {(describedBy) => (
        <div className="relative">
          {prefix ? (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-slate-500">
              {prefix}
            </span>
          ) : null}

          <input
            id={id}
            name={name}
            type={type}
            value={value}
            data-section={section}
            data-field={name}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={describedBy}
            onChange={(e) => onChange(name, e.target.value)}
            onBlur={() => onBlur(name)}
            className={`${inputClass(error)} ${prefix ? "pl-8" : ""}`}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  );
}

export function SelectField({
  section,
  name,
  label,
  value,
  error,
  required,
  hint,
  options,
  placeholder = "Select an option",
  onChange,
  onBlur,
  adaptiveGuidance,
}) {
  const id = `${section}-${name}`;
  const adaptiveMessage = getAdaptiveMessage(
    adaptiveGuidance,
    section,
    name
  );

  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      adaptiveMessage={adaptiveMessage}
    >
      {(describedBy) => (
        <select
          id={id}
          name={name}
          value={value}
          data-section={section}
          data-field={name}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          className={inputClass(error)}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

export function TextAreaField({
  section,
  name,
  label,
  value,
  error,
  required,
  hint,
  rows = 3,
  onChange,
  onBlur,
  adaptiveGuidance,
  ...rest
}) {
  const id = `${section}-${name}`;
  const adaptiveMessage = getAdaptiveMessage(
    adaptiveGuidance,
    section,
    name
  );

  return (
    <FieldShell
      id={id}
      label={label}
      required={required}
      error={error}
      hint={hint}
      adaptiveMessage={adaptiveMessage}
    >
      {(describedBy) => (
        <textarea
          id={id}
          name={name}
          rows={rows}
          value={value}
          data-section={section}
          data-field={name}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={describedBy}
          onChange={(e) => onChange(name, e.target.value)}
          onBlur={() => onBlur(name)}
          className={inputClass(error)}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
