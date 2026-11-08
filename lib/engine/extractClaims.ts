// extractClaims: transcript -> Value[] (deterministic rules, no AI).
//
// Rules (CLAUDE.md section 6):
// - The app asks ONE field per clip, so numbers with no field word go to `askedField`.
// - When a clip names fields ("loan", "EMI"/"किस्त", "processing fee" ...), each number goes to the
//   nearest field word in the same clause (clauses split at । , ; ? ! and "और/aur/and").
// - Explicit negation ("नहीं", "nahi", "no", "free", "koi ... nahi") with no number -> amount 0, negated: true.
//   Only for fee fields, and only for the asked field when one is given.
// - Uncertainty ("pata nahi", "shayad") -> confidence "low" (compare turns that into unable_to_verify).
// - Missing never becomes 0: a field that is not mentioned gets no Value at all.

import { MONTH_WORDS, parseTokens, WEEK_WORDS, type ParsedAmount } from "./parseAmounts";
import { matchSeq, normWord, phrases, tokenize, type Token } from "./tokens";
import type { Field, Frequency, Source, Value } from "./types";

export const FIELD_KEYWORDS: Record<Field, string[]> = {
  loan_amount: ["loan", "लोन", "loan amount", "कर्ज", "कर्जा", "karz", "karza", "principal"],
  interest_rate: ["ब्याज", "byaj", "byaaj", "biyaj", "interest", "interest rate", "ब्याज दर", "rate", "रेट", "apr"],
  tenure: ["tenure", "अवधि", "avadhi", "muddat", "मुद्दत", "duration"],
  installment: [
    "emi", "ईएमआई", "किस्त", "किश्त", "किस्तें", "किश्तें", "kisht", "kist", "kisth", "qist", "kishtein",
    "instalment", "installment", "instalments", "installments",
  ],
  processing_fee: [
    "processing fee", "processing fees", "processing charge", "processing charges", "processing",
    "प्रोसेसिंग", "प्रोसेसिंग फीस", "प्रोसेसिंग फी", "file charge", "फाइल चार्ज", "fee", "fees", "फीस", "फी",
  ],
  net_disbursed: [
    "haath mein", "hath mein", "haath me", "हाथ में", "in hand", "net", "disbursed", "disbursal",
    "खाते में", "khate mein", "account mein", "अकाउंट में",
  ],
  late_fee: [
    "late fee", "late fees", "लेट फीस", "लेट फी", "late charge", "late", "लेट", "penalty", "पेनल्टी",
    "जुर्माना", "jurmana", "jurmaana", "dand", "दंड",
  ],
};

const KEYWORD_TABLE: { field: Field; seq: string[] }[] = (Object.entries(FIELD_KEYWORDS) as [Field, string[]][])
  .flatMap(([field, list]) => phrases(list).map((seq) => ({ field, seq })))
  .sort((a, b) => b.seq.length - a.seq.length); // longest match first ("late fee" before "fee")

type KeywordHit = { field: Field; first: number; last: number };

function findKeywords(toks: Token[]): KeywordHit[] {
  const hits: KeywordHit[] = [];
  for (let i = 0; i < toks.length; ) {
    const k = KEYWORD_TABLE.find((kw) => matchSeq(toks, i, kw.seq));
    if (k) {
      hits.push({ field: k.field, first: i, last: i + k.seq.length - 1 });
      i += k.seq.length;
    } else i++;
  }
  return hits;
}

const UNCERTAIN_SEQS = phrases([
  "पता नहीं", "नहीं पता", "pata nahi", "pata nahin", "pata nai", "nahi pata", "nahin pata",
  "मालूम नहीं", "नहीं मालूम", "maloom nahi", "malum nahi", "याद नहीं", "yaad nahi", "yad nahi",
  "पक्का नहीं", "pakka nahi", "sure nahi", "श्योर नहीं", "शायद", "shayad", "shaayad",
  "i don't know", "dont know", "don't know", "not sure", "no idea",
]);

const NEGATION = new Set(
  ["नहीं", "नही", "nahi", "nahin", "nahee", "nai", "no", "not", "free", "फ्री", "मुफ्त", "muft", "माफ", "maaf", "waive", "waived", "nil"].map(
    normWord,
  ),
);

