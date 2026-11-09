// Review status of each language, shown as a tag in the picker and on the Welcome screen.
//  - "beta":   Gnani marks it beta/preview/experimental (GNANI_BETA) OR our wording pack is not built/reviewed yet
//  - "review": a working pack exists but its wording is still under review by a native speaker
//  - "stable": no tag
// docs.gnani.ai was re-read on 2026-11-10 (Prisma v3.0, Timbre v2.5 voices, LiveKit plugin, API introduction):
// none of them marks any individual language as beta, preview or experimental, so GNANI_BETA is empty.
import type { LangCode } from "./types";

export type LangStatus = "stable" | "review" | "beta";

export const GNANI_BETA: readonly LangCode[] = [];

const OURS: Record<LangCode, LangStatus> = {
  hi: "stable",
  en: "stable",
  mr: "review", // Marathi works, but the docs do not say it is verified and no native speaker has signed off yet
  bn: "beta",
  gu: "beta",
  kn: "beta",
  ml: "beta",
  pa: "beta",
  ta: "beta",
  te: "beta",
};

export function langStatus(code: LangCode): LangStatus {
  return GNANI_BETA.includes(code) ? "beta" : OURS[code];
}
