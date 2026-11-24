
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
import useFieldTracking from "@/hooks/useFieldTracking";
import useFrictionEngine from "@/hooks/useFrictionEngine";
import useCognitiveLoad from "@/hooks/useCognitiveLoad";
import useAdaptiveUI from "@/hooks/useAdaptiveUI";
import useErrorTracking from "@/hooks/useErrorTracking";
import useFrictionAnalysis from "@/hooks/useFrictionAnalysis";
import useFrictionGuidance from "@/hooks/useFrictionGuidance";


const SHORT_LABELS = {
  personal: "Personal",
  employment: "Employment",
  financial: "Financial",
  documents: "Documents",
  review: "Review",
};

function formatTime(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const remainingMs = milliseconds % 1000;

  if (seconds < 60) {
    return `${seconds}.${Math.floor(remainingMs / 100)} seconds`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}

function SuccessMessage({ submission, name, onReset }) {
  const firstName = name ? name.trim().split(/\s+/)[0] : "";

  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden="true" />
      </div>

      <h2 className="text-xl font-semibold text-slate-900">
        {firstName
          ? `Thank you, ${firstName}. Your application is in.`
          : "Your application is in."}
      </h2>

      <p className="mt-2 text-sm text-slate-600">
        We received your application and will email you once the review is complete.
      </p>

      <dl className="mx-auto mt-6 max-w-xs rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between py-1">
          <dt className="text-slate-500">Reference</dt>
          <dd className="font-semibold text-slate-900">
            {submission.reference}
          </dd>
        </div>

        <div className="flex justify-between py-1">
          <dt className="text-slate-500">Submitted</dt>
          <dd className="font-medium text-slate-900">
            {new Date(submission.submittedAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
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

  // Day 5: Field interaction tracking
  const fieldData = useFieldTracking();

  // Day 1–3: Cursor and hesitation tracking
  const cursorData = useFrictionEngine();

  // Day 6: Cognitive load calculation
  const cognitiveLoad = useCognitiveLoad(cursorData, fieldData);

  // Day 7: Adaptive UI guidance
  const adaptiveUI = useAdaptiveUI(cognitiveLoad, fieldData);

  // Day 10–11: Validation error and pattern tracking
  const errorData = useErrorTracking(app.errors);

  // Day 12: User friction pattern analysis
  const frictionAnalysis = useFrictionAnalysis(fieldData, errorData);

  // Day 13: Friction-based adaptive guidance
  const frictionGuidance = useFrictionGuidance(frictionAnalysis, fieldData);

  const { formData, errors, currentSection, submission } = app;

  if (submission) {
    return (
      <SuccessMessage
        submission={submission}
        name={formData.personal.fullName}
        onReset={app.resetApplication}
      />
    );
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
    adaptiveGuidance: adaptiveUI,
    frictionGuidance: frictionGuidance,
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
          adaptiveGuidance={adaptiveUI}
          frictionGuidance={frictionGuidance}
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

  const scoreColor =
    cognitiveLoad.level === "High"
      ? "text-red-600"
      : cognitiveLoad.level === "Moderate"
        ? "text-amber-600"
        : "text-emerald-600";

  const scoreBackground =
    cognitiveLoad.level === "High"
      ? "bg-red-50 border-red-200"
      : cognitiveLoad.level === "Moderate"
        ? "bg-amber-50 border-amber-200"
        : "bg-emerald-50 border-emerald-200";

  const frictionLevelColor = (level) => {
    if (level === "High") return "text-red-600";
    if (level === "Moderate") return "text-amber-600";
    return "text-emerald-600";
  };

  const frictionLevelBackground = (level) => {
    if (level === "High") return "bg-red-50";
    if (level === "Moderate") return "bg-amber-50";
    return "bg-emerald-50";
  };

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

          <h2 className="mt-1 text-xl font-semibold text-slate-900">
            {meta.title}
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            {meta.description}
          </p>
        </header>

        {hasSectionErrors && !isReview ? (
          <p
            role="alert"
            className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            Fix the highlighted fields to continue.
          </p>
        ) : null}

        {body}

        {/* Day 6: Cognitive Load Score */}
        <div className="mt-6 rounded-xl border border-purple-200 bg-white p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            AuraGen Cognitive Load Analysis
          </h3>

          <div className={`rounded-xl border p-5 ${scoreBackground}`}>
            <p className="text-sm font-medium text-slate-600">
              Estimated Cognitive Load Score
            </p>

            <div className="mt-2 flex items-end gap-2">
              <span className={`text-5xl font-bold ${scoreColor}`}>
                {cognitiveLoad.score}
              </span>
              <span className="mb-1 text-sm text-slate-500">/ 100</span>
            </div>

            <p className={`mt-2 font-semibold ${scoreColor}`}>
              {cognitiveLoad.level} Interaction Difficulty
            </p>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-300 ${cognitiveLoad.level === "High"
                  ? "bg-red-500"
                  : cognitiveLoad.level === "Moderate"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  }`}
                style={{ width: `${cognitiveLoad.score}%` }}
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Hesitation Score</p>
              <p className="mt-1 text-xl font-bold text-purple-600">
                {cognitiveLoad.hesitationScore}/40
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {cursorData.hesitationCount} pauses detected
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Repeat Visit Score</p>
              <p className="mt-1 text-xl font-bold text-purple-600">
                {cognitiveLoad.repeatVisitScore}/30
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {cognitiveLoad.repeatedVisits} repeat visits
              </p>
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Time Score</p>
              <p className="mt-1 text-xl font-bold text-purple-600">
                {cognitiveLoad.timeScore}/30
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Longest field: {formatTime(cognitiveLoad.maximumFieldTime)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            This is an experimental interaction-difficulty estimate based on
            cursor pauses, repeated field visits, and field time. It is not a
            validated psychological measurement.
          </p>
        </div>

        {/* Day 7: Adaptive UI Status */}
        <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50/50 p-5">
          <h3 className="text-lg font-semibold text-slate-800">
            AuraGen Adaptive UI
          </h3>

          <p className="mt-2 text-sm text-slate-600">
            Current adaptation level:{" "}
            <span className="font-semibold capitalize text-indigo-700">
              {adaptiveUI.level}
            </span>
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Active field:{" "}
            {adaptiveUI.section && adaptiveUI.field
              ? `${adaptiveUI.section}.${adaptiveUI.field}`
              : "Waiting for field interaction"}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            Field-specific guidance will appear beside the relevant form field.
          </p>
        </div>

        {/* Advanced Field Tracking */}
        <div className="mt-6 rounded-xl border border-blue-200 bg-slate-50 p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            AuraGen Field Tracking
          </h3>

          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Current Section</p>
              <p className="font-semibold text-slate-800">
                {fieldData.section || "Waiting..."}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Current Field</p>
              <p className="font-semibold text-slate-800">
                {fieldData.field || "Waiting..."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Focus Count</p>
              <p className="text-xl font-bold text-blue-600">
                {fieldData.interactionCount}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Typing Count</p>
              <p className="text-xl font-bold text-blue-600">
                {fieldData.typingCount}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Blur Count</p>
              <p className="text-xl font-bold text-blue-600">
                {fieldData.blurCount}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Total Interactions</p>
              <p className="text-xl font-bold text-blue-600">
                {fieldData.totalInteractionCount}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Total Time Spent</p>
              <p className="text-lg font-bold text-blue-600">
                {formatTime(fieldData.timeSpentMs)}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Last Interaction</p>
              <p className="font-semibold text-slate-800">
                {fieldData.lastInteraction || "None"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              Individual Field Time
            </h4>

            {Object.keys(fieldData.fieldTimes).length === 0 ? (
              <p className="text-sm text-slate-500">
                No completed field interactions yet.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(fieldData.fieldTimes).map(
                  ([field, duration]) => (
                    <div
                      key={field}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-700">
                        {field}
                      </span>
                      <span className="font-semibold text-blue-600">
                        {formatTime(duration)}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {/* Day 10: Validation Error Tracking */}
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50/40 p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            AuraGen Validation Error Monitoring
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">Total Validation Errors</p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {errorData.totalErrors}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">
                Fields That Triggered Errors
              </p>
              <p className="mt-1 text-2xl font-bold text-red-600">
                {Object.keys(errorData.fieldErrorCounts).length}
              </p>
            </div>
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              Field-wise Error Counts
            </h4>

            {Object.keys(errorData.fieldErrorCounts).length === 0 ? (
              <p className="text-sm text-slate-500">
                No validation errors detected yet.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(errorData.fieldErrorCounts).map(
                  ([field, count]) => (
                    <div
                      key={field}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-700">
                        {field}
                      </span>
                      <span className="font-semibold text-red-600">
                        {count}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {errorData.lastError ? (
            <div className="mt-4 rounded-lg border border-red-200 bg-white p-3">
              <p className="text-xs font-semibold text-red-600">
                Last Detected Error
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {errorData.lastError.section}.{errorData.lastError.field}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {errorData.lastError.message}
              </p>
            </div>
          ) : null}

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Counts validation error occurrences during this browser session.
            It does not measure the user's actual mental state.
          </p>
        </div>

        {/* Day 11: Error Pattern Analysis */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/40 p-5">
          <h3 className="mb-4 text-lg font-semibold text-slate-800">
            AuraGen Error Pattern Analysis
          </h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">
                Repeated Error Fields
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-600">
                {errorData.repeatedErrorFields.length}
              </p>
            </div>

            <div className="rounded-lg bg-white p-3">
              <p className="text-xs text-slate-500">
                Most Error-Prone Field
              </p>
              <p className="mt-1 text-sm font-bold text-amber-700">
                {errorData.mostErrorProneField
                  ? errorData.mostErrorProneField[0]
                  : "No errors yet"}
              </p>

              {errorData.mostErrorProneField ? (
                <p className="mt-1 text-xs text-slate-500">
                  {errorData.mostErrorProneField[1]} error occurrences
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              Section-wise Error Analysis
            </h4>

            {Object.keys(errorData.sectionErrorCounts).length === 0 ? (
              <p className="text-sm text-slate-500">
                No section patterns available yet.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(errorData.sectionErrorCounts).map(
                  ([section, count]) => (
                    <div
                      key={section}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium capitalize text-slate-700">
                        {section}
                      </span>
                      <span className="font-semibold text-amber-600">
                        {count}
                      </span>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <div className="mt-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              Repeated Error Fields
            </h4>

            {errorData.repeatedErrorFields.length === 0 ? (
              <p className="text-sm text-slate-500">
                No repeated field errors detected yet.
              </p>
            ) : (
              <div className="space-y-2">
                {errorData.repeatedErrorFields.map(([field, count]) => (
                  <div
                    key={field}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                  >
                    <span className="font-medium text-slate-700">
                      {field}
                    </span>
                    <span className="font-semibold text-amber-600">
                      {count} times
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-white p-3">
            <p className="text-xs font-semibold text-amber-700">
              Most Error-Prone Section
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {errorData.mostErrorProneSection
                ? `${errorData.mostErrorProneSection[0]} (${errorData.mostErrorProneSection[1]} errors)`
                : "No errors detected yet"}
            </p>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            This analysis summarizes validation error patterns during the
            current browser session. It does not identify the cause of an
            error or measure a user's actual mental state.
          </p>
        </div>

        {/* Day 12: User Friction Pattern Analysis */}
        <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50/40 p-5">
          <h3 className="mb-2 text-lg font-semibold text-slate-800">
            AuraGen User Friction Analysis
          </h3>

          <p className="mb-4 text-xs leading-5 text-slate-500">
            This analysis combines field interaction time, repeated visits,
            and validation errors to identify fields that may be difficult
            to complete.
          </p>

          {/* Most Difficult Field */}
          <div className="rounded-lg border border-teal-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">
              Most Difficult Field
            </p>

            {frictionAnalysis.mostDifficultField ? (
              <>
                <p className="mt-1 text-lg font-bold text-teal-700">
                  {frictionAnalysis.mostDifficultField[0]}
                </p>

                <p className="mt-1 text-sm text-slate-600">
                  Friction Score:{" "}
                  <span className="font-bold">
                    {frictionAnalysis.mostDifficultField[1].totalScore}/100
                  </span>
                </p>

                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${frictionLevelBackground(
                    frictionAnalysis.mostDifficultField[1].level
                  )} ${frictionLevelColor(
                    frictionAnalysis.mostDifficultField[1].level
                  )}`}
                >
                  {frictionAnalysis.mostDifficultField[1].level} Friction
                </span>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Interact with form fields to generate friction analysis.
              </p>
            )}
          </div>

          {/* Individual Field Friction */}
          <div className="mt-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              Individual Field Friction Scores
            </h4>

            {Object.keys(frictionAnalysis.fieldFriction).length === 0 ? (
              <p className="text-sm text-slate-500">
                No field friction data available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(frictionAnalysis.fieldFriction).map(
                  ([field, data]) => (
                    <div
                      key={field}
                      className="rounded-lg bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-700">
                          {field}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${frictionLevelBackground(
                            data.level
                          )} ${frictionLevelColor(data.level)}`}
                        >
                          {data.level}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-sm">
                        <span className="text-slate-500">
                          Friction Score
                        </span>
                        <span className="font-bold text-teal-700">
                          {data.totalScore}/100
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${data.totalScore}%` }}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-slate-500">Time</p>
                          <p className="font-semibold text-slate-700">
                            {formatTime(data.timeSpent)}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500">Visits</p>
                          <p className="font-semibold text-slate-700">
                            {data.visits}
                          </p>
                        </div>

                        <div>
                          <p className="text-slate-500">Errors</p>
                          <p className="font-semibold text-slate-700">
                            {data.errors}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Section-wise Friction */}
          <div className="mt-5">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              Section-wise Friction Analysis
            </h4>

            {Object.keys(frictionAnalysis.sectionFriction).length === 0 ? (
              <p className="text-sm text-slate-500">
                No section friction data available yet.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(frictionAnalysis.sectionFriction).map(
                  ([section, data]) => (
                    <div
                      key={section}
                      className="rounded-lg bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold capitalize text-slate-700">
                          {section}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${frictionLevelBackground(
                            data.level
                          )} ${frictionLevelColor(data.level)}`}
                        >
                          {data.level}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-600">
                        Average Friction Score:{" "}
                        <span className="font-bold text-teal-700">
                          {data.averageScore}/100
                        </span>
                      </p>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-teal-500 transition-all duration-300"
                          style={{ width: `${data.averageScore}%` }}
                        />
                      </div>

                      <p className="mt-2 text-xs text-slate-500">
                        {data.fieldCount} tracked fields · {data.totalVisits} visits ·{" "}
                        {data.totalErrors} errors · {formatTime(data.totalTime)}
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          {/* Most Difficult Section */}
          <div className="mt-5 rounded-lg border border-teal-200 bg-white p-4">
            <p className="text-xs font-semibold text-teal-700">
              Most Difficult Section
            </p>

            <p className="mt-1 text-sm font-semibold text-slate-800">
              {frictionAnalysis.mostDifficultSection
                ? `${frictionAnalysis.mostDifficultSection[0]} (${frictionAnalysis.mostDifficultSection[1].averageScore}/100)`
                : "No section data available yet"}
            </p>
          </div>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            Friction scores are experimental indicators based on observed
            interactions. Longer completion time or repeated visits do not
            necessarily mean a user is confused. Cursor hesitation is tracked
            separately at the overall session level and is not assigned to
            individual fields.
          </p>
        </div>
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
            {currentSection === "documents"
              ? "Review application"
              : "Next"}

            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
