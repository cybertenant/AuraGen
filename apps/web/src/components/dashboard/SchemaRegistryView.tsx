"use client";

import React, { useState } from "react";
import {
  Layers,
  Code2,
  CheckCircle2,
  ShieldCheck,
  Terminal,
  Sparkles,
} from "lucide-react";
import {
  FinancialLoanApplicationSchema,
  TelemetrySnapshotSchema,
  CreateFrictionEventInputSchema,
} from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SCHEMA_CATALOG = [
  {
    id: "FinancialLoanApplicationSchema",
    package: "@auragen/shared",
    category: "Form Validation (15 Fields / 5 Sections)",
    description:
      "Validates Personal Information, Employment Details, Financial Information, Loan Details, and Synthetic Data Attestations.",
    fields: [
      "fullName: z.string().min(3)",
      "emailAddress: z.string().email()",
      "phoneNumber: z.string().min(7)",
      "residencyPostalCode: z.string().min(4)",
      "employmentStatus: z.enum(['full_time','self_employed','contractor','business_owner'])",
      "employerOrEntityName: z.string().min(2)",
      "yearsInCurrentRole: z.coerce.number().min(0).max(60)",
      "annualIncome: z.coerce.number().min(12000).max(50000000)",
      "monthlyHousingOrLeaseCost: z.coerce.number().min(0)",
      "existingMonthlyDebtObligations: z.coerce.number().min(0)",
      "liquidReservesUsd: z.coerce.number().min(0)",
      "requestedLoanAmount: z.coerce.number().min(5000).max(25000000)",
      "loanPurpose: z.enum(['working_capital','equipment_acquisition','debt_refinancing','commercial_expansion'])",
      "repaymentTermMonths: z.coerce.number().int().min(6).max(360)",
      "collateralType: z.enum(['commercial_receivables','real_estate_equity','equipment_lien','unsecured_guaranty'])",
    ],
  },
  {
    id: "TelemetrySnapshotSchema",
    package: "@auragen/shared",
    category: "Day 3 Frontend Interaction Telemetry (.strict())",
    description:
      "Bounds all 5 privacy-conscious interaction signals inside a rolling observation window without raw values or coordinates.",
    fields: [
      "observationWindowSeconds: z.number().int().positive().max(3600)",
      "fieldFocusCount: z.number().int().nonnegative()",
      "hesitationCount: z.number().int().nonnegative()",
      "totalFieldFocusDurationMs: z.number().nonnegative()",
      "validationErrors: z.number().int().nonnegative()",
      "repeatedClicks: z.number().int().nonnegative()",
      "backtracks: z.number().int().nonnegative()",
      "cursorAnomalyScore: z.number().min(0).max(1)",
    ],
  },
  {
    id: "CreateFrictionEventInputSchema",
    package: "@auragen/shared",
    category: "Day 2 Neon PostgreSQL Persistence Contract",
    description:
      "Enforces 0-100 score range, enum level ('low' | 'medium' | 'high'), and strict aggregated signal counts prior to DB insert.",
    fields: [
      "frictionScore: z.number().int().min(0).max(100)",
      "frictionLevel: z.enum(['low', 'medium', 'high'])",
      "signals.hesitation_count: z.number().int().nonnegative()",
      "signals.validation_errors: z.number().int().nonnegative()",
      "signals.repeated_clicks: z.number().int().nonnegative()",
      "signals.backtracking: z.number().int().nonnegative()",
      "signals.cursor_anomaly_score: z.number().min(0).max(100)",
      "signals.observation_window_seconds: z.number().positive()",
    ],
  },
];

const APPROVED_UI_COMPONENTS = [
  {
    type: "ConversationalStepCard",
    purpose: "Breaks dense multi-field sections into single-question guided prompts.",
    allowedProps: "title, helperText, fieldId, inputType, validationRule",
  },
  {
    type: "InlineTooltipExplainer",
    purpose: "Injects plain-English financial definitions for terms like DSCR or Collateral Lien.",
    allowedProps: "term, plainExplanation, exampleText",
  },
  {
    type: "GuidedRangeSlider",
    purpose: "Replaces error-prone numeric text boxes with bounded interactive sliders.",
    allowedProps: "fieldId, min, max, step, unitPrefix",
  },
  {
    type: "SummaryConfirmationBanner",
    purpose: "Displays preserved user values before final submission.",
    allowedProps: "fields, attestationLabel",
  },
];