/** Fields where "nahi" can honestly mean "zero rupees". */
const NEGATABLE: ReadonlySet<Field> = new Set<Field>(["processing_fee", "late_fee"]);

const BOUNDARY_PUNCT = new Set(["।", "॥", ",", ";", "?", "!", "|"]);
const BOUNDARY_WORDS = new Set(["और", "aur", "and", "lekin", "लेकिन", "but", "magar", "मगर"].map(normWord));
const ABBREVIATIONS = new Set(["rs", "रु", "no"]);

function isBoundary(toks: Token[], i: number): boolean {
  const t = toks[i];
  if (BOUNDARY_PUNCT.has(t.text) || BOUNDARY_WORDS.has(t.norm)) return true;
  if (t.text === ".") return !(i > 0 && ABBREVIATIONS.has(toks[i - 1].norm));
  return false;
}

/** Inclusive [first, last] token ranges of each clause. */
function splitClauses(toks: Token[]): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i < toks.length; i++) {
    if (isBoundary(toks, i)) {
      if (start >= 0) out.push([start, i - 1]);
      start = -1;
    } else if (start < 0) start = i;
  }
  if (start >= 0) out.push([start, toks.length - 1]);
  return out;
}

function uncertaintyIn(toks: Token[], c0: number, c1: number): { uncertain: boolean; consumed: Set<number> } {
  const consumed = new Set<number>();
  for (let i = c0; i <= c1; i++) {
    for (const seq of UNCERTAIN_SEQS) {
      if (i + seq.length - 1 <= c1 && matchSeq(toks, i, seq)) {
        for (let k = 0; k < seq.length; k++) consumed.add(i + k);
      }
    }
  }
  return { uncertain: consumed.size > 0, consumed };
}

// ---------------------------------------------------------------- frequency

const EVERY = new Set(["har", "हर", "per", "prati", "प्रति", "every", "each"].map(normWord));
const MONTHLY_ONLY = new Set(["monthly", "मासिक"].map(normWord));
const WEEKLY_ONLY = new Set(["weekly", "साप्ताहिक"].map(normWord));
const FORTNIGHT_SEQS = phrases([
  "पंद्रह दिन", "pandrah din", "15 दिन", "15 din", "15 days", "fortnight", "fortnightly", "पाक्षिक",
  "do hafte", "दो हफ़्ते", "2 हफ़्ते", "2 hafte", "2 weeks",
]);

function frequencyOfTokens(toks: Token[]): Frequency | undefined {
  for (let i = 0; i < toks.length; i++) if (FORTNIGHT_SEQS.some((s) => matchSeq(toks, i, s))) return "fortnightly";

  const explicit = new Set<Frequency>();
  let hasMonth = false;
  let hasWeek = false;
  toks.forEach((t, i) => {
    const prevEvery = i > 0 && EVERY.has(toks[i - 1].norm);
    if (MONTHLY_ONLY.has(t.norm) || (prevEvery && MONTH_WORDS.has(t.norm))) explicit.add("monthly");
    if (WEEKLY_ONLY.has(t.norm) || (prevEvery && WEEK_WORDS.has(t.norm))) explicit.add("weekly");
    if (MONTH_WORDS.has(t.norm)) hasMonth = true;
    if (WEEK_WORDS.has(t.norm)) hasWeek = true;
  });
  if (explicit.size === 1) return [...explicit][0];
  if (explicit.size > 1) return undefined;
  if (hasMonth !== hasWeek) return hasMonth ? "monthly" : "weekly";
  return undefined;
}

/** "har mahine" -> monthly, "har hafte" -> weekly, "pandrah din" -> fortnightly, otherwise undefined. */
export function detectFrequency(text: string): Frequency | undefined {
  return frequencyOfTokens(tokenize(text));
}

export function isUncertain(text: string): boolean {
  const toks = tokenize(text);
  return toks.length > 0 && uncertaintyIn(toks, 0, toks.length - 1).uncertain;
}

// ---------------------------------------------------------------- assignment

