// Split a call recording into pieces of at most 28 s for Prisma (max 30 s per request). Pure, deterministic.
// Each cut is placed at the quietest 100 ms inside the last 4 s before the limit, so words are less likely
// to be cut in half; if there is no quiet spot, the cut is exactly at the limit.
export const CALL_CHUNK_SECONDS = 28;
const SEARCH_SECONDS = 4;
const WINDOW_SECONDS = 0.1;

export function planChunks(samples: Float32Array, rate: number, maxSec = CALL_CHUNK_SECONDS): [number, number][] {
  const max = Math.floor(maxSec * rate);
  const win = Math.max(1, Math.floor(WINDOW_SECONDS * rate));
  const out: [number, number][] = [];
  let start = 0;
  while (start < samples.length) {
    if (samples.length - start <= max) {
      out.push([start, samples.length]);
      break;
    }
    const hardEnd = start + max;
    const from = Math.max(start + win, hardEnd - Math.floor(SEARCH_SECONDS * rate));
    let best = hardEnd;
    let bestEnergy = Infinity;
    for (let w = from; w + win <= hardEnd; w += win) {
      let e = 0;
      for (let i = w; i < w + win; i++) e += samples[i] * samples[i];
      if (e < bestEnergy) {
        bestEnergy = e;
        best = w + Math.floor(win / 2);
      }
    }
    out.push([start, best]);
    start = best;
  }
  return out;
}

/** Mixes down to mono (average of channels). */
export function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length;
  const out = new Float32Array(n);
  for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
  return out;
}
