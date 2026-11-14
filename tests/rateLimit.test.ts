import { describe, expect, it } from "vitest";
import {
  APP_RATE_LIMIT_CODE,
  MAX_AUDIO_BYTES,
  MAX_SPEAK_CHARS,
  RATE_WINDOW_MS,
  SPEAK_LIMIT,
  TRANSCRIBE_LIMIT,
  UNKNOWN_IP,
  audioSizeProblem,
  clientIp,
  createRateLimiter,
  limitsEnabled,
  rateLimitedResponse,
  speakTextProblem,
  speedProblem,
} from "@/lib/server/rateLimit";

const clock = (start = 1_000_000) => {
  let t = start;
  return { now: () => t, advance: (ms: number) => void (t += ms) };
};

describe("rate limiter (sliding window)", () => {
  it("has the documented limits", () => {
    expect(TRANSCRIBE_LIMIT).toBe(60);
    expect(SPEAK_LIMIT).toBe(60);
    expect(RATE_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it("allows requests under the limit", () => {
    const c = clock();
    const l = createRateLimiter(3, 1000, c.now);
    expect(l.hit("a").ok).toBe(true);
    expect(l.hit("a").ok).toBe(true);
    expect(l.hit("a").ok).toBe(true);
  });

  it("blocks the request over the limit, with a Retry-After in seconds", () => {
    const c = clock();
    const l = createRateLimiter(2, 10_000, c.now);
    l.hit("a");
    c.advance(3000);
    l.hit("a");
    const r = l.hit("a");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSeconds).toBe(7); // the first hit leaves the window 7 s from now
  });

  it("keeps separate counts per IP", () => {
    const c = clock();
    const l = createRateLimiter(1, 1000, c.now);
    expect(l.hit("a").ok).toBe(true);
    expect(l.hit("b").ok).toBe(true);
    expect(l.hit("a").ok).toBe(false);
  });

  it("allows again once the window has passed (sliding, not fixed)", () => {
    const c = clock();
    const l = createRateLimiter(2, 1000, c.now);
    l.hit("a"); // t=0
    c.advance(600);
    l.hit("a"); // t=600
    expect(l.hit("a").ok).toBe(false);
    c.advance(401); // t=1001: the first hit has left the window, the second has not
    expect(l.hit("a").ok).toBe(true);
    expect(l.hit("a").ok).toBe(false);
    c.advance(1000);
    expect(l.hit("a").ok).toBe(true);
  });

  it("blocked requests do not extend the block", () => {
    const c = clock();
    const l = createRateLimiter(1, 1000, c.now);
    l.hit("a");
    for (let i = 0; i < 5; i++) l.hit("a");
    c.advance(1001);
    expect(l.hit("a").ok).toBe(true);
  });
});

describe("client IP", () => {
  it("uses the first x-forwarded-for address", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });
  it("falls back to a constant", () => {
    expect(clientIp(new Headers())).toBe(UNKNOWN_IP);
    expect(clientIp(new Headers({ "x-forwarded-for": " " }))).toBe(UNKNOWN_IP);
  });
});

describe("limits are on except under next dev", () => {
  it("on in production and tests, off in development", () => {
    expect(limitsEnabled("production")).toBe(true);
    expect(limitsEnabled("test")).toBe(true);
    expect(limitsEnabled(undefined)).toBe(true);
    expect(limitsEnabled("development")).toBe(false);
  });
});

describe("429 response", () => {
  it("uses the error shape the client reads, plus Retry-After", async () => {
    const res = rateLimitedResponse(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(await res.json()).toEqual({ success: false, error: { type: APP_RATE_LIMIT_CODE, message: expect.any(String) } });
  });
});

describe("size caps", () => {
  it("audio: up to 2 MB is fine, more is 413", () => {
    expect(MAX_AUDIO_BYTES).toBe(2 * 1024 * 1024);
    expect(audioSizeProblem(960_000)).toBeNull(); // 30 s of 16 kHz mono 16-bit WAV
    expect(audioSizeProblem(MAX_AUDIO_BYTES)).toBeNull();
    expect(audioSizeProblem(MAX_AUDIO_BYTES + 1)).toMatchObject({ status: 413, code: "TOO_LARGE" });
  });

  it("speak text: up to 600 characters is fine, more is 413", () => {
    expect(MAX_SPEAK_CHARS).toBe(600);
    expect(speakTextProblem("a".repeat(600))).toBeNull();
    expect(speakTextProblem("a".repeat(601))).toMatchObject({ status: 413, code: "TOO_LARGE" });
  });

  it("speed must be 0.85–1.15", () => {
    expect(speedProblem(0.85)).toBeNull();
    expect(speedProblem(1)).toBeNull();
    expect(speedProblem(1.15)).toBeNull();
    for (const bad of [0.84, 1.16, 0, 2, Number.NaN]) expect(speedProblem(bad)).toMatchObject({ status: 400 });
  });
});
