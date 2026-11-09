// Deterministic transcript normalisation for language packs (no AI):
// 1) number words -> digits, using ONLY the pack's own table (an unknown word stays a word, never guessed);
// 2) the pack's keywords -> the engine's existing keywords (whole words / phrases, longest match first).
import { normWord, tokenize, type Token } from "@/lib/engine/tokens";

export type NumberTable = {
  /** 0–99 (and any other plain values) */
  units: ReadonlyMap<string, number>;
  /** hundred / thousand / lakh / crore style multipliers */
  multipliers: ReadonlyMap<string, number>;
  /** words skipped inside a number phrase ("and" in "six hundred and sixty") */
  joiners?: ReadonlySet<string>;
  /** suffix that multiplies the stem by 100 (Marathi "पाचशे" = 5 × 100); stem must be in `units` */
  hundredSuffix?: string;
  /** half/quarter words: "dedh" = 1.5 (absolute), "saade" = +0.5 to the next number */
  fractions?: ReadonlyMap<string, { value: number; mode: "absolute" | "plus" | "minus" }>;
};

const mapOf = (pairs: ReadonlyArray<readonly [string, number]>) => new Map(pairs.map(([w, n]) => [normWord(w), n] as [string, number]));

export function numberTable(t: {
  units: ReadonlyArray<readonly [string, number]>;
  multipliers: ReadonlyArray<readonly [string, number]>;
  joiners?: readonly string[];
  hundredSuffix?: string;
  fractions?: ReadonlyArray<readonly [string, number, "absolute" | "plus" | "minus"]>;
}): NumberTable {
  return {
    units: mapOf(t.units),
    multipliers: mapOf(t.multipliers),
    joiners: new Set((t.joiners ?? []).map(normWord)),
    hundredSuffix: t.hundredSuffix ? normWord(t.hundredSuffix) : undefined,
    fractions: new Map((t.fractions ?? []).map(([w, v, m]) => [normWord(w), { value: v, mode: m }])),
  };
}

function unitValue(t: NumberTable, tok: Token): number | undefined {
  if (tok.kind !== "word") return undefined;
  const v = t.units.get(tok.norm);
  if (v !== undefined) return v;
  if (t.hundredSuffix && tok.norm.endsWith(t.hundredSuffix) && tok.norm.length > t.hundredSuffix.length) {
    const stem = t.units.get(tok.norm.slice(0, -t.hundredSuffix.length));
    if (stem !== undefined && stem >= 1 && stem <= 99) return stem * 100;
  }
  return undefined;
}

/** Replaces each run of number words with its digits ("two thousand six hundred sixty six" -> "2666"). */
export function wordsToDigits(text: string, t: NumberTable): string {
  const src = text.normalize("NFC");
  const toks = tokenize(src);
  const out: string[] = [];
  let last = 0;
  let i = 0;
  while (i < toks.length) {
    const start = i;
    let total = 0;
    let current = 0;
    let used = false;
    let pending: { value: number; mode: "absolute" | "plus" | "minus" } | null = null;
    let j = i;
    for (; j < toks.length; j++) {
      const tok = toks[j];
      const frac = t.fractions?.get(tok.norm);
      const u = unitValue(t, tok);
      const m = tok.kind === "word" ? t.multipliers.get(tok.norm) : undefined;
      if (frac && !pending) {
        pending = frac;
        continue;
      }
      if (u !== undefined) {
        current += u;
        used = true;
        continue;
      }
      if (m !== undefined && (used || pending)) {
        let base = current || (pending?.mode === "absolute" ? 0 : 1);
        if (pending) {
          base = pending.mode === "absolute" ? pending.value : pending.mode === "plus" ? base + pending.value : base - pending.value;
          pending = null;
        }
        if (m === 100) current = base * 100;
        else {
          total += base * m;
          current = 0;
        }
        used = true;
        continue;
      }
      if (used && t.joiners?.has(tok.norm) && j + 1 < toks.length && (unitValue(t, toks[j + 1]) !== undefined || t.multipliers.has(toks[j + 1].norm))) continue;
      if (used && tok.text === "-" && j + 1 < toks.length && unitValue(t, toks[j + 1]) !== undefined) continue; // sixty-six
      break;
    }
    if (used && !pending) {
      const value = total + current;
      out.push(src.slice(last, toks[start].start), String(Math.round(value * 100) / 100));
      last = toks[j - 1].end;
      i = j;
    } else i = start + 1;
  }
  out.push(src.slice(last));
  return out.join("");
}

/** [phrase in the pack's language, engine keyword] pairs; whole-word, longest phrase first. */
export function applyLexicon(text: string, pairs: ReadonlyArray<readonly [string, string]>): string {
  const src = text.normalize("NFC");
  const toks = tokenize(src);
  const table = pairs
    .map(([from, to]) => ({ seq: tokenize(from).map((t) => t.norm), to }))
    .filter((p) => p.seq.length)
    .sort((a, b) => b.seq.length - a.seq.length);
  const out: string[] = [];
  let last = 0;
  for (let i = 0; i < toks.length; ) {
    const hit = table.find((p) => p.seq.every((w, k) => toks[i + k]?.norm === w));
    if (hit) {
      out.push(src.slice(last, toks[i].start), hit.to);
      last = toks[i + hit.seq.length - 1].end;
      i += hit.seq.length;
    } else i++;
  }
  out.push(src.slice(last));
  return out.join("");
}
