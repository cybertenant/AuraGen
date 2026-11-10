"use client";

import { FIELD_LABELS } from "@/friction/frictionConfig.js";
import { LEVEL_STYLES } from "@/components/frictionStyles";

function Metric({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2.5 py-1.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}

export default function SectionFrictionList({ sections }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-slate-900">Section-wise friction</h2>
      <p className="mt-1 text-xs text-slate-500">Counts below cover the rolling window only.</p>

      <ul className="mt-4 divide-y divide-slate-100">
        {Object.values(sections).map((section) => {
          const styles = LEVEL_STYLES[section.level];
          const m = section.metrics;
          return (
            <li key={section.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-800">{section.label}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-slate-900">{section.score}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}>
                    {section.level === "low" ? "Low" : section.level === "moderate" ? "Moderate" : "High"}
                  </span>
                </div>
              </div>

              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={section.score}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${section.label} friction`}
              >
                <div className={`h-full rounded-full transition-all duration-500 ${styles.bar}`} style={{ width: `${section.score}%` }} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                <Metric label="Repeated clicks" value={m.repeatedClicks} />
                <Metric label="Hesitations" value={m.hesitationEvents} />
                <Metric label="Validation errors" value={m.validationErrors} />
                <Metric label="Backtracks" value={m.backtracks} />
                <Metric label="Help opens" value={m.helpOpens} />
              </div>

              {section.topErrorField ? (
                <p className="mt-2 text-xs text-slate-500">
                  Most errors:{" "}
                  <span className="font-medium text-slate-700">
                    {FIELD_LABELS[section.topErrorField.fieldId] || section.topErrorField.fieldId}
                  </span>{" "}
                  ({section.topErrorField.count})
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
