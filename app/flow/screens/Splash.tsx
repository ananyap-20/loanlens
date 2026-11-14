"use client";

/* eslint-disable @next/next/no-img-element -- a small static SVG; next/image adds nothing here */
import { unlockAudio } from "@/lib/audio/voice";
import { getPack } from "@/lib/i18n";
import { useLang } from "../lang";
import { useSpeech } from "../speech";
import { primary } from "../ui";

/**
 * The splash tap: unlock audio FIRST (browsers block audio until a tap), then start the spoken welcome,
 * then move on at once. The speech promise is handed on so the next screen can wait for it to finish.
 */
export function splashTap(say: (text: string) => Promise<boolean>, text: string, onStart: (spoken: Promise<boolean>) => void) {
  unlockAudio();
  onStart(say(text));
}

// Shown once per page load, before the language screen. Nothing plays until the tap.
export function Splash({ onStart }: { onStart: (spoken: Promise<boolean>) => void }) {
  const { pack } = useLang();
  const { say } = useSpeech();
  const line = getPack("hi").say.splash; // on-screen: always the Hindi line + the English line
  const english = getPack("en").say.splash;
  const spoken = pack.say.splash; // spoken: the current pack (Hindi unless a language was saved this session)

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 bg-cream px-5 py-8 text-center text-ink">
      <img src="/arth-logo.svg" alt="Arth" className="fade-in aspect-square w-[60%] max-w-[280px]" />
      <div className="flex flex-col gap-2">
        <p lang="hi" className="text-3xl font-semibold leading-snug">
          {line}
        </p>
        <p lang="en" className="text-base text-muted">
          {english}
        </p>
      </div>
      <button className={`${primary} min-h-16 text-2xl`} onClick={() => splashTap(say, spoken, onStart)}>
        <span lang="hi">शुरू करें</span>
        <span aria-hidden="true">→</span>
      </button>
    </main>
  );
}
