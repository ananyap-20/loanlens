// Narration polish: silence trimming, gapless scheduling, chunk planning, static prompts, and the Web Audio engine
// (with a fake AudioContext and a fake Gnani queue; no real audio, no API calls).
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { planSpeechChunks } from "@/lib/audio/plan";
import { staticFile, staticKeyFor, textHash } from "@/lib/audio/staticAudio";
import { Timeline } from "@/lib/audio/timeline";
import { trimAndFade, trimBounds } from "@/lib/audio/trim";
import { PACKS } from "@/lib/i18n";
import { readPdfTerms } from "@/lib/paper/pdf";
import { staticPrompts, staticVoices } from "@/lib/i18n/staticPrompts";

const RATE = 1000; // 1 sample = 1 ms keeps the arithmetic obvious

function speechWithSilence(lead: number, speech: number, trail: number): Float32Array {
  const a = new Float32Array(lead + speech + trail);
  for (let i = lead; i < lead + speech; i++) a[i] = 0.5;
  return a;
}

describe("trimBounds / trimAndFade", () => {
  it("removes leading and trailing silence, keeping a little padding", () => {
    const { start, end } = trimBounds([speechWithSilence(200, 500, 300)], RATE, { padStartMs: 15, padEndMs: 40 });
    expect(start).toBe(185);
    expect(end).toBe(200 + 500 + 40);
  });

  it("never trims into the speech, whatever the padding", () => {
    const { start, end } = trimBounds([speechWithSilence(10, 100, 10)], RATE, { padStartMs: 0, padEndMs: 0 });
    expect([start, end]).toEqual([10, 110]);
    const big = trimBounds([speechWithSilence(10, 100, 10)], RATE, { padStartMs: 500, padEndMs: 500 });
    expect([big.start, big.end]).toEqual([0, 120]); // padding is clamped to the clip
  });

  it("silence below the threshold counts as silence; at or above it does not", () => {
    const a = new Float32Array(100);
    a[40] = 0.009;
    a[50] = 0.011;
    a[60] = 0.2;
    const { start, end } = trimBounds([a], RATE, { padStartMs: 0, padEndMs: 0 });
    expect([start, end]).toEqual([50, 61]);
  });

  it("a clip that is silent everywhere is left whole; empty stays empty", () => {
    expect(trimBounds([new Float32Array(50)], RATE)).toEqual({ start: 0, end: 50 });
    expect(trimBounds([new Float32Array(0)], RATE)).toEqual({ start: 0, end: 0 });
  });

  it("uses every channel: speech in either channel is kept", () => {
    const l = speechWithSilence(100, 50, 100);
    const r = speechWithSilence(60, 50, 140);
    const { start, end } = trimBounds([l, r], RATE, { padStartMs: 0, padEndMs: 0 });
    expect([start, end]).toEqual([60, 150]);
  });

  it("returns trimmed copies with a short fade, and does not touch the input", () => {
    const src = speechWithSilence(100, 200, 100);
    const [out] = trimAndFade([src], RATE, { padStartMs: 0, padEndMs: 0, fadeMs: 10 });
    expect(out.length).toBe(200);
    expect(out[0]).toBe(0); // fade starts from silence
    expect(out[100]).toBe(0.5); // the middle is untouched
    expect(out[199]).toBe(0);
    expect(src[150]).toBe(0.5);
    expect(src.length).toBe(400);
  });
});