function fieldForAmount(a: ParsedAmount, kws: KeywordHit[], asked?: Field): Field | undefined {
  if (a.unitAfter === "percent" && a.value <= 100) return "interest_rate";
  if ((a.unitAfter === "months" || a.unitAfter === "weeks") && a.value <= 600) return "tenure";
  if (kws.length === 0) return asked;
  let best: KeywordHit | undefined;
  let bestDist = Infinity;
  for (const k of kws) {
    const before = k.last < a.firstToken;
    const dist = before ? a.firstToken - k.last : k.first - a.lastToken;
    // Tie -> the field word BEFORE the number wins ("EMI 2666").
    if (dist < bestDist || (dist === bestDist && before)) {
      best = k;
      bestDist = dist;
    }
  }
  return best?.field;
}

function unitFor(field: Field, a?: ParsedAmount): Value["unit"] {
  if (field === "interest_rate") return "percent";
  if (field === "tenure") return a?.unitAfter === "months" || a?.unitAfter === "weeks" ? a.unitAfter : undefined;
  return "INR";
}

export function extractClaims(transcript: string, askedField?: Field, source: Source = "agent"): Value[] {
  const text = transcript.normalize("NFC");
  const toks = tokenize(text);
  if (toks.length === 0) return [];
  const amounts = parseTokens(toks, text).filter((a) => !a.bare || a.value === 0); // lone "do"/"ek" is too ambiguous
  const keywords = findKeywords(toks);
  const out: Value[] = [];

  for (const [c0, c1] of splitClauses(toks)) {
    const evidence = text.slice(toks[c0].start, toks[c1].end);
    const kws = keywords.filter((k) => k.first >= c0 && k.last <= c1);
    const nums = amounts.filter((a) => a.firstToken >= c0 && a.lastToken <= c1);
    const { uncertain, consumed } = uncertaintyIn(toks, c0, c1);
    const clauseToks = toks.slice(c0, c1 + 1);

    if (nums.length > 0) {
      for (const a of nums) {
        const field = fieldForAmount(a, kws, askedField);
        if (!field) continue;
        const v: Value = {
          field,
          amount: a.value,
          unit: unitFor(field, a),
          evidence,
          source,
          confidence: uncertain ? "low" : a.fromWords ? "medium" : "high",
        };
        if (field === "installment") {
          const f = frequencyOfTokens(clauseToks);
          if (f) v.frequency = f;
        }
        if (a.value === 0) v.negated = true; // an explicitly spoken zero
        out.push(v);
      }
      continue;
    }

    if (uncertain) {
      const fields = kws.length ? [...new Set(kws.map((k) => k.field))] : askedField ? [askedField] : [];
      for (const field of fields) out.push({ field, unit: unitFor(field), evidence, source, confidence: "low" });
      continue;
    }

    const negAt = clauseToks.findIndex((t, k) => !consumed.has(c0 + k) && NEGATION.has(t.norm));
    if (negAt >= 0) {
      const negIdx = c0 + negAt;
      // Field word nearest to the negation (prefer the one before it: "processing fee नहीं").
      let target: Field | undefined;
      let bestDist = Infinity;
      for (const k of kws) {
        const before = k.last < negIdx;
        const dist = before ? negIdx - k.last : k.first - negIdx;
        if (dist < bestDist || (dist === bestDist && before)) {
          target = k.field;
          bestDist = dist;
        }
      }
      target ??= askedField;
      if (target && NEGATABLE.has(target) && (!askedField || target === askedField)) {
        out.push({ field: target, amount: 0, unit: "INR", negated: true, evidence, source, confidence: "medium" });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- missed-payment keywords (teach-back gate)

const CONSEQUENCE_SEQS = phrases([
  "late fee", "late fees", "लेट फीस", "लेट फी", "late charge", "penalty", "पेनल्टी", "jurmana", "jurmaana", "जुर्माना",
  "dand", "दंड", "extra lagega", "extra lagegi", "extra lagenge", "extra dena", "extra dene", "extra charge",
  "एक्स्ट्रा लगेगा", "एक्स्ट्रा लगेगी", "एक्स्ट्रा लगेंगे", "एक्स्ट्रा देना", "एक्स्ट्रा चार्ज",
]);

/** Late fee / penalty / jurmana / "extra lagega" mentioned? */
export function hasConsequenceKeyword(text: string): boolean {
  const toks = tokenize(text);
  return toks.some((_, i) => CONSEQUENCE_SEQS.some((s) => matchSeq(toks, i, s)));
}
