// Split a spoken prompt into short sentence chunks so speech can START sooner:
// the first (short) chunk is generated and played while the next one is being generated. Pure.
const MAX_CHARS = 140;
const FIRST_MAX = 70;

export function splitForSpeech(text: string): string[] {
  const sentences = text
    .split(/(?<=[।?!:.])\s+/u) // "." ends sentences in English and Marathi
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const s of sentences) {
    const limit = out.length <= 1 ? FIRST_MAX : MAX_CHARS; // keep the opening chunk short
    const last = out[out.length - 1];
    if (last !== undefined && out.length > 1 && last.length + 1 + s.length <= limit) out[out.length - 1] = `${last} ${s}`;
    else out.push(s);
  }
  return out.length ? out : [text];
}
