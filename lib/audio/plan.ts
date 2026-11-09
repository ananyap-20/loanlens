// Chunk plan for a spoken prompt (pure). Fewer, longer chunks mean fewer joins, but the first chunk stays short so
// the first words start sooner (Timbre takes ~0.8 s + ~15 ms per character to generate).
//   first chunk:  the first sentence, plus more sentences while it stays within `firstMax` characters
//   second chunk: merged up to `secondMax` characters (it must be generated while the first one plays)
//   other chunks: sentences merged until a chunk reaches `min` characters, never exceeding `max`
// Timbre needs ~0.8 s + ~15 ms per character; speech plays at ~70 ms per character, so each chunk can be longer
// than the one before it and still be ready in time. A single sentence longer than `max` is kept whole
// (Timbre accepts up to 1,000 characters).
export type PlanOptions = { firstMax?: number; secondMax?: number; min?: number; max?: number };

export function planSpeechChunks(text: string, o: PlanOptions = {}): string[] {
  const firstMax = o.firstMax ?? 55;
  const secondMax = o.secondMax ?? 120;
  const min = o.min ?? 120;
  const max = o.max ?? 200;
  const sentences = text
    .split(/(?<=[।?!:.])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length === 0) return [text];

  const out: string[] = [];
  let i = 1;
  let cur = sentences[0];
  while (i < sentences.length && cur.length + 1 + sentences[i].length <= firstMax) cur += ` ${sentences[i++]}`;
  out.push(cur);

  cur = "";
  for (; i < sentences.length; i++) {
    const s = sentences[i];
    const second = out.length === 1; // the chunk being built is the second one
    const limit = second ? secondMax : max;
    const want = second ? Math.min(min, secondMax - 20) : min;
    if (!cur) cur = s;
    else if (cur.length < want && cur.length + 1 + s.length <= limit) cur += ` ${s}`;
    else {
      out.push(cur);
      cur = s;
    }
  }
  if (cur) out.push(cur);

  // A very short tail joins the chunk before it when that still fits.
  const n = out.length;
  if (n > 2 && out[n - 1].length < min / 2 && out[n - 2].length + 1 + out[n - 1].length <= max) {
    out.splice(n - 2, 2, `${out[n - 2]} ${out[n - 1]}`);
  }
  return out;
}
