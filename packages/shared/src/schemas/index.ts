import { z } from "zod";

/**
 * Friction severity classification levels
 */
export const FrictionLevelSchema = z.enum(["low", "medium", "high"]);

/**
 * Interaction status shown in the UI telemetry monitor
 */
export const InteractionStatusSchema = z.enum([
  "Normal",
  "Elevated Friction",
  "High Cognitive Load",
]);

/**
 * Current state of the AI Generative UI adaptation engine (Dashboard)
 */
export const UIAdaptationStatusSchema = z.enum([
  "Waiting",
  "Analyzing",
  "Adapting",
  "Adapted",
  "Fallback",
]);

/**
 * Database persistence status for ui_adaptations table
 */
export const DbAdaptationRecordStatusSchema = z.enum([
  "generated",
  "validated",
  "rendered",
  "failed",
]);

/**
 * Individual user interaction telemetry signal (Day 1 contract preserved)
 */
export const FrictionSignalTypeSchema = z.enum([
  "hesitation",
  "repeated_click",
  "validation_error",
  "backtracking",
  "field_refocus",
]);

export const FrictionSignalSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  fieldId: z.string().min(1),
  type: FrictionSignalTypeSchema,
  timestamp: z.number().int().positive(),
  weight: z.number().min(0).max(100).default(10),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Calculated Cognitive Friction Score (0 - 100)
 */
export const FrictionScoreSchema = z.object({
  sessionId: z.string().uuid(),
  score: z.number().int().min(0).max(100),
  level: FrictionLevelSchema,
  interactionStatus: InteractionStatusSchema,
  adaptationStatus: UIAdaptationStatusSchema,
  updatedAt: z.string().datetime(),
});

/**
 * User form session state
 */
export const SessionSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  currentStep: z.string(),
  frictionScore: z.number().min(0).max(100).default(0),
  frictionLevel: FrictionLevelSchema.default("low"),
  adaptationStatus: UIAdaptationStatusSchema.default("Waiting"),
});

/**
 * Day 2: Persisted Session Database Record Schema
 */
export const SessionRecordSchema = z.object({
  id: z.string().uuid(),
  startedAt: z.string().datetime(),
  lastSeenAt: z.string().datetime(),
  endedAt: z.string().datetime().nullable(),
});

/**
 * Day 2: Synthetic Financial Application Form Draft Validation
 * Explicitly forbids raw credentials, passwords, or full card numbers.
 */
export const SyntheticFormDataSchema = z
  .record(z.string(), z.unknown())
  .refine(
    (data) => {
      const forbiddenKeys = [
        "password",
        "bankpassword",
        "bank_password",
        "cardnumber",
        "card_number",
        "cvv",
        "pin",
        "ssn",
      ];
      return !Object.keys(data).some((k) => {
        const normalized = k.toLowerCase();
        return (
          forbiddenKeys.includes(normalized) || normalized.includes("password")
        );
      });
    },
    {
      message:
        "Sensitive credentials (passwords, card numbers, CVV, PIN, SSN) are strictly prohibited.",
    }
  );

export const UpsertFormDraftInputSchema = z.object({
  formData: SyntheticFormDataSchema.default({}),
  schemaVersion: z.number().int().positive().default(1),
});

export const FormDraftRecordSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  formData: z.record(z.string(), z.unknown()),
  schemaVersion: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});

/**
 * Day 2: Aggregated Telemetry Signals for DB Persistence (Zero raw mouse coordinates or keyloggers)
 */
export const AggregatedSignalsSchema = z
  .object({
    hesitation_count: z.number().int().nonnegative().default(0),
    validation_errors: z.number().int().nonnegative().default(0),
    repeated_clicks: z.number().int().nonnegative().default(0),
    backtracking: z.number().int().nonnegative().default(0),
    cursor_anomaly_score: z.number().min(0).max(100).default(0),
    observation_window_seconds: z.number().positive().max(3600).default(10),
  })
  .strict();

export const CreateFrictionEventInputSchema = z.object({
  frictionScore: z.number().int().min(0).max(100),
  frictionLevel: FrictionLevelSchema,
  signals: AggregatedSignalsSchema,
});

export const FrictionEventRecordSchema = z.object({
  id: z.number().int().positive(),
  sessionId: z.string().uuid(),
  frictionScore: z.number().int().min(0).max(100),
  frictionLevel: FrictionLevelSchema,
  signals: AggregatedSignalsSchema,
  createdAt: z.string().datetime(),
});

/**
 * Day 3: Privacy-Conscious Interaction Telemetry Schemas
 */
export const ValidationErrorCategorySchema = z.enum([
  "required",
  "format",
  "range",
  "ratio",
  "schema",
  "custom",
]);

export const ValidationErrorSignalSchema = z
  .object({
    fieldId: z.string().min(1).max(120),
    errorCategory: ValidationErrorCategorySchema.default("custom"),
    timestamp: z.number().int().positive(),
    errorCount: z.number().int().positive().default(1),
  })
  .strict();

export const CursorAnomalyMetricsSchema = z
  .object({
    sampleCount: z.number().int().nonnegative().default(0),
    averageVelocityPxPerMs: z.number().min(0).max(100).default(0),
    directionChanges: z.number().int().nonnegative().default(0),
    excessiveMovementBursts: z.number().int().nonnegative().default(0),
    normalizedScore: z.number().min(0).max(1).default(0),
  })
  .strict();

