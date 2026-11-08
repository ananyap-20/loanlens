// Status sounds made with the Web Audio API (oscillators, no audio files, no AI).
// chime = match, buzz = different. One shared AudioContext, resumed by the Welcome tap.

let ctx: AudioContext | null = null;

export function audioContext(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return null;
  ctx ??= new AudioContext();
  return ctx;
}

/** Call inside a user tap: lets later sounds play without another tap. */
export async function resumeAudio(): Promise<void> {
  const c = audioContext();
  if (c && c.state === "suspended") await c.resume().catch(() => undefined);
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, peak: number) {
  const c = audioContext();
  if (!c) return;
  const t0 = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Two rising bell tones: ✅ matched. */
export function chime() {
  void resumeAudio();
  tone(880, 0, 0.35, "sine", 0.3);
  tone(1320, 0.15, 0.5, "sine", 0.25);
}

/** Low double buzz: ❌ different. */
export function buzz() {
  void resumeAudio();
  tone(140, 0, 0.25, "square", 0.12);
  tone(140, 0.32, 0.3, "square", 0.12);
}

/** Short soft tick: ❔ not mentioned / couldn't check. */
export function tick() {
  void resumeAudio();
  tone(520, 0, 0.12, "triangle", 0.15);
}
