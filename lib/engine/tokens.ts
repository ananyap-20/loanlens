// Deterministic tokenizer shared by the engine. Works on Hindi (Devanagari), Hinglish (Latin) and digits.

export type Token = {
  text: string; // as written (after NFC)
  norm: string; // normalised for lookups (see normWord)
  start: number; // offsets into the NFC string
  end: number;
  kind: "num" | "word" | "other";
  num?: number; // for kind === "num"
};

// Decimal digits of every script we support: Devanagari (hi, mr), Bengali, Gurmukhi (pa), Gujarati,
// Tamil, Telugu, Kannada, Malayalam. Prisma or the user may give any of them; all become ASCII 0-9.
const ZEROS = [0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0be6, 0x0c66, 0x0ce6, 0x0d66];
export const DIGIT_CLASS = "0-9" + ZEROS.map((z) => `\\u${z.toString(16).padStart(4, "0")}-\\u${(z + 9).toString(16).padStart(4, "0")}`).join("");

/** Any supported script's digits -> ASCII digits (other characters untouched). */
export function nativeDigitsToAscii(s: string): string {
  return s.replace(new RegExp(`[${DIGIT_CLASS.slice(3)}]`, "gu"), (d) => {
    const c = d.codePointAt(0)!;
    const z = ZEROS.find((zero) => c >= zero && c <= zero + 9);
    return z === undefined ? d : String(c - z);
  });
}
/** Kept for existing callers: now accepts every supported script, not only Devanagari. */
export const devanagariDigitsToAscii = nativeDigitsToAscii;

/**
 * Lower-case, NFC, drop nukta (ज़ -> ज, ड़ -> ड), chandrabindu -> anusvara (पाँच -> पांच),
 * drop zero-width joiners. Used for every word lookup so spelling variants meet.
 */
export function normWord(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/़/g, "")
    .replace(/ँ/g, "ं")
    .replace(/[‌‍]/g, "");
}

const DIGIT = `[${DIGIT_CLASS}]`;
const TOKEN_RE = new RegExp(
  `${DIGIT}+(?:,${DIGIT}+)*(?:\\.${DIGIT}+)?|[\\p{L}\\p{M}]+(?:'[\\p{L}]+)?|\\S`,
  "gu",
);

export function tokenize(text: string): Token[] {
  const src = text.normalize("NFC");
  const out: Token[] = [];
  for (const m of src.matchAll(TOKEN_RE)) {
    const raw = m[0];
    const start = m.index ?? 0;
    const tok: Token = { text: raw, norm: normWord(raw), start, end: start + raw.length, kind: "other" };
    if (new RegExp(`^[${DIGIT_CLASS}]`).test(raw)) {
      tok.kind = "num";
      tok.num = Number(devanagariDigitsToAscii(raw).replace(/,/g, ""));
    } else if (/^[\p{L}\p{M}]/u.test(raw)) {
      tok.kind = "word";
    }
    out.push(tok);
  }
  return out;
}

/** Does the token sequence starting at i equal seq (already normalised)? */
export function matchSeq(toks: Token[], i: number, seq: readonly string[]): boolean {
  if (i + seq.length > toks.length) return false;
  for (let k = 0; k < seq.length; k++) if (toks[i + k].norm !== seq[k]) return false;
  return true;
}

export function phrases(list: readonly string[]): string[][] {
  return list.map((p) => p.trim().split(/\s+/).map(normWord));
}
