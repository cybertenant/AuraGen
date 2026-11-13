"use client";

import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { useApplication } from "@/context/ApplicationContext";
import { FORM_SECTIONS, SECTION_META } from "@/lib/fields";
import { getSectionProgress } from "@/lib/validation";
import ProgressIndicator from "@/components/ProgressIndicator";
import PersonalInformation from "@/components/PersonalInformation";
import EmploymentInformation from "@/components/EmploymentInformation";
import FinancialInformation from "@/components/FinancialInformation";
import DocumentUpload from "@/components/DocumentUpload";
import ApplicationReview from "@/components/ApplicationReview";
import HelpPanel from "@/components/HelpPanel";

const SHORT_LABELS = {
  personal: "Personal",
  employment: "Employment",
  financial: "Financial",
  documents: "Documents",
  review: "Review",
};

function SuccessMessage({ submission, name, onReset }) {
  const firstName = name ? name.trim().split(/\s+/)[0] : "";
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold text-slate-900">
        {firstName ? `Thank you, ${firstName}. Your application is in.` : "Your application is in."}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        We received your application and will email you once the review is complete.
      </p>
      <dl className="mx-auto mt-6 max-w-xs rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between py-1">
          <dt className="text-slate-500">Reference</dt>
          <dd className="font-semibold text-slate-900">{submission.reference}</dd>
        </div>
        <div className="flex justify-between py-1">
          <dt className="text-slate-500">Submitted</dt>
          <dd className="font-medium text-slate-900">
            {new Date(submission.submittedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={onReset}
        className="mt-6 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        Start a new application
      </button>
    </div>
  );
}

export default function NormalForm() {
  const app = useApplication();
  const { formData, errors, currentSection, submission } = app;

  if (submission) {
    return <SuccessMessage submission={submission} name={formData.personal.fullName} onReset={app.resetApplication} />;
  }

  const steps = FORM_SECTIONS.map((id) => {
    const p = getSectionProgress(id, formData);
    return {
      id,
      shortLabel: SHORT_LABELS[id],
      complete: id === "review" ? false : p.total > 0 && p.filled === p.total,
    };
  });

  const meta = SECTION_META[currentSection];
  const index = FORM_SECTIONS.indexOf(currentSection);
  const isReview = currentSection === "review";
  const sectionErrors = errors[currentSection] || {};
  const sectionData = formData[currentSection];

  const fieldProps = {
    data: sectionData,
    errors: sectionErrors,
    onChange: (name, value) => app.updateField(currentSection, name, value),
    onBlur: (name) => app.blurField(currentSection, name),
  };

  let body = null;
  switch (currentSection) {
    case "personal":
      body = <PersonalInformation {...fieldProps} />;
      break;
    case "employment":
      body = <EmploymentInformation {...fieldProps} />;
      break;
    case "financial":
      body = <FinancialInformation {...fieldProps} />;
      break;
    case "documents":
      body = (
        <DocumentUpload
          data={sectionData}
          errors={sectionErrors}
          onSelect={app.setDocument}
          onRemove={app.removeDocument}
        />
      );
      break;
    case "review":
      body = (
        <ApplicationReview
          formData={formData}
          errors={errors}
          onEdit={app.goToSection}
          onSubmit={app.submitApplication}
        />
      );
      break;
    default:
      body = null;
  }

  const hasSectionErrors = Object.keys(sectionErrors).length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ProgressIndicator
        variant="steps"
        steps={steps}
        currentStep={currentSection}
        onStepClick={app.goToSection}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-8">
        <header className="mb-6">
          <p className="text-sm text-slate-500">
            Step {index + 1} of {FORM_SECTIONS.length}
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{meta.title}</h2>
          <p className="mt-1 text-sm text-slate-600">{meta.description}</p>
          <HelpPanel key={currentSection} sectionId={currentSection} />
        </header>

        {hasSectionErrors && !isReview ? (
          <p role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            Fix the highlighted fields to continue.
          </p>
        ) : null}

        {body}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={app.goPrevious}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {index === 0 ? "Dashboard" : "Previous"}
        </button>
        {!isReview ? (
          <button
            type="button"
            onClick={app.goNext}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            {currentSection === "documents" ? "Review application" : "Next"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
