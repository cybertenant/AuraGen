import React from "react";
import { Sparkles } from "lucide-react";
import { GuidedSessionPanel } from "@/components/guided/GuidedSessionPanel";
import {
  GuidedSessionSchema,
  type GuidedSession,
} from "@/components/guided/guided-session.contract";

/**
 * Static demo session. In production this payload would be produced by the
 * Gemini agent and validated by GuidedSessionSchema before it reaches the
 * renderer. Only field IDs and labels are present - no user values.
 */
const DEMO_SESSION: GuidedSession = GuidedSessionSchema.parse({
  id: "6f0c1d2e-8b4a-4c31-9f5d-2a7e6c1b90d4",
  title: "Simplified loan application",
  frictionLevel: "high",
  frictionScore: 78,
  steps: [
    {
      id: "step-annual-income",
      fieldId: "annualIncome",
      title: "What is your approximate annual income?",
      helperText: "A rounded estimate is fine for this demo.",
      component: "number",
      required: true,
    },
    {
      id: "step-loan-purpose",
      fieldId: "loanPurpose",
      title: "What will the loan be used for?",
      helperText: "Choose the option that fits best.",
      component: "select",
      options: [
        { value: "working_capital", label: "Working capital" },
        { value: "equipment_acquisition", label: "Equipment acquisition" },
        { value: "debt_refinancing", label: "Debt refinancing" },
        { value: "commercial_expansion", label: "Commercial expansion" },
      ],
      required: true,
    },
    {
      id: "step-declaration",
      fieldId: "syntheticDataDeclaration",
      title: "Confirm synthetic demo data",
      helperText: "I confirm that all entered data is synthetic demo data.",
      component: "confirm",
      required: true,
    },
  ],
});

export default function GuidedSessionPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Sparkles className="h-3.5 w-3.5" />
            Self-healing UI · Guided experience
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            A guided, one-question-at-a-time application
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            When sustained interaction friction is detected, AuraGen replaces a
            dense form with this conversational flow. Every step is a
            Zod-validated schema rendered from an approved component registry.
          </p>
        </div>

        <GuidedSessionPanel session={DEMO_SESSION} />
      </div>
    </main>
  );
}
