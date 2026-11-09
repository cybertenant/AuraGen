"use client";

import { AlertCircle, FileText, Pencil, Send } from "lucide-react";
import { CURRENCY_SYMBOL, FIELDS, SECTION_META } from "@/lib/fields";
import { formatFileSize, isEmpty } from "@/lib/validation";

const REVIEW_SECTIONS = ["personal", "employment", "financial", "documents"];

function displayValue(field, value) {
  if (field.format === "file") {
    return value ? `${value.name} (${formatFileSize(value.size)})` : "";
  }
  if (isEmpty(value)) return "";
  if (field.format === "currency") {
    const n = Number(value);
    return Number.isNaN(n)
      ? String(value)
      : `${CURRENCY_SYMBOL}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  if (field.format === "years") return `${value} ${Number(value) === 1 ? "year" : "years"}`;
  if (field.format === "date") {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  }
  return String(value);
}

export default function ApplicationReview({ formData, errors, onEdit, onSubmit }) {
  const hasErrors = Object.values(errors).some((s) => s && Object.keys(s).length > 0);

  return (
    <div className="space-y-5" data-section-root="review">
      {hasErrors ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Some answers are missing or need fixing. Edit the sections marked below, then submit again.</p>
        </div>
      ) : null}

      {REVIEW_SECTIONS.map((sectionId) => {
        const sectionErrors = errors[sectionId] || {};
        return (
          <section key={sectionId} className="rounded-xl border border-slate-200 bg-white">
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <h3 className="text-sm font-semibold text-slate-900">{SECTION_META[sectionId].title}</h3>
              <button
                type="button"
                onClick={() => onEdit(sectionId)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                Edit {SECTION_META[sectionId].title.toLowerCase()}
              </button>
            </header>
            <dl className="divide-y divide-slate-100">
              {FIELDS[sectionId].map((field) => {
                const value = displayValue(field, formData[sectionId][field.name]);
                const missing = !value;
                const isOptionalBlank = missing && field.required !== true && typeof field.required !== "function";
                return (
                  <div key={field.name} className="grid gap-1 px-5 py-3 sm:grid-cols-3 sm:gap-4">
                    <dt className="text-sm text-slate-500">{field.label}</dt>
                    <dd className="text-sm sm:col-span-2">
                      {value ? (
                        <span className="flex items-center gap-2 font-medium text-slate-900">
                          {field.format === "file" ? <FileText className="h-4 w-4 text-slate-400" aria-hidden="true" /> : null}
                          <span className="whitespace-pre-line break-words">{value}</span>
                        </span>
                      ) : (
                        <span className={isOptionalBlank ? "text-slate-400" : "text-red-600"}>
                          {sectionErrors[field.name] || "Not provided"}
                        </span>
                      )}
                      {value && sectionErrors[field.name] ? (
                        <span className="mt-0.5 block text-xs text-red-600">{sectionErrors[field.name]}</span>
                      ) : null}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Submit application
        </button>
      </div>
    </div>
  );
}
