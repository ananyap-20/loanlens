// Engine types, exactly as CLAUDE.md section 6.

export type Field =
  | "loan_amount"
  | "interest_rate"
  | "tenure"
  | "installment"
  | "processing_fee"
  | "net_disbursed"
  | "late_fee";

export type Source = "paper" | "agent" | "borrower";
export type Unit = "INR" | "percent" | "months" | "weeks";
export type Frequency = "monthly" | "weekly" | "fortnightly" | "once";
export type Confidence = "high" | "medium" | "low";

/**
 * One claimed value for one field.
 * - amount undefined = the field was addressed but no usable number (e.g. "pata nahi").
 * - negated=true, amount=0 ONLY when a zero / "nahi" was explicitly said.
 * - Missing fields have NO Value at all: missing never becomes 0.
 */
export type Value = {
  field: Field;
  amount?: number;
  unit?: Unit;
  frequency?: Frequency;
  negated?: boolean;
  evidence: string;
  source: Source;
  confidence: Confidence;
};

export type Status = "match" | "conflict" | "not_mentioned" | "unable_to_verify";

export const ALL_FIELDS: readonly Field[] = [
  "loan_amount",
  "interest_rate",
  "tenure",
  "installment",
  "processing_fee",
  "net_disbursed",
  "late_fee",
];
