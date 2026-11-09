"use client";

import type { Presence } from "@/lib/flow/session";
import { SAY } from "@/lib/flow/scripts";
import { primary, Screen } from "../ui";

export function Who({ dots, onPick }: { dots: { total: number; current: number }; onPick: (p: Presence) => void }) {
  return (
    <Screen instruction={SAY.who} dots={dots}>
      <button aria-label="सिर्फ़ मैं — just me" className={`${primary} min-h-32 flex-col`} onClick={() => onPick("alone")}>
        <span className="text-6xl">👩</span>
        <span>1 · सिर्फ़ मैं</span>
      </button>
      <button
        aria-label="मैं और एजेंट — me and the agent"
        className={`${primary} min-h-32 flex-col bg-indigo-600`}
        onClick={() => onPick("with_agent")}
      >
        <span className="text-6xl">👩 🧑‍💼</span>
        <span>2 · मैं + एजेंट</span>
      </button>
    </Screen>
  );
}