export function SchemaRegistryView() {
  const [selectedSchemaId, setSelectedSchemaId] = useState<string>(
    SCHEMA_CATALOG[0]!.id
  );
  const [validationResult, setValidationResult] = useState<string | null>(null);

  const activeSchema =
    SCHEMA_CATALOG.find((s) => s.id === selectedSchemaId) ?? SCHEMA_CATALOG[0]!;

  const runLiveSchemaSelfCheck = () => {
    const loanCheck = FinancialLoanApplicationSchema.safeParse({
      fullName: "Aarav Mehta",
      emailAddress: "aarav@example.com",
      phoneNumber: "+1555019283",
      residencyPostalCode: "94105",
      employmentStatus: "full_time",
      employerOrEntityName: "Vanguard Synth",
      yearsInCurrentRole: 5,
      annualIncome: 180000,
      monthlyHousingOrLeaseCost: 2500,
      existingMonthlyDebtObligations: 900,
      liquidReservesUsd: 60000,
      requestedLoanAmount: 300000,
      loanPurpose: "working_capital",
      repaymentTermMonths: 60,
      collateralType: "commercial_receivables",
      syntheticDataDeclaration: true,
      termsAndCreditCheckConsent: true,
    });

    const telemetryCheck = TelemetrySnapshotSchema.safeParse({
      observationWindowSeconds: 30,
      fieldFocusCount: 3,
      hesitationCount: 1,
      totalFieldFocusDurationMs: 9400,
      validationErrors: 0,
      repeatedClicks: 0,
      backtracks: 1,
      cursorAnomalyScore: 0.25,
    });

    const frictionCheck = CreateFrictionEventInputSchema.safeParse({
      frictionScore: 45,
      frictionLevel: "medium",
      signals: {
        hesitation_count: 1,
        validation_errors: 1,
        repeated_clicks: 0,
        backtracking: 1,
        cursor_anomaly_score: 25,
        observation_window_seconds: 30,
      },
    });

    if (loanCheck.success && telemetryCheck.success && frictionCheck.success) {
      setValidationResult(
        "All 3 core @auragen/shared Zod schemas passed live runtime verification."
      );
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8" data-testid="schema-registry-page">
      {/* Centered Page Hero */}
      <div className="text-center space-y-3 max-w-2xl mx-auto border-b border-slate-800/80 pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-medium text-emerald-300">
          <Layers className="h-3.5 w-3.5" />
          @auragen/shared Type & Schema Registry
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Schema Registry & Component Whitelist
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          Single-source-of-truth Zod contracts shared between Next.js and Express,
          paired with the restricted React component whitelist that blocks
          arbitrary LLM code execution.
        </p>
        <div className="pt-2">
          <Button size="sm" onClick={runLiveSchemaSelfCheck}>
            <Terminal className="mr-2 h-4 w-4" />
            Run Live Zod Contract Self-Check
          </Button>
        </div>
        {validationResult && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            {validationResult}
          </div>
        )}
      </div>

      {/* Interactive Schema Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Registered Zod Schemas
          </h2>
          {SCHEMA_CATALOG.map((item) => {
            const active = item.id === selectedSchemaId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedSchemaId(item.id)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  active
                    ? "border-emerald-500/60 bg-slate-900 text-white shadow-md"
                    : "border-slate-800/80 bg-slate-900/40 text-slate-400 hover:bg-slate-900/70 hover:text-slate-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-emerald-400">
                    {item.id}
                  </span>
                  <Badge variant={active ? "default" : "neutral"}>Zod</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">{item.category}</p>
              </button>
            );
          })}
        </div>

        <Card className="lg:col-span-8">
          <CardHeader className="border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-emerald-400" />
                <CardTitle className="text-base font-bold text-white font-mono">
                  {activeSchema.id}
                </CardTitle>
              </div>
              <Badge variant="default">{activeSchema.package}</Badge>
            </div>
            <p className="text-xs text-slate-400 pt-1">
              {activeSchema.description}
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 font-mono text-xs text-slate-300 space-y-1.5 overflow-x-auto">
              {activeSchema.fields.map((line) => (
                <div key={line} className="flex items-center gap-2">
                  <span className="text-emerald-500">•</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Approved Generative UI Component Registry */}
      <Card>
        <CardHeader className="border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <CardTitle className="text-base font-semibold text-white">
                Approved Generative UI Component Whitelist (Architecture Rule #3)
              </CardTitle>
            </div>
            <Badge variant="neutral">No Arbitrary JS Execution</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {APPROVED_UI_COMPONENTS.map((comp) => (
            <div
              key={comp.type}
              className="rounded-lg border border-slate-800 bg-slate-950/80 p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-purple-300">
                  &lt;{comp.type} /&gt;
                </span>
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
              </div>
              <p className="text-xs text-slate-300">{comp.purpose}</p>
              <p className="text-[11px] font-mono text-slate-500">
                Allowed Props: {comp.allowedProps}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}