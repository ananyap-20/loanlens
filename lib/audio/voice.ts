// Plays Gnani Timbre speech through ONE shared <audio> element (browser only).
// Every Timbre call goes through the shared queue (one request at a time, 429 backoff, memory cache).
import { gnani } from "@/lib/gnani/queue";
import { SLOW_SPEED } from "@/lib/engine/gate";
import { samplesToWavBlob } from "./wav";
import { resumeAudio } from "./cues";

let el: HTMLAudioElement | null = null;
let seq = 0;
let finishCurrent: (() => void) | null = null;
const MAX_CLIP_MS = 60_000;

function element(): HTMLAudioElement {
  el ??= new Audio();
  return el;
}

/** Call inside the Welcome tap: plays a tiny silent clip so later speech may auto-play (Android Chrome). */
// Uses its own throwaway element, so it can never pause real speech that starts right after.
export function unlockAudio(): void {
  void resumeAudio();
  element(); // create the shared speech element inside the tap as well
  const silent = URL.createObjectURL(samplesToWavBlob(new Float32Array(1600), 16000));
  const a = new Audio(silent);
  a.play()
    .catch(() => undefined) // ignore: the next speak() reports a real problem
    .finally(() => URL.revokeObjectURL(silent));
}

/** Stops any speech that is playing (e.g. before the microphone opens). */
export function stopSpeaking() {
  seq++;
  const a = element();
  a.pause();
  finishCurrent?.();
  finishCurrent = null;
}

/**
 * Speaks `text` (Devanagari, numbers already in words) with Timbre and resolves when it ends,
 * or when newer speech / stopSpeaking() replaces it. Throws GnaniClientError if Timbre fails.
 */
export async function speak(text: string, slow = false): Promise<void> {
  stopSpeaking();
  const mine = seq;
  const blob = await gnani.speak(text, slow ? { speed: SLOW_SPEED } : {});
  if (mine !== seq) return; // replaced while Timbre was answering
  const a = element();
  if (a.src.startsWith("blob:")) URL.revokeObjectURL(a.src);
  a.src = URL.createObjectURL(blob);
  await new Promise<void>((resolve, reject) => {
    // Settle exactly once, whatever happens: ended, paused (stopSpeaking / audio focus lost), error,
    // a rejected play(), or a clip that never reports "ended" (guard = duration + 3 s, else 60 s).
    let guard = setTimeout(() => settle(), MAX_CLIP_MS);
    const settle = (err?: Error) => {
      clearTimeout(guard);
      a.onended = a.onpause = a.onerror = a.onloadedmetadata = null;
      if (finishCurrent === done) finishCurrent = null;
      if (err) reject(err);
      else resolve();
    };
    const done = () => settle();
    finishCurrent = done;
    a.onended = done;
    a.onpause = done;
    a.onerror = () => settle(new Error("Audio playback failed"));
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration)) {
        clearTimeout(guard);
        guard = setTimeout(() => settle(), a.duration * 1000 + 3000);
      }
    };
    a.play().catch((e) => settle(e instanceof Error ? e : new Error(String(e))));
  });
}
