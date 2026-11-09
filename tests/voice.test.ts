// speak() must always settle, so the "बोल रही हूँ…" indicator can never get stuck.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/gnani/queue", () => ({ gnani: { speak: vi.fn(async () => new Blob(["mp3"], { type: "audio/mpeg" })) } }));
vi.mock("@/lib/audio/cues", () => ({ resumeAudio: vi.fn(async () => undefined) }));

type Handler = (() => void) | null;
class FakeAudio {
  static last: FakeAudio;
  static playBehaviour: "ok" | "reject" = "ok";
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
    return FakeAudio.playBehaviour === "ok" ? Promise.resolve() : Promise.reject(new DOMException("blocked", "NotAllowedError"));
  }
  pause() {
    this.onpause?.();
  }
}

let voice: typeof import("@/lib/audio/voice");
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  vi.stubGlobal("Audio", FakeAudio);
  FakeAudio.playBehaviour = "ok";
  vi.resetModules();
  voice = await import("@/lib/audio/voice");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function started(p: Promise<void>) {
  await flush();
  await flush();
  return p;
}

describe("speak() settles", () => {
  it("when the clip ends", async () => {
    const p = voice.speak("नमस्ते");
    await flush();
    FakeAudio.last.onended?.();
    await expect(started(p)).resolves.toBeUndefined();
  });

  it("when playback fails (error event)", async () => {
    const p = voice.speak("नमस्ते");
    await flush();
    FakeAudio.last.onerror?.();
    await expect(p).rejects.toThrow("Audio playback failed");
  });

  it("when the browser refuses to play", async () => {
    FakeAudio.playBehaviour = "reject";
    await expect(voice.speak("नमस्ते")).rejects.toThrow("blocked");
  });

  it("when speech is stopped or paused (e.g. the mic opens)", async () => {
    const p = voice.speak("नमस्ते");
    await flush();
    voice.stopSpeaking();
    await expect(p).resolves.toBeUndefined();
  });

  it("when the clip never reports 'ended' (duration guard)", async () => {
    vi.useFakeTimers();
    const p = voice.speak("नमस्ते");
    await vi.advanceTimersByTimeAsync(0);
    FakeAudio.last.duration = 4;
    FakeAudio.last.onloadedmetadata?.();
    await vi.advanceTimersByTimeAsync(7001);
    await expect(p).resolves.toBeUndefined();
  });

  it("when newer speech replaces it", async () => {
    const first = voice.speak("एक");
    await flush();
    const second = voice.speak("दो");
    await expect(first).resolves.toBeUndefined();
    await flush();
    FakeAudio.last.onended?.();
    await expect(second).resolves.toBeUndefined();
  });
});
