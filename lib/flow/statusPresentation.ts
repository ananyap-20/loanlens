// The ONE place a comparison status becomes what the person sees and hears. Pure, no AI.
// Icon, colour and sound come only from the engine's Status, so a conflict can never look or sound like a match.
//   match            -> ✅ green + chime
//   conflict         -> ❌ red + buzz
//   not_mentioned /
//   unable_to_verify -> ❔ grey + soft tick (never the chime)
// Never colour alone: every status always has its icon and its sound.
import type { Status } from "@/lib/engine/types";

export type Cue = "chime" | "buzz" | "tick";
export type StatusTone = "match" | "conflict" | "unknown";

export type StatusPresentation = {
  icon: "✅" | "❌" | "❔";
  tone: StatusTone;
  cls: string; // badge colour classes (soft tint + status text + status border)
  stripe: string; // 6px left stripe on a card, in the status colour
  soft: string; // the soft tinted background alone
  cue: Cue;
};

// Colour tokens are defined in app/globals.css (match green, conflict red, unknown slate).
const MATCH: StatusPresentation = {
  icon: "✅",
  tone: "match",
  cls: "bg-match-soft text-match border-match",
  stripe: "border-l-[6px] border-l-match",
  soft: "bg-match-soft",
  cue: "chime",
};
const CONFLICT: StatusPresentation = {
  icon: "❌",
  tone: "conflict",
  cls: "bg-conflict-soft text-conflict border-conflict",
  stripe: "border-l-[6px] border-l-conflict",
  soft: "bg-conflict-soft",
  cue: "buzz",
};
const UNKNOWN: StatusPresentation = {
  icon: "❔",
  tone: "unknown",
  cls: "bg-unknown-soft text-unknown-ink border-unknown",
  stripe: "border-l-[6px] border-l-unknown",
  soft: "bg-unknown-soft",
  cue: "tick",
};

export function statusPresentation(status: Status): StatusPresentation {
  switch (status) {
    case "match":
      return MATCH;
    case "conflict":
      return CONFLICT;
    case "not_mentioned":
    case "unable_to_verify":
      return UNKNOWN;
    default:
      return UNKNOWN; // anything unexpected is shown as "couldn't check", never as a match
  }
}
