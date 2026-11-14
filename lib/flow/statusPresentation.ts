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
  cls: string; // badge colour classes
  cue: Cue;
};

const MATCH: StatusPresentation = { icon: "✅", tone: "match", cls: "bg-green-100 text-green-900 border-green-600", cue: "chime" };
const CONFLICT: StatusPresentation = { icon: "❌", tone: "conflict", cls: "bg-red-100 text-red-900 border-red-600", cue: "buzz" };
const UNKNOWN: StatusPresentation = { icon: "❔", tone: "unknown", cls: "bg-gray-100 text-gray-800 border-gray-400", cue: "tick" };

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
