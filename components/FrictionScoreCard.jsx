"use client";

import { LEVEL_STYLES } from "@/components/frictionStyles";

// Score 0-100 with a level badge and a bar that shows the threshold marks.
export default function FrictionScoreCard({ title, score, level, thresholds, caption }) {
  const styles = LEVEL_STYLES[level];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums text-slate-900">
            {score}
            <span className="ml-1 text-base font-normal text-slate-400">/ 100</span>
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>{styles.label}</span>
      </div>

      <div className="relative mt-5">
        <div
          className="h-3 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={title}
        >
          <div className={`h-full rounded-full transition-all duration-500 ${styles.bar}`} style={{ width: `${score}%` }} />
        </div>
        {[thresholds.moderate, thresholds.high].map((mark) => (
          <span
            key={mark}
            className="absolute top-0 h-3 w-px bg-white"
            style={{ left: `${mark}%` }}
            aria-hidden="true"
          />
        ))}
        <div className="relative mt-1.5 h-4 text-[11px] text-slate-400">
          <span className="absolute left-0">0</span>
          {[thresholds.moderate, thresholds.high].map((mark) => (
            <span key={mark} className="absolute -translate-x-1/2" style={{ left: `${mark}%` }}>
              {mark}
            </span>
          ))}
          <span className="absolute right-0">100</span>
        </div>
      </div>
      {caption ? <p className="mt-3 text-xs text-slate-500">{caption}</p> : null}
    </div>
  );
}
