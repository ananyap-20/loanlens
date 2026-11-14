"use client";

import { useEffect, useState } from "react";
import { unlockAudio } from "@/lib/audio/voice";
import { PACKS } from "@/lib/i18n";
import type { LangCode } from "@/lib/i18n/types";
import { useLang } from "../lang";
import { useSpeech } from "../speech";
import { Brand, primary } from "../ui";

/**
 * The splash tap: unlock audio FIRST (browsers block audio until a tap), then start the spoken welcome,
 * then move on at once. The speech promise is handed on so the next screen can wait for it to finish.
 */
export function splashTap(say: (text: string) => Promise<boolean>, text: string, onStart: (spoken: Promise<boolean>) => void) {
  unlockAudio();
  onStart(say(text));
}

/** The greeting in every language that has a finished wording pack (never the Beta stubs), Hindi first. */
export function splashGreetings(): { code: LangCode; text: string }[] {
  const order: LangCode[] = ["hi", "en", "mr"];
  return order.flatMap((code) => {
    const p = PACKS[code];
    return p.verified && p.say && p.ui ? [{ code, text: p.say.splash }] : [];
  });
}

const GREETING_MS = 2600;

// Shown once per page load, before the language screen. Nothing plays until the tap.
// Just the logo, a greeting that fades through the ready languages, and one arrow button.
export function Splash({ onStart }: { onStart: (spoken: Promise<boolean>) => void }) {
  const { pack } = useLang();
  const { say } = useSpeech();
  const greetings = splashGreetings();
  const [i, setI] = useState(0);

  // Rotate the greeting, unless the person asked their device for reduced motion (then the first one stays).
  useEffect(() => {
    if (greetings.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % greetings.length), GREETING_MS);
    return () => window.clearInterval(id);
  }, [greetings.length]);

  const g = greetings[i % greetings.length];
  const spoken = pack.say.splash; // spoken: the current pack (Hindi unless a language was saved this session)

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-between bg-cream px-6 pb-10 pt-16 text-center text-ink">
      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <Brand variant="logo" className="fade-in w-[62%] max-w-[260px]" />
        {/* decorative rotation: the spoken line is what carries the meaning, so screen readers skip this */}
        <p key={g.code} lang={g.code} aria-hidden="true" className="fade-in min-h-[2.75rem] text-2xl font-semibold leading-snug">
          {g.text}
        </p>
      </div>
      <button aria-label={pack.ui.start} className={`${primary} min-h-20 text-4xl`} onClick={() => splashTap(say, spoken, onStart)}>
        <span aria-hidden="true">→</span>
      </button>
    </main>
  );
}