describe("Timeline (gapless scheduling)", () => {
  it("starts each chunk exactly when the previous one ends (plus the tiny gap)", () => {
    const t = new Timeline(0.03, 0.02);
    const durations = [1.5, 2, 0.8];
    const starts = durations.map((d) => t.schedule(d, 0)); // all decoded before playback starts
    expect(starts[0]).toBeCloseTo(0.02);
    expect(starts[1]).toBeCloseTo(0.02 + 1.5 + 0.03);
    expect(starts[2]).toBeCloseTo(starts[1] + 2 + 0.03);
    expect(t.end).toBeCloseTo(starts[2] + 0.8 + 0.03);
  });

  it("a chunk that arrives late starts as soon as it is ready, never in the past", () => {
    const t = new Timeline();
    const a = t.schedule(1, 0); // plays 0.02 .. 1.02
    const b = t.schedule(1, 5); // arrives at t=5, long after the first ended
    expect(b).toBeCloseTo(5.02);
    expect(b).toBeGreaterThan(a + 1);
  });

  it("a chunk that arrives early is queued right behind the previous one", () => {
    const t = new Timeline(0.03, 0.02);
    t.schedule(4, 0);
    expect(t.schedule(1, 1)).toBeCloseTo(0.02 + 4 + 0.03);
  });
});

describe("planSpeechChunks", () => {
  const S = (n: number, tag = "क") => `${tag.repeat(n)}।`;

  it("short first chunk for a fast start, the rest merged to about 120–200 characters, nothing lost", () => {
    const sentences = [S(30), S(25), S(40), S(40), S(40), S(40), S(40), S(40), S(40), S(40)];
    const text = sentences.join(" ");
    const c = planSpeechChunks(text);
    // ramp: a small first chunk (fast start), a medium second one (generated while the first plays), then long ones
    expect(c[0].length).toBeLessThanOrEqual(55);
    expect(c[1].length).toBeLessThanOrEqual(120);
    expect(c[1].length).toBeGreaterThanOrEqual(c[0].length);
    for (const x of c.slice(2, -1)) {
      expect(x.length).toBeGreaterThanOrEqual(120);
      expect(x.length).toBeLessThanOrEqual(200);
    }
    expect(c.join(" ")).toBe(text);
    expect(c.length).toBeLessThan(sentences.length / 2); // far fewer joins than one chunk per sentence
  });

  it("many tiny sentences are merged, not spoken one by one", () => {
    const text = Array.from({ length: 12 }, () => "ठीक है।").join(" ");
    const c = planSpeechChunks(text);
    expect(c.length).toBeLessThanOrEqual(3);
    expect(c.join(" ")).toBe(text);
  });

  it("a long single sentence stays whole; text without sentence marks stays whole; empty is kept", () => {
    const long = "क".repeat(350);
    expect(planSpeechChunks(long)).toEqual([long]);
    expect(planSpeechChunks("बिना विराम")).toEqual(["बिना विराम"]);
    expect(planSpeechChunks("")).toEqual([""]);
  });

  it("splits English at full stops and question marks too", () => {
    const c = planSpeechChunks("Listen carefully. The loan is thirty thousand rupees. You will get less in hand. Why? Because of the fee.");
    expect(c.join(" ")).toBe("Listen carefully. The loan is thirty thousand rupees. You will get less in hand. Why? Because of the fee.");
    expect(c[0]).toContain("Listen carefully.");
  });

  it("a very short tail joins the chunk before it when it fits", () => {
    const c = planSpeechChunks([S(30), S(100), S(100), S(15)].join(" "));
    expect(c.at(-1)!.length).toBeGreaterThan(20);
  });
});

