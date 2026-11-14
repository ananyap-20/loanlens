"use client";

import { useEffect, useRef } from "react";
import { unlockAudio } from "@/lib/audio/voice";
import { getPack, PACKS, voiceFor } from "@/lib/i18n";
import { langStatus } from "@/lib/i18n/status";
import { applyVoice, useLang } from "../lang";
import { useSpeech } from "../speech";
import { focusRing, primary, ReplayButtons } from "../ui";

// Language picker + voice (Voice 1 / Voice 2) + start. Each selectable language speaks a short line in that
// language. Languages without a finished wording pack are listed with a "Beta" tag but cannot be selected
// (nothing ever falls back to another language's words). Any tap here also unlocks audio for the session.
// Reached from the splash tap (`afterSplash` set): once the splash line has finished (or failed), speak the
// language instruction once — unless the person already tapped something here.
export function Welcome({ afterSplash, onStart }: { afterSplash: Promise<boolean> | null; onStart: () => void }) {
  const { pack, gender, setLang, setGender } = useLang();
  const { say, error } = useSpeech();
  const touched = useRef(false);
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
  const status = langStatus(pack.code);
  const tagText = (s: ReturnType<typeof langStatus>) => (s === "beta" ? pack.ui.betaTag : s === "review" ? pack.ui.reviewTag : "");

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-4 bg-cream px-5 pb-4 pt-4 text-center text-ink">
      <ReplayButtons text={instruction} className="absolute right-5 top-4" onTap={() => (touched.current = true)} />
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 pt-20">
        <h1 className="flex items-baseline gap-3">
          <span lang="en" className="flex items-baseline text-5xl font-semibold tracking-tight">
            Arth
            <span aria-hidden="true" className="ml-1 inline-block h-2.5 w-2.5 rounded-full bg-saffron" />
          </span>
          <span lang="hi" className="text-4xl font-semibold text-muted">अर्थ</span>
        </h1>
        <p className="text-lg font-semibold leading-snug">Arth: know what it means before you sign.</p>
        <p className="text-sm text-muted">Arth, from the Sanskrit artha: meaning, and wealth.</p>
        {/* decorative: the name in four scripts; not interactive and never spoken */}
        <p aria-hidden="true" className="text-base tracking-wide text-muted">
          <span lang="hi">अर्थ</span> · <span lang="sa">अर्थम्</span> · <span lang="bn">অর্থ</span> · <span lang="gu">અર્થ</span>
        </p>
        <p className="text-sm text-muted">Proof of understanding, alongside the signature.</p>
        {error && (
          <p className="w-full rounded-chip border border-conflict/30 bg-conflict-soft p-3 text-lg text-conflict" role="alert">
            {pack.ui.audioFailed.replace("{error}", error)}
          </p>
        )}

        <section className="mt-2 flex w-full flex-col gap-3" aria-label="language">
          <p className="text-base font-semibold">🗣️ {pack.ui.chooseLanguage}</p>
          <div className="grid grid-cols-5 gap-1">
            {Object.values(PACKS).map((p) => {
              const ready = p.verified && !!p.say && !!p.ui;
              const s = langStatus(p.code);
              const selected = p.code === pack.code;
              const tag = tagText(s);
              return (
                <button
                  key={p.code}
                  lang={p.code}
                  disabled={!ready}
                  aria-pressed={selected}
                  aria-label={ready ? `${p.name}${tag ? ` — ${tag}` : ""}` : `${p.name} — ${pack.ui.betaTag}, ${pack.ui.notReady}`}
                  className={`flex min-h-14 flex-col items-center justify-center rounded-chip border-2 px-0 py-1 text-xs font-semibold leading-tight disabled:cursor-not-allowed disabled:bg-sand disabled:text-muted ${focusRing} ${
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
                  <span className="max-w-full overflow-hidden">{p.name}</span>
                  {tag && (
                    <span className={`mt-0.5 rounded px-1 text-[9px] font-bold leading-tight ${selected ? "bg-white/25 text-white" : "bg-amber-200 text-amber-900"}`}>
                      {tag}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {status !== "stable" && (
            <p className="rounded-chip bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900" role="status">
              {pack.name}: {tagText(status)}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2" aria-label="voice">
            {(["female", "male"] as const).map((g) => {
              const available = g === "female" ? canFemale : canMale;
              return (
                <button
                  key={g}
                  disabled={!available}
                  aria-pressed={gender === g}
                  className={`min-h-14 rounded-chip border-2 px-2 text-base font-semibold disabled:opacity-40 ${focusRing} ${gender === g ? "border-primary bg-primary/10" : "border-line bg-surface"}`}
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
        </section>

        <button
          className={`${primary} mt-2 min-h-20 text-3xl`}
          onClick={() => {
            touched.current = true;
            unlockAudio();
            onStart();
          }}
        >
          {pack.ui.start}
        </button>
      </div>

      <p className="sticky bottom-0 w-full bg-cream/95 pt-2 text-[10px] leading-tight text-muted" aria-label="disclaimer">
        {pack.ui.disclaimer}
      </p>
    </main>
  );
}
