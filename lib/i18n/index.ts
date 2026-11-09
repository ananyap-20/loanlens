// Language packs. Hindi is the default; only verified packs appear in the picker.
import { en } from "./packs/en";
import { hi } from "./packs/hi";
import { mr } from "./packs/mr";
import { bn } from "./packs/bn";
import { gu } from "./packs/gu";
import { kn } from "./packs/kn";
import { ml } from "./packs/ml";
import { pa } from "./packs/pa";
import { ta } from "./packs/ta";
import { te } from "./packs/te";
import type { LangCode, LangPack, VoiceGender } from "./types";

export type { LangCode, LangPack, VoiceGender } from "./types";

export const PACKS: Record<LangCode, LangPack> = { hi, en, mr, bn, gu, kn, ml, pa, ta, te };

/** Packs a user can pick (verified and complete). */
export function visiblePacks(): LangPack[] {
  return Object.values(PACKS).filter((p) => p.verified && p.say && p.ui && p.receipt);
}

/** A usable pack: unknown or unverified codes fall back to Hindi. */
export function getPack(code: string | null | undefined): LangPack & { say: NonNullable<LangPack["say"]>; ui: NonNullable<LangPack["ui"]> } {
  const p = code ? PACKS[code as LangCode] : undefined;
  const ok = p && p.verified && p.say && p.ui && p.receipt ? p : hi;
  return ok as LangPack & { say: NonNullable<LangPack["say"]>; ui: NonNullable<LangPack["ui"]> };
}

/** The Timbre voice for a gender, falling back to the pack's other voice when one gender is not offered. */
export function voiceFor(pack: LangPack, gender: VoiceGender): { voice: string; gender: VoiceGender } {
  const v = pack.timbre.voices[gender];
  if (v) return { voice: v, gender };
  const other: VoiceGender = gender === "female" ? "male" : "female";
  return { voice: pack.timbre.voices[other]!, gender: other };
}
