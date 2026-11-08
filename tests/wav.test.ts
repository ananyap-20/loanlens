import { describe, expect, it } from "vitest";
import { encodePcm16Wav, mergeChunks, resample, samplesToWavBlob, TARGET_RATE } from "@/lib/audio/wav";

function sine(rate: number, seconds: number, hz = 440): Float32Array {
  const out = new Float32Array(Math.floor(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = 0.5 * Math.sin((2 * Math.PI * hz * i) / rate);
  return out;
}

const str = (v: DataView, off: number, n: number) =>
  Array.from({ length: n }, (_, i) => String.fromCharCode(v.getUint8(off + i))).join("");

describe("encodePcm16Wav", () => {
  it("writes a valid 16 kHz mono 16-bit PCM header", () => {
    const wav = encodePcm16Wav(new Float32Array(1600), 16000); // 0.1 s
    const v = new DataView(wav);
    expect(str(v, 0, 4)).toBe("RIFF");
    expect(str(v, 8, 4)).toBe("WAVE");
    expect(str(v, 12, 4)).toBe("fmt ");
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(28, true)).toBe(32000); // byte rate
    expect(v.getUint16(32, true)).toBe(2);
    expect(v.getUint16(34, true)).toBe(16);
    expect(str(v, 36, 4)).toBe("data");
    expect(v.getUint32(40, true)).toBe(3200);
    expect(v.getUint32(4, true)).toBe(wav.byteLength - 8);
    expect(wav.byteLength).toBe(44 + 3200);
  });

  it("converts and clips samples", () => {
    const v = new DataView(encodePcm16Wav(Float32Array.from([0, 1, -1, 2, -2, 0.5]), 16000));
    const s = (i: number) => v.getInt16(44 + i * 2, true);
    expect(s(0)).toBe(0);
    expect(s(1)).toBe(32767);
    expect(s(2)).toBe(-32768);
    expect(s(3)).toBe(32767); // clipped
    expect(s(4)).toBe(-32768); // clipped
    expect(Math.abs(s(5) - 16383)).toBeLessThanOrEqual(1); // roughly half scale
  });

  it("handles empty input", () => {
    expect(encodePcm16Wav(new Float32Array(0)).byteLength).toBe(44);
  });
});

describe("resample", () => {
  it("48 kHz -> 16 kHz gives one third of the samples", () => {
    expect(resample(sine(48000, 1), 48000, TARGET_RATE).length).toBe(16000);
  });
  it("44.1 kHz -> 16 kHz gives the right duration", () => {
    const out = resample(sine(44100, 2), 44100, TARGET_RATE);
    expect(Math.abs(out.length - 32000)).toBeLessThanOrEqual(1);
  });
  it("same rate returns a copy", () => {
    const a = sine(16000, 0.1);
    const b = resample(a, 16000);
    expect(b).not.toBe(a);
    expect(Array.from(b)).toEqual(Array.from(a));
  });
  it("8 kHz -> 16 kHz upsamples", () => {
    expect(resample(sine(8000, 1), 8000, TARGET_RATE).length).toBe(16000);
  });
  it("keeps a low-frequency tone's amplitude when downsampling", () => {
    const out = resample(sine(48000, 0.5, 200), 48000);
    const peak = out.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(peak).toBeGreaterThan(0.45);
    expect(peak).toBeLessThanOrEqual(0.5 + 1e-6);
  });
  it("rejects invalid rates", () => {
    expect(() => resample(new Float32Array(1), 0, 16000)).toThrow();
  });
});

describe("mergeChunks / samplesToWavBlob", () => {
  it("merges in order", () => {
    const m = mergeChunks([Float32Array.from([1, 2]), Float32Array.from([3]), new Float32Array(0), Float32Array.from([4, 5])]);
    expect(Array.from(m)).toEqual([1, 2, 3, 4, 5]);
  });
  it("produces a wav Blob of the expected size from 48 kHz capture", async () => {
    const blob = samplesToWavBlob(sine(48000, 2), 48000);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(44 + 32000 * 2);
    const v = new DataView(await blob.arrayBuffer());
    expect(v.getUint32(24, true)).toBe(16000);
  });
});