describe("static prompts", () => {
  it("hash and file names are deterministic and differ per text and per voice", () => {
    expect(textHash("नमस्ते")).toBe(textHash("नमस्ते"));
    expect(textHash("a")).not.toBe(textHash("b"));
    expect(textHash("x")).toMatch(/^[0-9a-f]{8}$/);
    expect(staticFile("hi-1", "x")).not.toBe(staticFile("hi-2", "x"));
    expect(staticKeyFor("mr", "male")).toBe("mr-2");
    expect(staticKeyFor("en", "female")).toBe("en-1");
  });

  it("the fixed prompts are the splash, Welcome instruction, Welcome greeting, who-is-present, paper, handover, consent and agent-question lines, digit-free, within the Timbre limit", () => {
    for (const code of ["hi", "en", "mr"] as const) {
      const prompts = staticPrompts(PACKS[code]);
      expect(prompts.map((p) => p.id)).toEqual([
        "splash", "choose-lang", "greeting", "who", "paper", "handover-agent", "handover-borrower", "consent", "consent-done",
        "agent-ask-loan_amount", "agent-ask-installment", "agent-ask-processing_fee", "agent-ask-tenure", "agent-ask-late_fee",
      ]);
      for (const p of prompts) {
        expect(p.text).not.toMatch(/[0-9०-९]/);
        expect(p.text.length).toBeLessThan(1000);
      }
    }
    expect(staticPrompts(PACKS.bn)).toEqual([]); // unfinished languages have nothing to ship
  });

  it("each selectable language has both voices (Voice 1 = female, Voice 2 = male)", () => {
    expect(staticVoices(PACKS.hi).map((v) => [v.key, v.voice])).toEqual([["hi-1", "Nalini"], ["hi-2", "Deepak"]]);
    expect(staticVoices(PACKS.en).map((v) => v.key)).toEqual(["en-1", "en-2"]);
    expect(staticVoices(PACKS.mr).map((v) => v.voice)).toEqual(["Zahira", "Ishaan"]);
  });

  it("every fixed prompt (incl. the sample paper explained and the 5 agent questions) in every selectable language and voice is shipped as a real Timbre mp3 listed in the manifest", async () => {
    const sampleRead = await readPdfTerms(readFileSync(path.join(__dirname, "..", "public", "sample", "kfs-sahyog.pdf")));
    if (!sampleRead.ok) throw new Error("sample KFS unreadable");
    const sample = { terms: sampleRead.terms, missing: sampleRead.missing, ambiguous: sampleRead.ambiguous };
    const dir = path.join(__dirname, "..", "public", "audio");
    const manifest = JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8")) as { files: string[] };
    let n = 0;
    for (const code of ["hi", "en", "mr"] as const) {
      for (const v of staticVoices(PACKS[code])) {
        for (const p of staticPrompts(PACKS[code], sample)) {
          expect(p.text.length, p.id).toBeLessThan(1000);
          const file = staticFile(v.key, p.text);
          expect(manifest.files, `${v.key} ${p.id} missing from manifest (run scripts/make-static-audio.mjs)`).toContain(file);
          expect(existsSync(path.join(dir, file)), file).toBe(true);
          expect(statSync(path.join(dir, file)).size).toBeGreaterThan(5000);
          n++;
        }
      }
    }
    expect(n).toBe(90); // 3 languages x 2 voices x 15 prompts
    expect(manifest.files.length).toBe(90);
  });
});

// ---------------------------------------------------------------- Web Audio engine with fakes
type FakeSource = { buffer: { duration: number }; start: (t: number) => void; stop: () => void; connect: () => void; onended: (() => void) | null; startedAt?: number };

const h = vi.hoisted(() => ({
  sources: [] as unknown[],
  speakCalls: [] as { text: string; signal?: AbortSignal }[],
  ctxState: "running",
  fetched: [] as string[],
  manifestFiles: [] as string[],
}));

vi.mock("@/lib/audio/cues", () => {
  const ctx = {
    get state() {
      return h.ctxState;
    },
    currentTime: 0,
    destination: {},
    sampleRate: 1000,
    // a "decoded mp3": bytes are JSON {sec}; 1 sample per ms, speech 100 ms in, 50 ms out
    decodeAudioData: async (ab: ArrayBuffer) => {
      const { sec } = JSON.parse(new TextDecoder().decode(ab)) as { sec: number };
      const n = Math.round(sec * 1000) + 150;
      const data = new Float32Array(n);
      data.fill(0.5, 100, 100 + Math.round(sec * 1000));
      return { numberOfChannels: 1, sampleRate: 1000, length: n, duration: n / 1000, getChannelData: () => data };
    },
    createBuffer: (_ch: number, len: number, rate: number) => {
      const data = new Float32Array(len);
      return { duration: len / rate, copyToChannel: (c: Float32Array) => data.set(c), getChannelData: () => data };
    },
    createBufferSource: () => {
      const s: FakeSource = {
        buffer: { duration: 0 },
        connect() {},
        start(t: number) {
          s.startedAt = t;
        },
        stop() {},
        onended: null,
      };
      h.sources.push(s);
      return s;
    },
  };
  return { audioContext: () => ctx, resumeAudio: async () => undefined };
});

