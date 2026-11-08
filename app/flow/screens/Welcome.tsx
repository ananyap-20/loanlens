"use client";

import { unlockAudio } from "@/lib/audio/voice";
import { primary } from "../ui";

// No speech here: the browser only allows audio after this first tap, which also unlocks it.
export function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 bg-white p-6 text-center text-gray-900">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" className="h-28 w-28 rounded-3xl shadow-lg" />
      <h1 className="text-4xl font-extrabold">LoanLens</h1>
      <p className="text-lg text-gray-600">Proof of understanding, alongside the signature.</p>
      <button
        className={`${primary} min-h-28 text-4xl`}
        onClick={() => {
          unlockAudio();
          onStart();
        }}
      >
        ▶️ शुरू करें
      </button>
    </main>
  );
}
