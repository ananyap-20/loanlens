// Speech starts sooner: prompts are split into sentence chunks; chunk 1 plays while chunk 2 is generated.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { splitForSpeech } from "@/lib/audio/chunks";

const speakMock = vi.fn(async (text: string) => new Blob([text], { type: "audio/mpeg" }));
vi.mock("@/lib/gnani/queue", () => ({ gnani: { speak: (t: string) => speakMock(t) } }));
vi.mock("@/lib/audio/cues", () => ({ resumeAudio: vi.fn(async () => undefined) }));

type Handler = (() => void) | null;
class FakeAudio {
  static last: FakeAudio;
  src = "";
  duration = NaN;
  onended: Handler = null;
  onpause: Handler = null;
  onerror: Handler = null;
  onloadedmetadata: Handler = null;
  constructor() {
    FakeAudio.last = this;
  }
  play() {
    return Promise.resolve();
  }
  pause() {
    this.onpause?.();
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));
let voice: typeof import("@/lib/audio/voice");

beforeEach(async () => {
  vi.stubGlobal("Audio", FakeAudio);
  speakMock.mockClear();
  vi.resetModules();
  voice = await import("@/lib/audio/voice");
});
afterEach(() => vi.unstubAllGlobals());

describe("splitForSpeech", () => {
  it("the first chunk is the first sentence alone; later sentences are grouped; nothing is lost", () => {
    const t = "ध्यान से सुनिए। लोन तीस हज़ार रुपये का है। आपके हाथ में अट्ठाईस हज़ार पाँच सौ रुपये आएँगे। प्रोसेसिंग फ़ीस पंद्रह सौ रुपये है।";
    const c = splitForSpeech(t);
    expect(c[0]).toBe("ध्यान से सुनिए।");
    expect(c.join(" ")).toBe(t);
    expect(c.every((x) => x.length <= 140)).toBe(true);
    expect(c.length).toBeLessThan(4);
  });
  it("text without sentence marks stays whole", () => {
    expect(splitForSpeech("बिना विराम")).toEqual(["बिना विराम"]);
  });
});

describe("speak() with chunks", () => {
  it("requests chunk 2 while chunk 1 plays, then plays them in order", async () => {
    const p = voice.speak("एक। दो।");
    await flush();
    await flush();
    expect(speakMock.mock.calls.map((c) => c[0])).toEqual(["एक।", "दो।"]);
    expect(FakeAudio.last.src).toMatch(/^blob:/);
    FakeAudio.last.onended?.(); // chunk 1 ends
    await flush();
    await flush();
    FakeAudio.last.onended?.(); // chunk 2 ends
    await expect(p).resolves.toBeUndefined();
  });

  it("stopping during chunk 1 never generates chunk 3", async () => {
    const p = voice.speak("एक। दो। तीन। चार। पाँच। छह। सात। आठ। नौ। दस। ग्यारह। बारह। तेरह। चौदह। पंद्रह। सोलह। सत्रह। अठारह। उन्नीस। बीस।".repeat(4));
    await flush();
    await flush();
    voice.stopSpeaking();
    await expect(p).resolves.toBeUndefined();
    expect(speakMock.mock.calls.length).toBe(2);
  });

  it("prefetchSpeech warms only the first chunk", () => {
    voice.prefetchSpeech("पहला। दूसरा। तीसरा।");
    expect(speakMock.mock.calls.map((c) => c[0])).toEqual(["पहला।"]);
  });
});
