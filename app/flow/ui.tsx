"use client";

// Small shared pieces: the screen frame (auto-play + 🔁 + 🐢 + progress dots + speaker tint), big buttons,
// status badges, labelled field chips and the status legend.
import { useEffect } from "react";
import type { Field, Status } from "@/lib/engine/types";
import type { Speaker } from "@/lib/flow/session";
import { FIELD_NAME_HI, FIELD_SHORT_HI } from "@/lib/flow/scripts";
import { useSpeech } from "./speech";

export const bigBtn =
  "flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-2xl font-bold shadow-md active:scale-[0.98] disabled:opacity-40";
export const primary = `${bigBtn} bg-blue-600 text-white`;
export const secondary = `${bigBtn} border-2 border-blue-600 bg-white text-blue-700`;

/** Who is speaking now: whole-screen tint + banner colour. agent = purple, borrower = pink. */
export const SPEAKER_THEME: Record<Speaker, { icon: string; role: string; bg: string; banner: string; button: string }> = {
  agent: { icon: "🧑‍💼", role: "एजेंट", bg: "bg-purple-50", banner: "bg-purple-700", button: "bg-purple-700" },
  borrower: { icon: "👩", role: "उधार लेने वाली", bg: "bg-pink-50", banner: "bg-pink-600", button: "bg-pink-600" },
  helper: { icon: "🤝", role: "मददगार", bg: "bg-teal-50", banner: "bg-teal-700", button: "bg-teal-700" },
};

export function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-3 w-3 rounded-full ${i < current ? "bg-blue-600" : i === current ? "bg-blue-600 ring-4 ring-blue-200" : "bg-gray-300"}`} />
      ))}
    </div>
  );
}

/** Persistent banner: who should be speaking into the phone right now. */
export function SpeakerBanner({ speaker }: { speaker: Speaker }) {
  const t = SPEAKER_THEME[speaker];
  return (
    <div className={`sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-center gap-2 px-4 py-3 text-xl font-bold text-white shadow ${t.banner}`} role="status">
      🎤 अभी बोल रहे हैं: <span className="text-3xl">{t.icon}</span> {t.role}
    </div>
  );
}

/**
 * Every screen: speaks `instruction` when it appears (and again whenever `playKey` changes),
 * with big replay 🔁 and slow 🐢 buttons. `slow` plays the first time at 0.85.
 * `speaker` tints the whole screen and shows who should speak now.
 */
export function Screen({
  instruction,
  playKey = 0,
  slow = false,
  dots,
  speaker,
  children,
}: {
  instruction: string;
  playKey?: number | string;
  slow?: boolean;
  dots?: { total: number; current: number };
  speaker?: Speaker;
  children: React.ReactNode;
}) {
  const { say, speaking, error } = useSpeech();
  useEffect(() => {
    if (instruction) void say(instruction, slow);
  }, [instruction, playKey, slow, say]);

  return (
    <main className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 text-gray-900 ${speaker ? SPEAKER_THEME[speaker].bg : "bg-white"}`}>
      {speaker && <SpeakerBanner speaker={speaker} />}
      <div className="flex items-center justify-between gap-3">
        {dots ? <Dots {...dots} /> : <span />}
        <div className="flex gap-2">
          <button aria-label="फिर से सुनें — replay" className="h-14 w-14 rounded-full bg-white text-3xl shadow" onClick={() => void say(instruction)}>
            🔁
          </button>
          <button aria-label="धीरे सुनें — slow" className="h-14 w-14 rounded-full bg-white text-3xl shadow" onClick={() => void say(instruction, true)}>
            🐢
          </button>
        </div>
      </div>
      {speaking && (
        <p className="flex items-center gap-2 rounded-xl bg-blue-100 p-2 text-lg font-semibold text-blue-800" role="status">
          <span className="animate-pulse text-2xl">📱</span> ऐप बोल रहा है… सुनिए
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-100 p-3 text-lg text-red-800" role="alert">
          🔇 आवाज़ नहीं चल पाई ({error}). 🔁 दबाइए।
        </p>
      )}
      {children}
    </main>
  );
}

const STATUS_UI: Record<Status, { icon: string; cls: string; word: string }> = {
  match: { icon: "✅", cls: "bg-green-100 text-green-900 border-green-600", word: "मिलता है" },
  conflict: { icon: "❌", cls: "bg-red-100 text-red-900 border-red-600", word: "अलग है" },
  not_mentioned: { icon: "❔", cls: "bg-gray-100 text-gray-800 border-gray-400", word: "नहीं बोला" },
  unable_to_verify: { icon: "❔", cls: "bg-gray-100 text-gray-800 border-gray-400", word: "जाँच नहीं पाए" },
};

/** Colour + icon + word (never colour alone), plus an optional reason line. Sound is played by the caller. */
export function StatusBadge({ status, big = false, reason }: { status: Status; big?: boolean; reason?: string }) {
  const s = STATUS_UI[status];
  return (
    <span className="inline-flex flex-col gap-1">
      <span className={`inline-flex items-center gap-2 self-start rounded-xl border-2 px-3 py-1 font-bold ${s.cls} ${big ? "text-2xl" : "text-lg"}`}>
        <span className={big ? "text-4xl" : "text-2xl"}>{s.icon}</span>
        {s.word}
      </span>
      {reason && <span className="text-base font-semibold text-gray-700">↳ {reason}</span>}
    </span>
  );
}

/** One-line legend shown on the check screens. */
export function Legend() {
  return (
    <p className="rounded-xl bg-white/80 p-2 text-center text-base font-semibold" aria-label="legend">
      ✅ मिलता है · ❌ अलग है · ❔ जाँच नहीं पाए
    </p>
  );
}

/** Field icon with its one-word label underneath; tap = the field's name is spoken. */
export function FieldChip({
  field,
  icon,
  mark,
  active,
  extra,
}: {
  field: Field;
  icon: string;
  mark?: string;
  active?: boolean;
  extra?: React.ReactNode;
}) {
  const { say } = useSpeech();
  return (
    <button
      type="button"
      aria-label={FIELD_NAME_HI[field]}
      onClick={() => void say(FIELD_NAME_HI[field])}
      className={`flex min-h-16 min-w-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-white p-1 ${active ? "border-blue-600 ring-2 ring-blue-200" : "border-gray-200"}`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-xs font-bold leading-tight">{FIELD_SHORT_HI[field]}</span>
      {mark !== undefined && <span className="h-5 text-base leading-none">{mark}</span>}
      {extra}
    </button>
  );
}
