// Pure audio helpers: float samples -> 16 kHz mono 16-bit PCM WAV (what Prisma accepts).
// No browser APIs here, so everything is unit-testable in Node.

export const TARGET_RATE = 16000;

export function mergeChunks(chunks: Float32Array[]): Float32Array {
  let total = 0;
  for (const c of chunks) total += c.length;
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

/** Downsample by averaging (box filter, limits aliasing); upsample by linear interpolation. */
export function resample(samples: Float32Array, fromRate: number, toRate: number = TARGET_RATE): Float32Array {
  if (fromRate <= 0 || toRate <= 0) throw new Error("Invalid sample rate");
  if (fromRate === toRate) return samples.slice();
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);

  if (ratio > 1) {
    for (let i = 0; i < outLen; i++) {
      const start = i * ratio;
      const end = Math.min((i + 1) * ratio, samples.length);
      let sum = 0;
      let weight = 0;
      for (let j = Math.floor(start); j < Math.ceil(end); j++) {
        const w = Math.min(j + 1, end) - Math.max(j, start);
        sum += samples[j] * w;
        weight += w;
      }
      out[i] = weight > 0 ? sum / weight : 0;
    }
  } else {
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, samples.length - 1);
      const frac = pos - i0;
      out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
    }
  }
  return out;
}

/** 44-byte RIFF/WAVE header + 16-bit little-endian mono PCM. Input must already be at `sampleRate`. */
export function encodePcm16Wav(samples: Float32Array, sampleRate: number = TARGET_RATE): ArrayBuffer {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** Captured float samples at any rate -> 16 kHz mono 16-bit WAV Blob. */
export function samplesToWavBlob(samples: Float32Array, capturedRate: number): Blob {
  const at16k = resample(samples, capturedRate, TARGET_RATE);
  return new Blob([encodePcm16Wav(at16k, TARGET_RATE)], { type: "audio/wav" });
}
