import { describe, expect, it } from "vitest";
import { createGnaniClient, GnaniClientError } from "@/lib/gnani/queue";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const rateLimited = () => json({ success: false, error: { type: "RATE_LIMITED", message: "Only 1 active request at a time" } }, 429);
const audio = () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
const wav = new Blob([new Uint8Array(10)], { type: "audio/wav" });

describe("queue: one at a time", () => {
  it("never has two requests in flight", async () => {
    let active = 0;
    let maxActive = 0;
    const order: string[] = [];
    const fetchImpl = (async (url: string) => {
      active++;
      maxActive = Math.max(maxActive, active);
      order.push(String(url));
      await new Promise((r) => setTimeout(r, 15));
      active--;
      return String(url).includes("speak") ? audio() : json({ success: true, transcript: "x" });
    }) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl });
    await Promise.all([c.speak("a"), c.transcribe(wav), c.speak("b"), c.transcribe(wav)]);
    expect(maxActive).toBe(1);
    expect(order).toEqual(["/api/speak", "/api/transcribe", "/api/speak", "/api/transcribe"]);
  });

  it("keeps working after a failed request", async () => {
    let n = 0;
    const fetchImpl = (async () => (++n === 1 ? json({ success: false, error: { type: "bad", message: "no" } }, 400) : json({ success: true, transcript: "ok" }))) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl });
    await expect(c.transcribe(wav)).rejects.toBeInstanceOf(GnaniClientError);
    expect((await c.transcribe(wav)).transcript).toBe("ok");
  });
});

describe("queue: 429 retry with exponential backoff", () => {
  it("retries and then succeeds", async () => {
    let n = 0;
    const delays: number[] = [];
    const fetchImpl = (async () => (++n <= 2 ? rateLimited() : json({ success: true, transcript: "ठीक है", model: "prisma-v3.0" }))) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl, sleep: async (ms) => void delays.push(ms) });
    const r = await c.transcribe(wav);
    expect(r.transcript).toBe("ठीक है");
    expect(r.model).toBe("prisma-v3.0");
    expect(n).toBe(3);
    expect(delays).toEqual([1000, 2000]);
  });

  it("gives up after 4 retries (5 attempts) with RATE_LIMITED", async () => {
    let n = 0;
    const delays: number[] = [];
    const fetchImpl = (async () => (n++, rateLimited())) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl, sleep: async (ms) => void delays.push(ms) });
    await expect(c.transcribe(wav)).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
    expect(n).toBe(5);
    expect(delays).toEqual([1000, 2000, 4000, 8000]);
  });

  it("does not retry other errors (402, 400, 500)", async () => {
    for (const status of [400, 402, 500]) {
      let n = 0;
      const fetchImpl = (async () => (n++, json({ success: false, error: { type: "X", message: "m" } }, status))) as unknown as typeof fetch;
      const c = createGnaniClient({ fetchImpl, sleep: async () => {} });
      await expect(c.speak("hello")).rejects.toMatchObject({ status });
      expect(n).toBe(1);
    }
  });
});

describe("queue: timeout and network errors", () => {
  it("times out without retrying", async () => {
    let n = 0;
    const fetchImpl = ((_u: string, init?: RequestInit) =>
      new Promise((_res, rej) => {
        n++;
        init?.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl, timeoutMs: 30 });
    await expect(c.transcribe(wav)).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(n).toBe(1);
  });

  it("reports a network failure clearly", async () => {
    const fetchImpl = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl });
    await expect(c.speak("x")).rejects.toMatchObject({ code: "NETWORK" });
  });
});

describe("queue: speak cache", () => {
  it("calls Timbre once for repeated identical text", async () => {
    let n = 0;
    const fetchImpl = (async () => (n++, audio())) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl });
    expect(c.isSpeakCached("नमस्ते")).toBe(false);
    const a = await c.speak("नमस्ते");
    const b = await c.speak("नमस्ते");
    expect(n).toBe(1);
    expect(a).toBe(b);
    expect(c.isSpeakCached("नमस्ते")).toBe(true);
  });

  it("treats different text or speed as different prompts", async () => {
    let n = 0;
    const fetchImpl = (async () => (n++, audio())) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl });
    await c.speak("a");
    await c.speak("b");
    await c.speak("a", { speed: 0.85 });
    expect(n).toBe(3);
  });

  it("does not cache failures", async () => {
    let n = 0;
    const fetchImpl = (async () => (++n === 1 ? json({ success: false, error: { type: "X", message: "m" } }, 500) : audio())) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl });
    await expect(c.speak("a")).rejects.toBeInstanceOf(GnaniClientError);
    await c.speak("a");
    expect(n).toBe(2);
  });

  it("an empty transcript is a result, not an error", async () => {
    const fetchImpl = (async () => json({ success: true, transcript: "" })) as unknown as typeof fetch;
    const c = createGnaniClient({ fetchImpl });
    expect((await c.transcribe(wav)).transcript).toBe("");
  });
});
