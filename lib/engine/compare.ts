// compare: paper vs agent, paper vs borrower, per field. Deterministic, no verdict words.
//
// - Nothing said about a field            -> not_mentioned (never treated as 0)
// - Paper has no value for the field      -> unable_to_verify (we never invent the paper side)
// - Low confidence / no number / several different numbers -> unable_to_verify
// - Different unit or frequency           -> unable_to_verify, never conflict
// - Interest rate: equal -> match; a different number with an unknown or different basis
//   (nominal vs APR vs flat) -> unable_to_verify, never conflict
// - Otherwise exact comparison (INR exact, months exact): match or conflict

import { matchSeq, phrases, tokenize } from "./tokens";
import { ALL_FIELDS, type Field, type Status, type Value } from "./types";

export type SideComparison = { status: Status; spoken: Value[] };
export type FieldComparison = { field: Field; paper?: Value; agent: SideComparison; borrower: SideComparison };

type RateBasis = "apr" | "flat" | "reducing";

const BASIS_SEQS: [RateBasis, string[]][] = [
  ...phrases(["apr", "annual percentage rate", "effective", "effective rate", "kul lagat", "कुल लागत"]).map(
    (s) => ["apr", s] as [RateBasis, string[]],
  ),
  ...phrases(["flat", "फ्लैट"]).map((s) => ["flat", s] as [RateBasis, string[]]),
  ...phrases(["reducing", "reducing balance", "diminishing", "घटते", "घटती"]).map((s) => ["reducing", s] as [RateBasis, string[]]),
];

/** What kind of interest rate does this evidence describe? undefined = not stated. */
export function rateBasis(evidence: string): RateBasis | undefined {
  const toks = tokenize(evidence);
  const found = new Set<RateBasis>();
  for (let i = 0; i < toks.length; i++) {
    for (const [b, s] of BASIS_SEQS) if (matchSeq(toks, i, s)) found.add(b);
  }
  return found.size === 1 ? [...found][0] : undefined;
}

export function compareField(field: Field, paper: Value[], spoken: Value[]): SideComparison {
  const said = spoken.filter((v) => v.field === field);
  if (said.length === 0) return { status: "not_mentioned", spoken: said };

  const p = paper.find((v) => v.field === field && v.source === "paper");
  const result = (status: Status): SideComparison => ({ status, spoken: said });
  if (!p || p.amount === undefined) return result("unable_to_verify");

  if (said.some((v) => v.amount === undefined || v.confidence === "low")) return result("unable_to_verify");
  const amounts = [...new Set(said.map((v) => v.amount as number))];
  if (amounts.length > 1) return result("unable_to_verify");

  for (const v of said) {
    if (field === "tenure" && !v.unit) return result("unable_to_verify"); // "12" could be months or weeks
    if (v.unit && p.unit && v.unit !== p.unit) return result("unable_to_verify");
    if (v.frequency && p.frequency && v.frequency !== p.frequency) return result("unable_to_verify");
  }

  const amount = amounts[0];
  if (field === "interest_rate") {
    const pb = rateBasis(p.evidence);
    const sb = said.map((v) => rateBasis(v.evidence)).find(Boolean);
    const sameBasisKnown = pb !== undefined && sb !== undefined && pb === sb;
    const basisDiffers = pb !== undefined && sb !== undefined && pb !== sb;
    if (amount === p.amount) return result(basisDiffers ? "unable_to_verify" : "match");
    return result(sameBasisKnown ? "conflict" : "unable_to_verify");
  }

  return result(amount === p.amount ? "match" : "conflict");
}

export function compare(paper: Value[], agent: Value[], borrower: Value[]): FieldComparison[] {
  return ALL_FIELDS.map((field) => ({
    field,
    paper: paper.find((v) => v.field === field && v.source === "paper"),
    agent: compareField(field, paper, agent),
    borrower: compareField(field, paper, borrower),
  }));
}
