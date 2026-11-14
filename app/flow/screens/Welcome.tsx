"use client";

import { unlockAudio } from "@/lib/audio/voice";
import { getPack, PACKS, voiceFor } from "@/lib/i18n";
import { langStatus } from "@/lib/i18n/status";
import { applyVoice, useLang } from "../lang";
import { useSpeech } from "../speech";
import { primary, ReplayButtons } from "../ui";

// Language picker + voice (Voice 1 / Voice 2) + start. Each selectable language speaks a short line in that
// language. Languages without a finished wording pack are listed with a "Beta" tag but cannot be selected
// (nothing ever falls back to another language's words). Any tap here also unlocks audio for the session.
export function Welcome({ onStart }: { onStart: () => void }) {
  const { pack, gender, setLang, setGender } = useLang();
  const { say } = useSpeech();
  const canMale = !!pack.timbre.voices.male;
  const canFemale = !!pack.timbre.voices.female;
  const status = langStatus(pack.code);
  const tagText = (s: ReturnType<typeof langStatus>) => (s === "beta" ? pack.ui.betaTag : s === "review" ? pack.ui.reviewTag : "");

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-3 bg-white p-3 text-center text-gray-900">
      <ReplayButtons text={pack.greeting} className="absolute right-3 top-3" />
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="h-16 w-16 rounded-2xl shadow-lg" />
        <h1 className="flex items-baseline gap-3">
          <span lang="en" className="text-4xl font-extrabold">Arth</span>
          <span lang="hi" className="text-3xl font-bold">अर्थ</span>
        </h1>
        <p className="text-base font-semibold">Arth: know what it means before you sign.</p>
        <p className="text-xs text-gray-600">Arth, from the Sanskrit artha: meaning, and wealth.</p>
        {/* decorative: the name in four scripts; not interactive and never spoken */}
        <p aria-hidden="true" className="text-sm text-gray-500">
          <span lang="hi">अर्थ</span> · <span lang="sa">अर्थम्</span> · <span lang="bn">অর্থ</span> · <span lang="gu">અર્થ</span>
        </p>
        <p className="text-sm text-gray-600">Proof of understanding, alongside the signature.</p>

        <section className="flex w-full flex-col gap-2" aria-label="language">
          <p className="text-base font-bold">🗣️ {pack.ui.chooseLanguage}</p>
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
                  className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 px-0 py-1 text-[11px] font-bold leading-tight disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 ${
                    selected ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"
                  }`}
                  onClick={() => {
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
            <p className="rounded-lg bg-amber-50 p-1 text-xs font-semibold text-amber-900" role="status">
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
                  className={`min-h-12 rounded-xl border-2 px-2 text-base font-bold disabled:opacity-40 ${gender === g ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-white"}`}
                  onClick={() => {
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
          className={`${primary} min-h-20 text-3xl`}
          onClick={() => {
            unlockAudio();
            onStart();
          }}
        >
          {pack.ui.start}
        </button>
      </div>

      <p className="sticky bottom-0 w-full bg-white/95 pt-1 text-[10px] leading-tight text-gray-600" aria-label="disclaimer">
        {pack.ui.disclaimer}
      </p>
    </main>
  );
}
