// Chunk plan for a spoken prompt (pure). Fewer, longer chunks mean fewer joins, but the first chunk stays short so
// the first words start sooner (Timbre takes ~0.8 s + ~15 ms per character to generate).
//   first chunk: the first sentence, plus more sentences while it stays within `firstMax` characters
//   other chunks: sentences merged until a chunk reaches `min` characters, never exceeding `max`
// A single sentence longer than `max` is kept whole (Timbre accepts up to 1,000 characters).
export type PlanOptions = { firstMax?: number; min?: number; max?: number };

export function planSpeechChunks(text: string, o: PlanOptions = {}): string[] {
  const firstMax = o.firstMax ?? 90;
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
    if (!cur) cur = s;
    else if (cur.length < min && cur.length + 1 + s.length <= max) cur += ` ${s}`;
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