export const TelemetrySignalKindSchema = z.enum([
  "field_focus",
  "field_hesitation",
  "repeated_click",
  "validation_error",
  "backtrack",
  "cursor_anomaly",
]);

export const TelemetrySignalSchema = z
  .object({
    kind: TelemetrySignalKindSchema,
    targetId: z.string().min(1).max(120),
    timestamp: z.number().int().positive(),
    durationMs: z.number().nonnegative().optional(),
    errorCategory: ValidationErrorCategorySchema.optional(),
  })
  .strict();

export const FieldInteractionMetricsSchema = z
  .object({
    fieldId: z.string().min(1).max(120),
    focusCount: z.number().int().nonnegative().default(0),
    hesitationCount: z.number().int().nonnegative().default(0),
    validationErrorCount: z.number().int().nonnegative().default(0),
    repeatedInteractionCount: z.number().int().nonnegative().default(0),
    totalFocusDurationMs: z.number().nonnegative().default(0),
  })
  .strict();

export type FieldInteractionMetrics = z.infer<
  typeof FieldInteractionMetricsSchema
>;

export const TelemetrySnapshotSchema = z
  .object({
    observationWindowSeconds: z
      .number()
      .int()
      .positive()
      .max(3600)
      .default(30),
    fieldFocusCount: z.number().int().nonnegative().default(0),
    hesitationCount: z.number().int().nonnegative().default(0),
    totalFieldFocusDurationMs: z.number().nonnegative().default(0),
    validationErrors: z.number().int().nonnegative().default(0),
    repeatedClicks: z.number().int().nonnegative().default(0),
    backtracks: z.number().int().nonnegative().default(0),
    cursorAnomalyScore: z.number().min(0).max(1).default(0),
    fieldMetrics: z.array(FieldInteractionMetricsSchema).optional(),
  })
  .strict();

/**
 * Backend Health Response Schema
 */
export const HealthResponseSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  service: z.literal("auragen-server"),
  timestamp: z.string().datetime(),
  uptimeSeconds: z.number().nonnegative(),
  websocketReady: z.boolean(),
  database: z
    .object({
      connected: z.boolean(),
      configured: z.boolean(),
      latencyMs: z.number().nonnegative().nullable(),
    })
    .optional(),
});
/**
 * 5-Section Complete Financial Loan Application Schema (14 Fields)
 * Sections:
 * 1. Personal Information (4 fields)
 * 2. Employment Details (3 fields)
 * 3. Financial Information (4 fields)
 * 4. Loan Details (3 fields)
 * 5. Review & Declaration (2 fields)
 */
export const EmploymentStatusSchema = z.enum([
  "full_time",
  "self_employed",
  "contractor",
  "business_owner",
]);

export const LoanPurposeSchema = z.enum([
  "working_capital",
  "equipment_acquisition",
  "debt_refinancing",
  "commercial_expansion",
]);

export const CollateralTypeSchema = z.enum([
  "commercial_receivables",
  "real_estate_equity",
  "equipment_lien",
  "unsecured_guaranty",
]);

export const FinancialLoanApplicationSchema = z.object({
  // Section 1: Personal Information
  fullName: z.string().min(3, "Full legal name must be at least 3 characters"),
  emailAddress: z.string().email("Enter a valid synthetic email address"),
  phoneNumber: z
    .string()
    .min(7, "Phone number must be at least 7 characters"),
  residencyPostalCode: z
    .string()
    .min(4, "Postal/ZIP code must be at least 4 characters"),

  // Section 2: Employment Details
  employmentStatus: EmploymentStatusSchema,
  employerOrEntityName: z
    .string()
    .min(2, "Employer or business entity name is required"),
  yearsInCurrentRole: z.coerce
    .number()
    .min(0, "Years in role cannot be negative")
    .max(60, "Years in role must be 60 or less"),

  // Section 3: Financial Information
  annualIncome: z.coerce
    .number()
    .min(12000, "Annual income must be at least $12,000")
    .max(50000000, "Annual income exceeds synthetic demo cap"),
  monthlyHousingOrLeaseCost: z.coerce
    .number()
    .min(0, "Monthly housing/lease cost cannot be negative")
    .max(1000000, "Monthly cost exceeds synthetic cap"),
  existingMonthlyDebtObligations: z.coerce
    .number()
    .min(0, "Monthly debt obligations cannot be negative")
    .max(1000000, "Monthly debt exceeds synthetic cap"),
  liquidReservesUsd: z.coerce
    .number()
    .min(0, "Liquid reserves cannot be negative")
    .max(100000000, "Liquid reserves exceed synthetic cap"),

  // Section 4: Loan Details
  requestedLoanAmount: z.coerce
    .number()
    .min(5000, "Requested loan amount must be at least $5,000")
    .max(25000000, "Requested loan amount must be $25,000,000 or less"),
  loanPurpose: LoanPurposeSchema,
  repaymentTermMonths: z.coerce
    .number()
    .int()
    .min(6, "Minimum repayment term is 6 months")
    .max(360, "Maximum repayment term is 360 months"),
  collateralType: CollateralTypeSchema,

  // Section 5: Review and Declaration
  syntheticDataDeclaration: z.boolean().refine((val) => val === true, {
    message: "You must confirm that all entered data is synthetic",
  }),
  termsAndCreditCheckConsent: z.boolean().refine((val) => val === true, {
    message: "You must accept the synthetic underwriting terms to submit",
  }),
});