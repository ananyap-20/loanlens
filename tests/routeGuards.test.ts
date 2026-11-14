// The two API routes refuse oversized or over-limit requests BEFORE any call to Gnani. No network: every request
// here is answered by our own guards (fetch is replaced and must never be called).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST as speak } from "@/app/api/speak/route";
import { POST as transcribe } from "@/app/api/transcribe/route";
import { SPEAK_LIMIT, TRANSCRIBE_LIMIT } from "@/lib/server/rateLimit";

const realFetch = globalThis.fetch;
const realKey = process.env.GNANI_API_KEY;
beforeAll(() => {
  process.env.GNANI_API_KEY = "test-placeholder-not-a-real-key";
  globalThis.fetch = vi.fn(() => {
    throw new Error("must not reach Gnani");
  }) as unknown as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.GNANI_API_KEY;
  else process.env.GNANI_API_KEY = realKey;
});

const speakReq = (body: unknown, ip: string) =>
  new Request("http://localhost/api/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });

describe("/api/speak guards", () => {
  it("413 for text over 600 characters", async () => {
    const res = await speak(speakReq({ text: "a".repeat(601) }, "198.51.100.1"));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ success: false, error: { type: "TOO_LARGE" } });
  });

  it("400 for a speed outside 0.85–1.15", async () => {
    const res = await speak(speakReq({ text: "नमस्ते", speed: 1.5 }, "198.51.100.2"));
    expect(res.status).toBe(400);
  });

  it(`429 with Retry-After after ${SPEAK_LIMIT} requests from one IP`, async () => {
    const ip = "198.51.100.3";
    for (let i = 0; i < SPEAK_LIMIT; i++) expect((await speak(speakReq({ text: "" }, ip))).status).toBe(400);
    const res = await speak(speakReq({ text: "" }, ip));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await res.json()).toMatchObject({ success: false, error: { type: "APP_RATE_LIMIT" } });
    expect((await speak(speakReq({ text: "" }, "198.51.100.4"))).status).toBe(400); // another IP is unaffected
  });
});

describe("/api/transcribe guards", () => {
  it("413 for an audio file over 2 MB", async () => {
    const fd = new FormData();
    fd.append("audio_file", new File([new Uint8Array(2 * 1024 * 1024 + 1)], "clip.wav", { type: "audio/wav" }));
    const res = await transcribe(new Request("http://localhost/api/transcribe", { method: "POST", body: fd, headers: { "x-forwarded-for": "198.51.100.10" } }));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ success: false, error: { type: "TOO_LARGE" } });
  });

  it("413 from the declared size, before reading the body", async () => {
    const res = await transcribe(
      new Request("http://localhost/api/transcribe", { method: "POST", body: "x", headers: { "content-length": String(10 * 1024 * 1024), "x-forwarded-for": "198.51.100.11" } }),
    );
    expect(res.status).toBe(413);
  });

  it(`429 after ${TRANSCRIBE_LIMIT} requests from one IP`, async () => {
    const ip = "198.51.100.12";
    const req = () => new Request("http://localhost/api/transcribe", { method: "POST", body: new FormData(), headers: { "x-forwarded-for": ip } });
    for (let i = 0; i < TRANSCRIBE_LIMIT; i++) expect((await transcribe(req())).status).toBe(400); // missing audio_file
    const res = await transcribe(req());
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("never called Gnani", () => {
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
