// Shared by the PDF and QR paths: both produce the SAME shape, the engine's Value[] with source "paper".
// A field that could not be read simply has no Value (missing never becomes 0).
import type { Field, Frequency, Unit, Value } from "@/lib/engine/types";

export type PaperTerms = Value[];

export type PaperFailure =
  | "no_text" // PDF has no text layer
  | "unreadable" // not a readable PDF / image
  | "no_terms" // readable, but none of the fields were found
  | "bad_qr"; // QR payload is not valid LoanLens JSON

export type PaperResult =
  | { ok: true; terms: PaperTerms; lender?: string; missing: Field[]; ambiguous: Field[] }
  | { ok: false; reason: PaperFailure; message: string };

export const NO_TEXT_MESSAGE = "is PDF mein likha hua text nahi mila";

export const PAPER_FIELD_ORDER: readonly Field[] = [
  "loan_amount",
  "interest_rate",
  "tenure",
  "installment",
  "processing_fee",
  "net_disbursed",
  "late_fee",
];

export function paperValue(
  field: Field,
  amount: number,
  unit: Unit,
  evidence: string,
  frequency?: Frequency,
  confidence: Value["confidence"] = "high",
): Value {
  const v: Value = { field, amount, unit, evidence, source: "paper", confidence };
  if (frequency) v.frequency = frequency;
  return v;
}

export function finishTerms(values: Value[]): { terms: PaperTerms; missing: Field[] } {
  const terms = PAPER_FIELD_ORDER.flatMap((f) => values.filter((v) => v.field === f).slice(0, 1));
  const missing = PAPER_FIELD_ORDER.filter((f) => !terms.some((t) => t.field === f));
  return { terms, missing };
}
