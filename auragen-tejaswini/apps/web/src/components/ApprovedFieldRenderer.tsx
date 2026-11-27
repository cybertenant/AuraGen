"use client";

import type { GeneratedField } from "@tejaswini/shared";
import { cn } from "@/lib/utils";

export type FieldValue = string | boolean;

interface ApprovedFieldRendererProps {
  field: GeneratedField;
  value?: FieldValue;
  onChange: (value: FieldValue) => void;
}

/**
 * Guardrail 2: a fixed registry of approved controls.
 * No dynamic tag names and no dangerouslySetInnerHTML are used anywhere.
 */
export function ApprovedFieldRenderer({
  field,
  value,
  onChange,
}: ApprovedFieldRendererProps) {
  const id = `field-${field.id}`;
  const textValue = typeof value === "string" ? value : "";
  const checked = value === true;
  const controlClass = cn(
    "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100",
    "placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
  );

  switch (field.component) {
    case "text":
      return (
        <input
          id={id}
          data-testid={id}
          type="text"
          className={controlClass}
          value={textValue}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "number":
      return (
        <input
          id={id}
          data-testid={id}
          type="number"
          className={controlClass}
          value={textValue}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "textarea":
      return (
        <textarea
          id={id}
          data-testid={id}
          className={controlClass}
          value={textValue}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    case "select":
      return (
        <select
          id={id}
          data-testid={id}
          className={controlClass}
          value={textValue}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose one</option>
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    case "checkbox":
      return (
        <label htmlFor={id} className="flex items-start gap-3 text-sm text-slate-200">
          <input
            id={id}
            data-testid={id}
            type="checkbox"
            className="mt-0.5 accent-emerald-500"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    default:
      return null;
  }
}
