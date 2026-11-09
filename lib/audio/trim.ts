// Silence trimming for speech chunks (pure, deterministic). Timbre mp3s carry ~50-200 ms of silence at the start
// and ~120-290 ms at the end; at every join that adds up to a clearly audible pause. We keep a few ms of padding
// so words are never clipped, and a tiny fade so cutting never clicks.
export type TrimOptions = {
  threshold?: number; // amplitude below this counts as silence (0..1)
  padStartMs?: number;
  padEndMs?: number;
  fadeMs?: number;
};

export const TRIM_DEFAULTS = { threshold: 0.01, padStartMs: 15, padEndMs: 40, fadeMs: 5 } as const;

/** [start, end) sample range to keep. A recording that is silent everywhere is left whole. */
export function trimBounds(channels: Float32Array[], rate: number, o: TrimOptions = {}): { start: number; end: number } {
  const n = channels[0]?.length ?? 0;
  if (n === 0) return { start: 0, end: 0 };
  const th = o.threshold ?? TRIM_DEFAULTS.threshold;
  const loud = (i: number) => channels.some((c) => Math.abs(c[i]) >= th);
  let first = 0;
  while (first < n && !loud(first)) first++;
  if (first === n) return { start: 0, end: n };
  let last = n - 1;
  while (last > first && !loud(last)) last--;
  const padStart = Math.round(((o.padStartMs ?? TRIM_DEFAULTS.padStartMs) * rate) / 1000);
  const padEnd = Math.round(((o.padEndMs ?? TRIM_DEFAULTS.padEndMs) * rate) / 1000);
  return { start: Math.max(0, first - padStart), end: Math.min(n, last + 1 + padEnd) };
}

/** Trimmed copy of every channel, with a short linear fade at both ends. */
export function trimAndFade(channels: Float32Array[], rate: number, o: TrimOptions = {}): Float32Array[] {
  const { start, end } = trimBounds(channels, rate, o);
  const fade = Math.max(1, Math.round(((o.fadeMs ?? TRIM_DEFAULTS.fadeMs) * rate) / 1000));
  return channels.map((c) => {
    const out = c.slice(start, end);
    const f = Math.min(fade, Math.floor(out.length / 2));
    for (let i = 0; i < f; i++) {
      const g = i / f;
      out[i] *= g;
      out[out.length - 1 - i] *= g;
    }
    return out;
  });
}
