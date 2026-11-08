// parseAmounts: finds every number in a transcript, deterministically.
// Handles digits ("2,666", "₹1,500", "Rs. 1,500/-", "1,00,000"), Devanagari digits ("१,५००"),
// digits + multiplier ("30 हज़ार", "1.5 lakh"), and Hindi/Hinglish number words as a safety net
// (पंद्रह सौ, "teen hazaar paanch sau", डेढ़/dedh, ढाई/dhai, साढ़े/saadhe, सवा, पौने).

import { FRACTIONS, MODIFIERS, MULTIPLIERS, NUMBER_WORDS } from "./hindiNumbers";
import { normWord, tokenize, type Token } from "./tokens";

export type UnitHint = "INR" | "percent" | "months" | "weeks";

export type ParsedAmount = {
  value: number;
  raw: string; // the text that produced the number
  start: number; // offsets into the NFC text
  end: number;
  firstToken: number;
  lastToken: number;
  fromWords: boolean; // any number word / fraction involved
  hasMultiplier: boolean; // सौ / हज़ार / लाख / करोड़ involved
  currency: boolean; // ₹ / Rs / INR before, or रुपये / "/-" after
  unitAfter?: UnitHint; // unit word right after the number
  /** A lone number word ("do", "दो") with no multiplier or unit: too ambiguous to trust ("de do" = "give"). */
  bare: boolean;
};

const set = (list: string[]) => new Set(list.map(normWord));

const RUPEE_AFTER = set([
  "रुपये", "रुपया", "रुपए", "रूपये", "रूपया", "रूपए", "रुपयों", "rupaye", "rupaiye", "rupees", "rupee",
  "rupay", "rupye", "rupiya", "rupaya", "rs", "inr",
]);
const CURRENCY_BEFORE = set(["₹", "rs", "inr", "रु", "रू"]);
const PERCENT_AFTER = set(["%", "प्रतिशत", "percent", "pratishat", "परसेंट", "percentage", "फीसदी", "fisadi"]);
export const MONTH_WORDS = set(["महीने", "महीना", "महीनों", "माह", "mahine", "mahina", "mahino", "maheene", "month", "months"]);
export const WEEK_WORDS = set(["हफ़्ते", "हफ़्ता", "हफ़्तों", "सप्ताह", "hafte", "hafta", "hafton", "haftey", "week", "weeks"]);

function unitAt(toks: Token[], i: number): UnitHint | undefined {
  const t = toks[i];
  if (!t) return undefined;
  if (RUPEE_AFTER.has(t.norm)) return "INR";
  if (t.text === "/" && toks[i + 1]?.text === "-") return "INR";
  if (PERCENT_AFTER.has(t.norm)) return "percent";
  if (MONTH_WORDS.has(t.norm)) return "months";
  if (WEEK_WORDS.has(t.norm)) return "weeks";
  return undefined;
}

function currencyBefore(toks: Token[], i: number): boolean {
  let j = i - 1;
  if (toks[j]?.text === ".") j--; // "Rs. 1,500"
  return j >= 0 && CURRENCY_BEFORE.has(toks[j].norm);
}

const isWord = (t: Token | undefined, m: ReadonlyMap<string, number>) => !!t && t.kind === "word" && m.has(t.norm);

/** Reads one number phrase starting at token i, or returns null. */
function readPhrase(toks: Token[], i: number, text: string): { amount: ParsedAmount; next: number } | null {
  let total = 0;
  let current: number | null = null;
  let lastMult = Infinity;
  let pendingMod: number | null = null;
  let fromWords = false;
  let hasMultiplier = false;
  let end = -1;
  let j = i;

  for (; j < toks.length; j++) {
    const t = toks[j];
    const continuing = total > 0;

    if (t.kind === "num") {
      // Digits only ever START a phrase ("30 हज़ार"); "30 हज़ार 12" is two numbers.
      // (Exception: right after साढ़े/सवा/पौने, e.g. "saadhe 3 hazaar".)
      if (j !== i && pendingMod === null) break;
      if (current !== null) break;
      current = t.num! + (pendingMod ?? 0);
      pendingMod = null;
      end = j;
      continue;
    }

    if (isWord(t, NUMBER_WORDS)) {
      const v = NUMBER_WORDS.get(t.norm)!;
      if (current !== null) break;
      if (continuing && (v >= lastMult || unitAt(toks, j + 1))) break; // "तीस हज़ार बारह महीने" -> 30000, 12
      current = v + (pendingMod ?? 0);
      pendingMod = null;
      fromWords = true;
      end = j;
      continue;
    }

    if (isWord(t, FRACTIONS)) {
      if (current !== null || pendingMod !== null) break;
      current = FRACTIONS.get(t.norm)!;
      fromWords = true;
      end = j;
      continue;
    }

    if (isWord(t, MODIFIERS)) {
      if (current !== null || pendingMod !== null) break;
      const nxt = toks[j + 1];
      if (!nxt || !(nxt.kind === "num" || isWord(nxt, NUMBER_WORDS))) break;
      pendingMod = MODIFIERS.get(t.norm)!;
      fromWords = true;
      if (end < 0) end = j - 1; // phrase begins here; end is updated by the number that follows
      continue;
    }

    if (isWord(t, MULTIPLIERS)) {
      const m = MULTIPLIERS.get(t.norm)!;
      if (current === null) {
        // A bare "हज़ार रुपये" means 1000; otherwise a multiplier cannot start a phrase.
        if (j === i && unitAt(toks, j + 1) === "INR") current = 1;
        else break;
      }
      if (m >= lastMult) break;
      total += current * m;
      current = null;
      lastMult = m;
      hasMultiplier = true;
      fromWords = true;
      end = j;
      continue;
    }

    break;
  }

  if (end < i) return null;
  const value = Math.round((total + (current ?? 0)) * 1000) / 1000;
  const first = toks[i];
  const last = toks[end];
  const unitAfter = unitAt(toks, end + 1);
  const currency = currencyBefore(toks, i) || unitAfter === "INR";
  const isSingleWord = end === i && toks[i].kind === "word";
  return {
    amount: {
      value,
      raw: text.slice(first.start, last.end),
      start: first.start,
      end: last.end,
      firstToken: i,
      lastToken: end,
      fromWords,
      hasMultiplier,
      currency,
      unitAfter,
      bare: isSingleWord && !hasMultiplier && !currency && !unitAfter && !FRACTIONS.has(toks[i].norm),
    },
    next: end + 1,
  };
}

/** Parse pre-tokenised text (`text` must be the NFC string the tokens came from). */
export function parseTokens(toks: Token[], text: string): ParsedAmount[] {
  const out: ParsedAmount[] = [];
  let i = 0;
  while (i < toks.length) {
    const p = readPhrase(toks, i, text);
    if (p) {
      out.push(p.amount);
      i = p.next;
    } else i++;
  }
  return out;
}

export function parseAmounts(text: string): ParsedAmount[] {
  const nfc = text.normalize("NFC");
  return parseTokens(tokenize(nfc), nfc);
}
