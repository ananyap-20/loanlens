"use client";

// Full-screen HANDOVER before every change of speaker: big avatar, colour, spoken line, short vibration,
// and one big "I am ready ▶" button.
import { useEffect } from "react";
import { prefetchSpeech } from "@/lib/audio/voice";
import { useLang } from "../lang";
import { bigBtn, Screen, SPEAKER_THEME } from "../ui";

export function Handover({
  speaker,
  next, // the first prompt of the next screen: fetched now so it starts at once after the tap
  onReady,
}: {
  speaker: "agent" | "borrower";
  next?: string;
  onReady: () => void;
}) {
  const { say, ui } = useLang().pack;
  const t = SPEAKER_THEME[speaker];
  useEffect(() => {
    try {
      navigator.vibrate?.(200);
    } catch {
      /* vibration not supported */
    }
    if (next) prefetchSpeech(next);
  }, [next]);

  return (
    <Screen instruction={say.handover[speaker]} speaker={speaker}>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <span className={`flex h-44 w-44 items-center justify-center rounded-full text-8xl text-white shadow-xl ${t.banner}`} aria-hidden>
          {t.icon}
        </span>
        <h1 className="text-3xl font-extrabold">
          {t.icon} {ui.handoverTitle[speaker]}
        </h1>
        <p className="text-2xl font-bold">{ui.role[speaker]}</p>
        <button className={`${bigBtn} min-h-28 text-3xl text-white ${t.button}`} onClick={onReady}>
          {ui.ready}
        </button>
      </div>
    </Screen>
  );
}
