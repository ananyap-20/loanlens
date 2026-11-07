import { describe, expect, it } from "vitest";
import { normaliseGnaniError } from "@/lib/gnani/errors";
import { safeAudioFilename } from "@/lib/gnani/server";

describe("normaliseGnaniError", () => {
  it("handles STT shape", () => {
    const e = normaliseGnaniError(400, { success: false, error: { type: "invalid_audio", message: "bad file" } });
    expect(e).toEqual({ status: 400, code: "invalid_audio", message: "bad file" });
  });
  it("handles TTS shape", () => {
    const e = normaliseGnaniError(400, { success: false, message: "bad voice", status_code: 400 });
    expect(e.status).toBe(400);
    expect(e.message).toBe("bad voice");
  });
  it("handles detail shape (rate limit)", () => {
    const e = normaliseGnaniError(429, { detail: { error_code: "RATE_LIMITED", message: "slow down", status_code: 429 } });
    expect(e).toEqual({ status: 429, code: "RATE_LIMITED", message: "slow down" });
  });
  it("falls back to default codes", () => {
    expect(normaliseGnaniError(402, null).code).toBe("NO_CREDIT");
    expect(normaliseGnaniError(401, "x").code).toBe("UNAUTHORIZED");
  });
  it("never returns a success status for an error", () => {
    expect(normaliseGnaniError(200, { success: false, message: "oops" }).status).toBe(502);
  });
});

describe("safeAudioFilename", () => {
  it("keeps real extension", () => {
    expect(safeAudioFilename("a.MP3")).toBe("clip.mp3");
    expect(safeAudioFilename("x.m4a")).toBe("clip.m4a");
    expect(safeAudioFilename("clip.wav")).toBe("clip.wav");
  });
  it("defaults to wav for unknown or missing", () => {
    expect(safeAudioFilename("x.webm")).toBe("clip.wav");
    expect(safeAudioFilename(undefined)).toBe("clip.wav");
    expect(safeAudioFilename("../../etc/passwd")).toBe("clip.wav");
  });
});
