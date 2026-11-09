// Naming of the pre-generated Timbre clips shipped in public/audio. A clip is looked up by the language+voice key
// and a hash of the exact spoken text, so a changed sentence simply stops matching (it then goes through the API).
// Pure and shared by the browser player and scripts/make-static-audio.mjs.
export const STATIC_AUDIO_DIR = "/audio";
export const STATIC_MANIFEST = `${STATIC_AUDIO_DIR}/manifest.json`;

/** 32-bit FNV-1a over the UTF-16 code units, as 8 hex digits. */
export function textHash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** key like "hi-1" (language code + voice number: 1 = female voice, 2 = male voice). */
export function staticKeyFor(code: string, gender: "female" | "male"): string {
  return `${code}-${gender === "female" ? 1 : 2}`;
}

export function staticFile(key: string, text: string): string {
  return `${key}-${textHash(text)}.mp3`;
}

export const staticUrl = (file: string) => `${STATIC_AUDIO_DIR}/${file}`;
