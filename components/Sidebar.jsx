"use client";

import {
  Check,
  ClipboardCheck,
  FileUp,
  Landmark,
  LayoutDashboard,
  Briefcase,
  User,
  Wallet,
  Activity,
  X,
} from "lucide-react";
import { useApplication } from "@/context/ApplicationContext";
import { getSectionProgress } from "@/lib/validation";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "personal", label: "Personal Information", icon: User },
  { id: "employment", label: "Employment Details", icon: Briefcase },
  { id: "financial", label: "Financial Information", icon: Wallet },
  { id: "documents", label: "Document Upload", icon: FileUp },
  { id: "review", label: "Application Review", icon: ClipboardCheck },
  { id: "friction", label: "Friction Monitor", icon: Activity },
];

const STATUS_STYLES = {
  "Not started": "bg-slate-100 text-slate-700",
  "In progress": "bg-blue-100 text-blue-700",
  "Ready to submit": "bg-amber-100 text-amber-800",
  Submitted: "bg-emerald-100 text-emerald-700",
};

export default function Sidebar({ open, onClose }) {
  const { currentSection, goToSection, formData, progress, status } = useApplication();

  const handleSelect = (id) => {
    goToSection(id);
    onClose();
  };

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden="true" />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Primary"
      >
        <div className="flex items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold leading-none text-slate-900">AuraGen</p>
              <p className="mt-1 text-xs text-slate-500">Financial applications</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="space-y-1">
            {NAV.map(({ id, label, icon: Icon }) => {
              const active = currentSection === id;
              const p = id === "dashboard" || id === "review" ? null : getSectionProgress(id, formData);
              const complete = p && p.total > 0 && p.filled === p.total;
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                      active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    {complete ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <Check className="h-3 w-3" aria-label="Complete" />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="m-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-medium text-slate-500">Application status</p>
          <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}>
            {status}
          </span>
          <p className="mt-3 text-xs text-slate-500">{progress.percentage}% complete</p>
        </div>
      </aside>
    </>
  );
}
