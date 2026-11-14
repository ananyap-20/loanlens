// What our two Gnani routes will forward. Anything else is refused with 400 before Gnani is called, so a stranger
// cannot use our key for models, voices or languages the app never uses. Voices and languages come from the
// language packs, so adding a pack updates these lists automatically.
import { PACKS } from "@/lib/i18n";

const packs = Object.values(PACKS);

/** Timbre: the app and the clip scripts only use v2.5. */
export const TIMBRE_MODELS: ReadonlySet<string> = new Set(["timbre-v2.5"]);
export const TIMBRE_VOICES: ReadonlySet<string> = new Set(
  packs.flatMap((p) => Object.values(p.timbre.voices).filter((v): v is string => typeof v === "string")),
);
export const TIMBRE_LANGUAGES: ReadonlySet<string> = new Set(packs.map((p) => p.timbre.language));

/** Prisma: v3.0, or "" = the documented v2.5 fallback (CLAUDE.md section 4). Only the transcribe format. */
export const PRISMA_MODELS: ReadonlySet<string> = new Set(["prisma-v3.0", ""]);
export const PRISMA_FORMATS: ReadonlySet<string> = new Set(["transcribe"]);
export const PRISMA_LANGUAGES: ReadonlySet<string> = new Set(packs.map((p) => p.prisma.language_code));

/** null = allowed, otherwise the 400 message naming the refused field. */
export function notAllowed(field: string, value: string, allowed: ReadonlySet<string>): string | null {
  return allowed.has(value) ? null : `${field} not supported.`;
}
