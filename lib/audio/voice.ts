// Plays Gnani Timbre speech through ONE shared <audio> element (browser only).
// Every Timbre call goes through the shared queue (one request at a time, 429 backoff, memory cache).
import { gnani } from "@/lib/gnani/queue";
import { SLOW_SPEED } from "@/lib/engine/gate";
import { samplesToWavBlob } from "./wav";
import { resumeAudio } from "./cues";
import { splitForSpeech } from "./chunks";
import type * as WebSpeech from "./webspeech";

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

const hasWebAudio = () => typeof AudioContext !== "undefined";
let web: typeof WebSpeech | null = null;
async function webSpeech(): Promise<typeof WebSpeech> {
  web ??= await import("./webspeech");
  return web;
}

/** Stops any speech that is playing (e.g. before the microphone opens). */
export function stopSpeaking() {
  web?.stopWeb();
  seq++;
  const a = element();
  a.pause();
  finishCurrent?.();
  finishCurrent = null;
}

// The selected language pack's Timbre voice + language. Unset = the server defaults (Hindi, Nalini),
// so the Hindi flow sends exactly the requests it always sent.
let voiceConfig: { voice?: string; language?: string } = {};
export function setVoiceConfig(c: { voice?: string; language?: string }) {
  voiceConfig = { ...c };
}
// Which pre-generated clips apply: "<language>-<voice number>". Default = Hindi, Voice 1 (the server default voice).
let staticKey: string | null = "hi-1";
export function setStaticKey(key: string | null) {
  staticKey = key;
}
const webConfig = () => ({ ...voiceConfig, staticKey });

/** Wakes the API functions and loads the list of pre-generated clips. Costs no Timbre/Prisma credit. */
export function warmUp(): void {
  if (typeof fetch === "undefined") return;
  void fetch("/api/speak").catch(() => undefined);
  void fetch("/api/transcribe").catch(() => undefined);
  if (hasWebAudio()) void webSpeech().then((w) => w.warmStatic());
}

const speakOptions = (slow: boolean) => ({ ...voiceConfig, ...(slow ? { speed: SLOW_SPEED } : {}) });

/** Warm the cache with the FIRST chunk of a prompt that is about to be needed (it then starts at once). */
export function prefetchSpeech(text: string, slow = false): void {
  if (hasWebAudio()) {
    void webSpeech().then((w) => w.prefetchWeb(text, slow, webConfig()));
    return;
  }
  const first = splitForSpeech(text)[0];
  if (first) void gnani.speak(first, speakOptions(slow)).catch(() => undefined);
}

/**
 * Speaks `text` (Devanagari, numbers already in words) with Timbre and resolves when it ends,
 * or when newer speech / stopSpeaking() replaces it. Throws GnaniClientError if Timbre fails.
 * Long prompts are split into sentence chunks: chunk 1 plays while chunk 2 is generated, so the
 * first words are heard much sooner.
 */
export async function speak(text: string, slow = false): Promise<void> {
  if (hasWebAudio()) {
    stopSpeaking();
    return (await webSpeech()).speakWeb(text, slow, webConfig());
  }
  stopSpeaking();
  const mine = seq;
  const chunks = splitForSpeech(text);
  let next: Promise<Blob> = gnani.speak(chunks[0], speakOptions(slow));
  for (let i = 0; i < chunks.length; i++) {
    const blob = await next;
    if (mine !== seq) return; // replaced while Timbre was answering
    if (i + 1 < chunks.length) {
      next = gnani.speak(chunks[i + 1], speakOptions(slow)); // generate the next sentence while this one plays
      next.catch(() => undefined); // reported when awaited
    }
    await play(blob);
    if (mine !== seq) return; // stopped or replaced while playing
  }
}

function play(blob: Blob): Promise<void> {
  const a = element();
  if (a.src.startsWith("blob:")) URL.revokeObjectURL(a.src);
  a.src = URL.createObjectURL(blob);
  return new Promise<void>((resolve, reject) => {
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
