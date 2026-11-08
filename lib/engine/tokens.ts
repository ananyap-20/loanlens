// Deterministic tokenizer shared by the engine. Works on Hindi (Devanagari), Hinglish (Latin) and digits.

export type Token = {
  text: string; // as written (after NFC)
  norm: string; // normalised for lookups (see normWord)
  start: number; // offsets into the NFC string
  end: number;
  kind: "num" | "word" | "other";
  num?: number; // for kind === "num"
};

const DEVANAGARI_ZERO = 0x0966;

export function devanagariDigitsToAscii(s: string): string {
  return s.replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - DEVANAGARI_ZERO));
}

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

const DIGIT = "[0-9\\u0966-\\u096F]";
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
    if (/^[0-9०-९]/.test(raw)) {
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