vi.mock("@/lib/gnani/queue", () => ({
  gnani: {
    speak: vi.fn(async (text: string, _o: unknown, extra?: { signal?: AbortSignal }) => {
      h.speakCalls.push({ text, signal: extra?.signal });
      const sec = Math.max(1, text.length / 100);
      return new Blob([JSON.stringify({ sec })]);
    }),
  },
}));

const flush = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};

describe("speakWeb", () => {
  let web: typeof import("@/lib/audio/webspeech");
  beforeEach(async () => {
    h.sources.length = 0;
    h.speakCalls.length = 0;
    h.fetched.length = 0;
    h.ctxState = "running";
    vi.resetModules();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        h.fetched.push(url);
        if (url.endsWith("manifest.json")) return new Response(JSON.stringify({ files: h.manifestFiles }));
        return new Response(JSON.stringify({ sec: 3 }));
      }),
    );
    web = await import("@/lib/audio/webspeech");
  });
  afterEach(() => {
    web.stopWeb();
    vi.unstubAllGlobals();
    h.manifestFiles = [];
  });

  const long = Array.from({ length: 9 }, (_, i) => `वाक्य संख्या ${"क".repeat(35 + i)}।`).join(" ");

  it("requests every chunk of a prompt immediately, in order, before any of them is played", async () => {
    const done = web.speakWeb(long, false, { staticKey: null });
    await flush();
    const chunks = h.speakCalls.map((c) => c.text);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.join(" ")).toBe(long);
    expect(h.sources.length).toBe(chunks.length); // everything decoded and scheduled without waiting for playback
    (h.sources.at(-1) as FakeSource).onended?.();
    await done;
  });

  it("schedules the chunks back to back on one timeline, with the silence trimmed", async () => {
    const done = web.speakWeb(long, false, { staticKey: null });
    await flush();
    const s = h.sources as FakeSource[];
    for (let i = 1; i < s.length; i++) {
      const prevEnd = s[i - 1].startedAt! + s[i - 1].buffer.duration;
      const gap = s[i].startedAt! - prevEnd;
      expect(gap).toBeGreaterThanOrEqual(0.029); // never overlapping
      expect(gap).toBeLessThan(0.05); // and no audible hole: just the 30 ms join
    }
    // Each fake mp3 is `sec` of speech + 100 ms leading + 50 ms trailing silence. After trimming only the padding
    // (15 ms before, 40 ms after) is left: duration = sec + 0.055, not sec + 0.150.
    s.forEach((src, i) => {
      const sec = Math.max(1, h.speakCalls[i].text.length / 100);
      expect(src.buffer.duration).toBeCloseTo(sec + 0.055, 2);
    });
    resolveAll(s);
    await done;
  });

  it("resolves when the last chunk ends, not before", async () => {
    let resolved = false;
    const done = web.speakWeb(long, false, { staticKey: null }).then(() => (resolved = true));
    await flush();
    expect(resolved).toBe(false);
    (h.sources.at(-1) as FakeSource).onended?.();
    await done;
    expect(resolved).toBe(true);
  });

  it("stopping cancels chunk requests that have not started and silences what is scheduled", async () => {
    const done = web.speakWeb(long, false, { staticKey: null });
    await flush();
    const signal = h.speakCalls[0].signal!;
    web.stopWeb();
    expect(signal.aborted).toBe(true);
    await expect(done).resolves.toBeUndefined();
  });

  it("passes the selected voice, language and slow speed to Timbre", async () => {
    const { gnani } = await import("@/lib/gnani/queue");
    const done = web.speakWeb("एक।", true, { voice: "Ishaan", language: "mr-IN", staticKey: "mr-2" });
    await flush();
    expect((gnani.speak as unknown as { mock: { calls: unknown[][] } }).mock.calls.at(-1)![1]).toEqual({ voice: "Ishaan", language: "mr-IN", speed: 0.85 });
    (h.sources.at(-1) as FakeSource).onended?.();
    await done;
  });

  it("a fixed prompt with a shipped clip is played with NO API call", async () => {
    const text = PACKS.hi.say!.who;
    h.manifestFiles = [staticFile("hi-1", text)];
    vi.resetModules();
    web = await import("@/lib/audio/webspeech");
    const done = web.speakWeb(text, false, { staticKey: "hi-1" });
    await flush();
    expect(h.speakCalls.length).toBe(0);
    expect(h.fetched).toContain(`/audio/${staticFile("hi-1", text)}`);
    expect(h.sources.length).toBe(1);
    (h.sources[0] as FakeSource).onended?.();
    await done;
  });

  it("slow replay, other voices, and changed text are NOT served from the static clips (they go to Timbre)", async () => {
    const text = PACKS.hi.say!.who;
    h.manifestFiles = [staticFile("hi-1", text)];
    vi.resetModules();
    web = await import("@/lib/audio/webspeech");
    const a = web.speakWeb(text, true, { staticKey: "hi-1" }); // slow
    await flush();
    expect(h.speakCalls.length).toBeGreaterThan(0);
    web.stopWeb();
    await a;
    h.speakCalls.length = 0;
    const b = web.speakWeb(text, false, { staticKey: "hi-2" }); // other voice
    await flush();
    expect(h.speakCalls.length).toBeGreaterThan(0);
    web.stopWeb();
    await b;
    h.speakCalls.length = 0;
    const c = web.speakWeb(text + " नया", false, { staticKey: "hi-1" }); // text changed
    await flush();
    expect(h.speakCalls.length).toBeGreaterThan(0);
    web.stopWeb();
    await c;
  });

  it("audio blocked (no tap yet) is an error, not silence", async () => {
    h.ctxState = "suspended";
    await expect(web.speakWeb("एक।", false, { staticKey: null })).rejects.toThrow("blocked");
  });

  it("prefetch warms the first chunk (or the static clip) without playing anything", async () => {
    const { gnani } = await import("@/lib/gnani/queue");
    await web.prefetchWeb(long, false, { staticKey: null });
    expect(h.speakCalls.length).toBe(1);
    expect(h.speakCalls[0].text).toBe(planSpeechChunks(long)[0]);
    expect(h.sources.length).toBe(0);
    void gnani;
  });
});

function resolveAll(s: FakeSource[]) {
  s.at(-1)?.onended?.();
}

describe("preloadStaticWeb", () => {
  it("downloads only clips that exist and never calls Timbre", async () => {
    const text = PACKS.hi.say!.who;
    h.speakCalls.length = 0;
    h.fetched.length = 0;
    h.manifestFiles = [staticFile("hi-1", text)];
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      h.fetched.push(url);
      return url.endsWith("manifest.json") ? new Response(JSON.stringify({ files: h.manifestFiles })) : new Response(JSON.stringify({ sec: 2 }));
    }));
    const web = await import("@/lib/audio/webspeech");
    await web.preloadStaticWeb([text, "कोई और वाक्य जिसकी क्लिप नहीं है।"], "hi-1");
    await flush();
    expect(h.fetched.filter((u) => u.endsWith(".mp3"))).toEqual([`/audio/${staticFile("hi-1", text)}`]);
    expect(h.speakCalls.length).toBe(0);
    vi.unstubAllGlobals();
    h.manifestFiles = [];
  });
});
