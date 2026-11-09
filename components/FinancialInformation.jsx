"use client";

import { SelectField, TextField } from "@/components/ui/FormControls";
import { CREDIT_SCORE_RANGES, CURRENCY_SYMBOL } from "@/lib/fields";

export default function FinancialInformation({ data, errors, onChange, onBlur }) {
  const shared = { section: "financial", onChange, onBlur };
  const money = { type: "number", min: "0", step: "any", inputMode: "decimal", prefix: CURRENCY_SYMBOL, required: true };

  return (
    <div className="grid gap-5 sm:grid-cols-2" data-section-root="financial">
      <TextField
        {...shared}
        {...money}
        name="monthlyIncome"
        label="Monthly income"
        hint="Income after tax, before expenses."
        value={data.monthlyIncome}
        error={errors.monthlyIncome}
      />
      <TextField
        {...shared}
        {...money}
        name="annualIncome"
        label="Annual income"
        value={data.annualIncome}
        error={errors.annualIncome}
      />
      <TextField
        {...shared}
        {...money}
        name="monthlyExpenses"
        label="Monthly expenses"
        hint="Rent, bills, subscriptions and loan payments."
        value={data.monthlyExpenses}
        error={errors.monthlyExpenses}
      />
      <TextField
        {...shared}
        {...money}
        name="existingLoanAmount"
        label="Existing loan amount"
        hint="Enter 0 if you have no loans."
        value={data.existingLoanAmount}
        error={errors.existingLoanAmount}
      />
      <div className="sm:col-span-2">
        <SelectField
          {...shared}
          name="creditScoreRange"
          label="Credit score range"
          required
          options={CREDIT_SCORE_RANGES}
          value={data.creditScoreRange}
          error={errors.creditScoreRange}
        />
      </div>
    </div>
  );
}
