"use client";

import { unlockAudio } from "@/lib/audio/voice";
import { getPack, visiblePacks, voiceFor } from "@/lib/i18n";
import { applyVoice, useLang } from "../lang";
import { useSpeech } from "../speech";
import { primary } from "../ui";

// Language picker + voice (female/male) + start. Each language button speaks a short line in that
// language. Any tap here also unlocks audio for the rest of the session.
export function Welcome({ onStart }: { onStart: () => void }) {
  const { pack, gender, setLang, setGender } = useLang();
  const { say } = useSpeech();
  const packs = visiblePacks();
  const canMale = !!pack.timbre.voices.male;
  const canFemale = !!pack.timbre.voices.female;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 bg-white p-6 text-center text-gray-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-24 w-24 rounded-3xl shadow-lg" />
      <h1 className="text-4xl font-extrabold">LoanLens</h1>
      <p className="text-lg text-gray-600">Proof of understanding, alongside the signature.</p>

      <section className="flex w-full flex-col gap-2" aria-label="language">
        <p className="text-lg font-bold">🗣️ {pack.ui.chooseLanguage}</p>
        <div className="grid grid-cols-3 gap-2">
          {packs.map((p) => (
            <button
              key={p.code}
              lang={p.code}
              aria-pressed={p.code === pack.code}
              className={`min-h-16 rounded-2xl border-2 px-2 text-xl font-bold ${p.code === pack.code ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white"}`}
              onClick={() => {
                unlockAudio();
                setLang(p.code);
                applyVoice(getPack(p.code), voiceFor(getPack(p.code), gender).gender); // before speaking the greeting
                void say(p.greeting);
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2" aria-label="voice">
          {(["female", "male"] as const).map((g) => {
            const available = g === "female" ? canFemale : canMale;
            return (
              <button
                key={g}
                disabled={!available}
                aria-pressed={gender === g}
                className={`min-h-14 rounded-2xl border-2 px-2 text-lg font-bold disabled:opacity-40 ${gender === g ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-white"}`}
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
        className={`${primary} min-h-24 text-4xl`}
        onClick={() => {
          unlockAudio();
          onStart();
        }}
      >
        {pack.ui.start}
      </button>
    </main>
  );
}
