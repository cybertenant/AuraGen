"use client";

import React, { useState } from "react";
import {
  Lock,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  EyeOff,
  ServerCrash,
} from "lucide-react";
import { UpsertFormDraftInputSchema } from "@auragen/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ZeroPiiGuardrailsView() {
  const [testFieldKey, setTestFieldKey] = useState("bankPassword");
  const [sandboxOutcome, setSandboxOutcome] = useState<{
    allowed: boolean;
    message: string;
  } | null>(null);

  const testGuardrailKey = (keyToTest: string) => {
    setTestFieldKey(keyToTest);
    const result = UpsertFormDraftInputSchema.safeParse({
      formData: {
        [keyToTest]: "synthetic-test-value",
      },
      schemaVersion: 1,
    });

    if (result.success) {
      setSandboxOutcome({
        allowed: true,
        message: `Field "${keyToTest}" passed SyntheticFormDataSchema validation.`,
      });
    } else {
      setSandboxOutcome({
        allowed: false,
        message: `BLOCKED: Field "${keyToTest}" was rejected by SyntheticFormDataSchema (Sensitive credential keys are strictly prohibited).`,
      });
    }
  };

  return (
    <div
      className="max-w-5xl mx-auto space-y-8"
      data-testid="zero-pii-guardrails-page"
    >
      {/* Centered Page Hero */}
      <div className="text-center space-y-3 max-w-2xl mx-auto border-b border-slate-800/80 pb-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-300">
          <Lock className="h-3.5 w-3.5" />
          Zero-PII Privacy & Security Architecture
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          Zero-PII Guardrails & Data Isolation
        </h1>
        <p className="text-sm text-slate-400 leading-relaxed">
          AuraGen observes interaction friction without ever reading typed form
          values, recording keystrokes, storing raw mouse coordinates, or
          exposing financial figures to the AI layer.
        </p>
      </div>

      {/* Interactive Credential Key Blocker Sandbox */}
      <Card className="border-amber-500/30">
        <CardHeader className="border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" />
              <CardTitle className="text-base font-semibold text-white">
                Interactive Guardrail Sandbox: Prohibited Credential Filter
              </CardTitle>
            </div>
            <Badge variant="warning">Live Zod Verification</Badge>
          </div>
          <p className="text-xs text-slate-400 pt-1">
            Test how <code>UpsertFormDraftInputSchema</code> automatically
            blocks forbidden credential keys before they can reach Neon
            PostgreSQL.
          </p>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="amber"
              onClick={() => testGuardrailKey("bankPassword")}
            >
              Test &quot;bankPassword&quot; (Blocked)
            </Button>
            <Button
              size="sm"
              variant="amber"
              onClick={() => testGuardrailKey("cardNumber")}
            >
              Test &quot;cardNumber&quot; (Blocked)
            </Button>
            <Button
              size="sm"
              variant="amber"
              onClick={() => testGuardrailKey("ssn")}
            >
              Test &quot;ssn&quot; (Blocked)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => testGuardrailKey("requestedLoanAmount")}
            >
              Test &quot;requestedLoanAmount&quot; (Allowed)
            </Button>
          </div>

          {sandboxOutcome && (
            <div
              className={`rounded-lg border p-3.5 text-xs flex items-center gap-2.5 ${
                sandboxOutcome.allowed
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-rose-500/40 bg-rose-500/10 text-rose-300"
              }`}
            >
              {sandboxOutcome.allowed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="font-medium">{sandboxOutcome.message}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4 Core Privacy Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <EyeOff className="h-4 w-4 text-emerald-400" />
              <CardTitle className="text-slate-100 text-sm font-semibold">
                1. DOM Attribute-Only Telemetry
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 leading-relaxed">
            <code>useTelemetry()</code> inspects only{" "}
            <code>data-auragen-field</code>, <code>data-auragen-action</code>,
            and <code>data-auragen-section-index</code> attributes. It never
            reads <code>HTMLInputElement.value</code> or attaches keyloggers.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-sky-400" />
              <CardTitle className="text-slate-100 text-sm font-semibold">
                2. Ephemeral Pointer Velocity Vectors
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 leading-relaxed">
            Pointer movement is throttled and reduced immediately to a scalar
            <code>cursorAnomalyScore</code> between <code>0</code> and{" "}
            <code>1</code>. Raw <code>(x, y)</code> mouse trajectories are
            discarded in memory and never transmitted.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ServerCrash className="h-4 w-4 text-purple-400" />
              <CardTitle className="text-slate-100 text-sm font-semibold">
                3. Backend-Only Database Credentials
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 leading-relaxed">
            <code>DATABASE_URL</code> and <code>DIRECT_DATABASE_URL</code> exist
            exclusively inside <code>apps/server/.env</code>. The browser only
            stores the non-authoritative demo session UUID in{" "}
            <code>localStorage</code>.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-slate-100 text-sm font-semibold">
                4. Zero Financial Values Sent to Gemini
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-slate-400 leading-relaxed">
            When the AI adaptation engine triggers on high cognitive load, only
            field identifiers and aggregated friction counts are sent—never the
            user&apos;s income, loan amount, or personal details.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}