// Gapless speech on ONE AudioContext timeline (browser only).
//  - every chunk of a prompt is requested at once, in order, through the shared Gnani queue
//  - each mp3 is decoded with Web Audio, its leading/trailing silence trimmed, then scheduled to start exactly when
//    the previous chunk ends (a late chunk starts as soon as it is ready)
//  - fixed prompts that exist as pre-generated Timbre mp3s (public/audio) are played with NO API call
import { SLOW_SPEED } from "@/lib/engine/gate";
import { gnani } from "@/lib/gnani/queue";
import { audioContext, resumeAudio } from "./cues";
import { planSpeechChunks } from "./plan";
import { staticFile, staticUrl, STATIC_MANIFEST } from "./staticAudio";
import { Timeline } from "./timeline";
import { trimAndFade } from "./trim";

export type WebConfig = { voice?: string; language?: string; staticKey?: string | null };

let seq = 0;
let abort: AbortController | null = null;
let sources: AudioBufferSourceNode[] = [];
let finish: (() => void) | null = null;

/** Stops whatever is playing and cancels chunk requests that have not started yet. */
export function stopWeb() {
  seq++;
  abort?.abort();
  abort = null;
  for (const s of sources) {
    try {
      s.onended = null;
      s.stop();
    } catch {
      /* already stopped */
    }
  }
  sources = [];
  finish?.();
  finish = null;
}

async function decodeTrim(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  const raw = await ctx.decodeAudioData(data);
  const channels = Array.from({ length: raw.numberOfChannels }, (_, i) => raw.getChannelData(i));
  const trimmed = trimAndFade(channels, raw.sampleRate);
  const out = ctx.createBuffer(trimmed.length, Math.max(1, trimmed[0].length), raw.sampleRate);
  trimmed.forEach((c, i) => out.copyToChannel(c as Float32Array<ArrayBuffer>, i));
  return out;
}

// ---- fixed prompts shipped as static mp3 files
let manifest: Promise<Set<string>> | null = null;
function staticFiles(): Promise<Set<string>> {
  manifest ??= fetch(STATIC_MANIFEST)
    .then((r) => (r.ok ? r.json() : { files: [] }))
    .then((j: { files?: string[] }) => new Set(j.files ?? []))
    .catch(() => new Set<string>());
  return manifest;
}
const decodedStatic = new Map<string, Promise<AudioBuffer>>();
function loadStatic(ctx: BaseAudioContext, file: string): Promise<AudioBuffer> {
  let p = decodedStatic.get(file);
  if (!p) {
    p = fetch(staticUrl(file)).then(async (r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return decodeTrim(ctx, await r.arrayBuffer());
    });
    p.catch(() => decodedStatic.delete(file));
    decodedStatic.set(file, p);
  }
  return p;
}

/** Downloads and decodes the shipped clips for these texts (only those that exist; never calls Timbre). */
export async function preloadStaticWeb(texts: string[], staticKey: string | null): Promise<void> {
  const ctx = audioContext();
  if (!ctx || !staticKey) return;
  const have = await staticFiles();
  for (const t of texts) {
    const file = staticFile(staticKey, t);
    if (have.has(file)) void loadStatic(ctx, file).catch(() => undefined);
  }
}

/** Loads the manifest of static clips (cheap, no Timbre call). */
export function warmStatic(): void {
  void staticFiles();
}

const apiOptions = (cfg: WebConfig, slow: boolean) => ({
  ...(cfg.voice ? { voice: cfg.voice } : {}),
  ...(cfg.language ? { language: cfg.language } : {}),
  ...(slow ? { speed: SLOW_SPEED } : {}),
});

/** Warm the first piece of a prompt that is about to be needed. */
export async function prefetchWeb(text: string, slow: boolean, cfg: WebConfig): Promise<void> {
  const ctx = audioContext();
  if (!ctx) return;
  const file = !slow && cfg.staticKey ? staticFile(cfg.staticKey, text) : null;
  if (file && (await staticFiles()).has(file)) {
    void loadStatic(ctx, file).catch(() => undefined);
    return;
  }
  const first = planSpeechChunks(text)[0];
  if (first) void gnani.speak(first, apiOptions(cfg, slow)).catch(() => undefined);
}

/** Speaks `text`; resolves when the last chunk has finished (or speech was replaced / stopped). */
export async function speakWeb(text: string, slow: boolean, cfg: WebConfig): Promise<void> {
  stopWeb();
  const mine = seq;
  const ctl = new AbortController();
  abort = ctl;
  const ctx = audioContext();
  if (!ctx) throw new Error("Audio is not available");
  await resumeAudio();
  if (ctx.state !== "running") throw new Error("Audio is blocked until you tap the screen");
  if (mine !== seq) return;

  // Where does each piece come from? A static clip (no API call) or Timbre, all requested right now, in order.
  let pieces: Promise<AudioBuffer>[];
  const file = !slow && cfg.staticKey ? staticFile(cfg.staticKey, text) : null;
  if (file && (await staticFiles()).has(file)) {
    pieces = [loadStatic(ctx, file)];
  } else {
    const opts = apiOptions(cfg, slow);
    pieces = planSpeechChunks(text).map((chunk) =>
      gnani
        .speak(chunk, opts, { signal: ctl.signal })
        .then((blob) => blob.arrayBuffer())
        .then((ab) => decodeTrim(ctx, ab)),
    );
  }
  pieces.forEach((p) => p.catch(() => undefined)); // errors are reported when awaited, in order

  const timeline = new Timeline();
  let last: AudioBufferSourceNode | null = null;
  for (const p of pieces) {
    const buf = await p;
    if (mine !== seq) return; // replaced or stopped while waiting
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(timeline.schedule(buf.duration, ctx.currentTime));
    sources.push(src);
    last = src;
  }
  if (!last || mine !== seq) return;
  const tail = last;
  await new Promise<void>((resolve) => {
    const safety = setTimeout(() => resolve(), Math.max(0, (timeline.end - ctx.currentTime) * 1000) + 3000);
    const done = () => {
      clearTimeout(safety);
      if (finish === done) finish = null;
      resolve();
    };
    finish = done;
    tail.onended = done;
  });
}
