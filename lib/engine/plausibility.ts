// Plausibility guard (deterministic): a spoken rupee number that cannot be a sensible answer for the field
// is "couldn't check, say it again" — never a difference, and never a question for the lender.
//
// - out_of_range: an INR amount < 20 % or > 500 % of the paper value ("5" for a ₹1,500 fee, "5000" for ₹200).
// - other_field: a bare number (no ₹/Rs/rupaye, no word for this field) that equals ANOTHER field on the paper
//   ("12" asked for the loan amount = the 12-month tenure / 12 % rate).
// Spoken zero / "nahi" (negated) is never implausible: "processing fee nahi" vs ₹1,500 stays a real difference.
import { FIELD_KEYWORDS } from "./extractClaims";
import { parseAmounts } from "./parseAmounts";
import { matchSeq, phrases, tokenize } from "./tokens";
import type { Field, Value } from "./types";

export type Plausibility = "ok" | "out_of_range" | "other_field";

export const MIN_RATIO = 0.2;
export const MAX_RATIO = 5;

const KEYWORD_SEQS = Object.fromEntries(
  (Object.entries(FIELD_KEYWORDS) as [Field, string[]][]).map(([f, list]) => [f, phrases(list)]),
) as Record<Field, string[][]>;

function mentionsField(evidence: string, field: Field): boolean {
  const toks = tokenize(evidence);
  return toks.some((_, i) => KEYWORD_SEQS[field].some((s) => matchSeq(toks, i, s)));
}

function hasCurrency(evidence: string, amount: number): boolean {
  return parseAmounts(evidence).some((a) => a.value === amount && (a.currency || a.unitAfter === "INR"));
}

/**
 * @param v       one spoken value
 * @param paper   the paper values
 * @param ownFields fields whose paper amounts count as "this field" (default: v.field). The teach-back's
 *                "amount in hand" accepts both net_disbursed and loan_amount.
 */
export function plausibility(v: Value, paper: Value[], ownFields: Field[] = [v.field]): Plausibility {
  if (v.amount === undefined || v.negated || v.amount === 0) return "ok";
  const own = paper.filter((p) => p.source === "paper" && ownFields.includes(p.field) && p.amount !== undefined);

  const isInr = v.unit === "INR" || own.some((p) => p.unit === "INR");
  if (isInr) {
    const targets = own.filter((p) => p.unit === "INR" && (p.amount as number) > 0).map((p) => p.amount as number);
    if (targets.length && targets.every((t) => v.amount! < t * MIN_RATIO || v.amount! > t * MAX_RATIO)) return "out_of_range";
  }

  const bare = !hasCurrency(v.evidence, v.amount) && !ownFields.some((f) => mentionsField(v.evidence, f));
  if (bare) {
    const matchesOwn = own.some((p) => p.amount === v.amount);
    const matchesOther = paper.some((p) => p.source === "paper" && !ownFields.includes(p.field) && p.amount === v.amount);
    if (matchesOther && !matchesOwn) return "other_field";
  }
  return "ok";
}
