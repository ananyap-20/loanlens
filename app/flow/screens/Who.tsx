"use client";

import { useEffect } from "react";
import { prefetchSpeech } from "@/lib/audio/voice";
import type { Presence } from "@/lib/flow/session";
import { useLang } from "../lang";
import { bigBtn, primary, Screen } from "../ui";

export function Who({ dots, onPick }: { dots: { total: number; current: number }; onPick: (p: Presence) => void }) {
  const { say, ui } = useLang().pack;
  useEffect(() => prefetchSpeech(say.paper), [say]);
  return (
    <Screen instruction={say.who} dots={dots}>
      <button aria-label={ui.aloneAria} className={`${primary} min-h-32 flex-col`} onClick={() => onPick("alone")}>
        <span className="text-6xl">🧑</span>
        <span>{ui.alone}</span>
      </button>
      <button aria-label={ui.withAgentAria} className={`${bigBtn} min-h-32 flex-col bg-ink text-white`} onClick={() => onPick("with_agent")}>
        <span className="text-6xl">🧑 🧑‍💼</span>
        <span>{ui.withAgent}</span>
      </button>
    </Screen>
  );
}
