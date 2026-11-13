"use client";

import { AlertCircle, CheckCircle2, FileText, Trash2, UploadCloud } from "lucide-react";
import { FIELDS } from "@/lib/fields";
import { formatFileSize } from "@/lib/validation";

const HINTS = {
  identity: "Passport, driver's license or national ID.",
  addressProof: "Utility bill or bank statement from the last 3 months.",
  incomeProof: "Recent payslip, tax return or bank statement.",
};

function UploadSlot({ field, file, error, onSelect, onRemove }) {
  const id = `documents-${field.name}`;

  const handleChange = (event) => {
    const selected = event.target.files && event.target.files[0];
    if (selected) onSelect(field.name, selected);
    event.target.value = ""; // lets the user re-select the same file
  };

  return (
    <div data-section="documents" data-field={field.name}>
      <p className="mb-1.5 text-sm font-medium text-slate-700">
        {field.label}
        <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>
      </p>

      {file ? (
        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5">
          <FileText className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
          </div>
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <button
            type="button"
            onClick={() => onRemove(field.name)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-white hover:text-red-600"
            aria-label={`Remove ${field.label.toLowerCase()}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border border-dashed p-4 transition-colors hover:border-blue-400 hover:bg-blue-50/40 ${
            error ? "border-red-400 bg-red-50/40" : "border-slate-300 bg-white"
          }`}
        >
          <UploadCloud className="h-6 w-6 shrink-0 text-blue-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-slate-800">Choose a file</p>
            <p className="text-xs text-slate-500">{HINTS[field.name]}</p>
          </div>
          <input
            id={id}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleChange}
            className="sr-only"
            aria-invalid={error ? "true" : "false"}
          />
        </label>
      )}

      {error ? (
        <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export default function DocumentUpload({ data, errors, onSelect, onRemove }) {
  return (
    <div className="space-y-5" data-section-root="documents">
      {FIELDS.documents.map((field) => (
        <UploadSlot
          key={field.name}
          field={field}
          file={data[field.name]}
          error={errors[field.name]}
          onSelect={onSelect}
          onRemove={onRemove}
        />
      ))}
      <p className="text-xs text-slate-500">
        Files stay in your browser for now. Nothing is sent to a server.
      </p>
    </div>
  );
}
