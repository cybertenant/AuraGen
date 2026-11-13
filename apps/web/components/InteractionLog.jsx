"use client";

import { SECTION_LABELS } from "@/friction/frictionConfig.js";

function formatTime(t) {
  return new Date(t).toLocaleTimeString("en-US", { hour12: false });
}

// Shows what happened and where. It never shows field values.
export default function InteractionLog({ log }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-slate-900">Recent interaction log</h2>

      {log.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          No friction events yet. Fill in the form, then try clicking one field several times, leaving a field
          idle, or submitting invalid answers.
        </p>
      ) : (
        <ul className="mt-4 max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {log.map((entry) => (
            <li key={entry.id} className="flex items-start gap-3 py-2.5">
              <time className="mt-0.5 w-16 shrink-0 text-xs tabular-nums text-slate-400">{formatTime(entry.t)}</time>
              <p className="flex-1 text-sm text-slate-700">{entry.message}</p>
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {SECTION_LABELS[entry.sectionId] || entry.sectionId}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
