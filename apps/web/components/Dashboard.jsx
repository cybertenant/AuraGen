"use client";

import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useApplication } from "@/context/ApplicationContext";
import { FORM_SECTIONS, SECTION_META } from "@/lib/fields";
import { getSectionProgress } from "@/lib/validation";
import ProgressIndicator from "@/components/ProgressIndicator";

const SUMMARY_SECTIONS = ["personal", "employment", "financial", "documents"];

export default function Dashboard() {
  const { formData, progress, status, submission, goToSection } = useApplication();

  const name = formData.personal.fullName.trim();
  const firstName = name ? name.split(/\s+/)[0] : "";

  const nextSection =
    SUMMARY_SECTIONS.find((id) => {
      const p = getSectionProgress(id, formData);
      return p.filled < p.total;
    }) || "review";

  const ctaLabel = submission
    ? "View application"
    : progress.percentage === 0
    ? "Start application"
    : progress.percentage === 100
    ? "Review and submit"
    : "Continue application";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          {firstName ? `Welcome back, ${firstName}` : "Welcome to AuraGen"}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete the four sections below, then review and submit your application.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">Application status</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{status}</p>
          </div>
          <button
            type="button"
            onClick={() => goToSection(submission ? "personal" : nextSection)}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5">
          <ProgressIndicator variant="bar" percentage={progress.percentage} />
          <p className="mt-2 text-xs text-slate-500">
            {progress.filled} of {progress.total} required items completed
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
        <h2 className="text-base font-semibold text-slate-900">Form completion summary</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {SUMMARY_SECTIONS.map((id) => {
            const p = getSectionProgress(id, formData);
            const done = p.total > 0 && p.filled === p.total;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => goToSection(id)}
                  className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50 sm:px-2 sm:-mx-2 sm:rounded-lg"
                >
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-slate-300" aria-hidden="true" />
                  )}
                  <span className="flex-1 text-sm font-medium text-slate-800">{SECTION_META[id].label}</span>
                  <span className="text-xs text-slate-500">
                    {p.filled}/{p.total} fields
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
