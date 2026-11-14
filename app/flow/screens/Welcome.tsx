"use client";

import { useEffect, useRef, useState } from "react";
import { unlockAudio } from "@/lib/audio/voice";
import { getPack, PACKS, voiceFor } from "@/lib/i18n";
import { langStatus } from "@/lib/i18n/status";
import { applyVoice, useLang } from "../lang";
import { useSpeech } from "../speech";
import { Brand, focusRing, primary, ReplayButtons } from "../ui";

// Language + voice + start, and nothing else: the logo, one heading, the ready languages as big cards, the
// languages still being prepared as one quiet row, two voice buttons and one big Start. The disclaimer is one
// tap away behind the small information button. Each selectable language speaks a short line in that language;
// a language without a finished wording pack is listed but cannot be selected (nothing ever falls back to
// another language's words). Any tap here also unlocks audio for the session.
// Reached from the splash tap (`afterSplash` set): once the splash line has finished (or failed), speak the
// language instruction once, unless the person already tapped something here.
export function Welcome({ afterSplash, onStart }: { afterSplash: Promise<boolean> | null; onStart: () => void }) {
  const { pack, gender, setLang, setGender } = useLang();
  const { say, error } = useSpeech();
  const touched = useRef(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const instruction = pack.say.chooseLang;
  useEffect(() => {
    if (!afterSplash) return;
    let live = true;
    void afterSplash.then(() => {
      if (live && !touched.current) void say(instruction);
    });
    return () => {
      live = false;
    };
  }, [afterSplash, instruction, say]);
  const canMale = !!pack.timbre.voices.male;
  const canFemale = !!pack.timbre.voices.female;
  const all = Object.values(PACKS);
  const isReady = (p: (typeof all)[number]) => p.verified && !!p.say && !!p.ui;
  const ready = all.filter(isReady);
  const soon = all.filter((p) => !isReady(p));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col bg-cream px-5 pt-5 text-ink">
      <header className="flex items-center justify-between">
        <Brand variant="mark" className="h-12 w-auto" />
        <ReplayButtons compact text={instruction} onTap={() => (touched.current = true)} />
      </header>

      <div className="flex flex-1 flex-col gap-6 pt-8">
        <h1 className="text-2xl font-semibold">🗣️ {pack.ui.chooseLanguage}</h1>

        {error && (
          <p className="w-full rounded-chip border border-conflict/30 bg-conflict-soft p-3 text-lg text-conflict" role="alert">
            {pack.ui.audioFailed.replace("{error}", error)}
          </p>
        )}

        <section className="flex flex-col gap-3" aria-label="language">
          {ready.map((p) => {
            const selected = p.code === pack.code;
            const review = langStatus(p.code) === "review";
            return (
              <button
                key={p.code}
                lang={p.code}
                aria-pressed={selected}
                aria-label={review ? `${p.name} — ${pack.ui.reviewTag}` : p.name}
                className={`press flex min-h-16 items-center justify-between rounded-btn border-2 px-5 py-2 text-left text-xl font-semibold ${focusRing} ${
                  selected ? "border-primary bg-primary text-white" : "border-line bg-surface"
                }`}
                onClick={() => {
                  touched.current = true;
                  unlockAudio();
                  setLang(p.code);
                  applyVoice(getPack(p.code), voiceFor(getPack(p.code), gender).gender); // before speaking the greeting
                  void say(p.greeting);
                }}
              >
                <span className="flex flex-col leading-tight">
                  {p.name}
                  {review && <span className={`text-sm font-normal ${selected ? "text-white/90" : "text-muted"}`}>{pack.ui.reviewTag}</span>}
                </span>
                <span aria-hidden="true" className="text-2xl">
                  {selected ? "✓" : ""}
                </span>
              </button>
            );
          })}

          {/* languages still being prepared: visible (the app is for everyone) but quiet, and not tappable */}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-base text-muted">
            <span className="rounded bg-sand px-2 text-sm font-semibold">{pack.ui.betaTag}</span>
            {soon.map((p) => (
              <span key={p.code} lang={p.code}>
                {p.name}
              </span>
            ))}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-3" aria-label="voice">
          {(["female", "male"] as const).map((g) => {
            const available = g === "female" ? canFemale : canMale;
            return (
              <button
                key={g}
                disabled={!available}
                aria-pressed={gender === g}
                className={`press min-h-14 rounded-chip border-2 px-2 text-base font-semibold disabled:opacity-40 ${focusRing} ${gender === g ? "border-primary bg-primary/10" : "border-line bg-surface"}`}
                onClick={() => {
                  touched.current = true;
                  unlockAudio();
                  setGender(g);
                  applyVoice(pack, g);
                  void say(pack.greeting);
                }}
              >
                {g === "female" ? pack.ui.female : pack.ui.male}
              </button>
            );
          })}
        </div>
      </div>

      <footer className="sticky bottom-0 -mx-5 flex flex-col gap-2 bg-cream/95 px-5 pb-4 pt-3">
        {infoOpen && (
          <p id="welcome-info" className="rounded-chip bg-sand p-3 text-base leading-snug text-ink">
            {pack.ui.disclaimer}
          </p>
        )}
        <button
          className={`${primary} min-h-20 text-3xl`}
          onClick={() => {
            touched.current = true;
            unlockAudio();
            onStart();
          }}
        >
          {pack.ui.start}
        </button>
        <button
          aria-expanded={infoOpen}
          aria-controls="welcome-info"
          className={`mx-auto flex min-h-14 items-center gap-2 rounded-chip px-4 text-base font-semibold text-muted ${focusRing}`}
          onClick={() => setInfoOpen((o) => !o)}
        >
          <span aria-hidden="true">ⓘ</span>
          {pack.ui.info}
        </button>
      </footer>
    </main>
  );
}
