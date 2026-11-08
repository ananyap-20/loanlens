"use client";

// Small shared pieces: the screen frame (auto-play + 🔁 + 🐢 + progress dots), big buttons, status badges.
import { useEffect } from "react";
import type { Status } from "@/lib/engine/types";
import { useSpeech } from "./speech";

export const bigBtn =
  "flex min-h-20 w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-2xl font-bold shadow-md active:scale-[0.98] disabled:opacity-40";
export const primary = `${bigBtn} bg-blue-600 text-white`;
export const secondary = `${bigBtn} border-2 border-blue-600 bg-white text-blue-700`;

export function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex justify-center gap-2" aria-label={`step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-3 w-3 rounded-full ${i < current ? "bg-blue-600" : i === current ? "bg-blue-600 ring-4 ring-blue-200" : "bg-gray-300"}`} />
      ))}
    </div>
  );
}

/**
 * Every screen: speaks `instruction` when it appears (and again whenever `playKey` changes),
 * with big replay 🔁 and slow 🐢 buttons. `slow` plays the first time at 0.85.
 */
export function Screen({
  instruction,
  playKey = 0,
  slow = false,
  dots,
  children,
}: {
  instruction: string;
  playKey?: number | string;
  slow?: boolean;
  dots?: { total: number; current: number };
  children: React.ReactNode;
}) {
  const { say, speaking, error } = useSpeech();
  useEffect(() => {
    if (instruction) void say(instruction, slow);
  }, [instruction, playKey, slow, say]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 bg-white p-4 text-gray-900">
      <div className="flex items-center justify-between gap-3">
        {dots ? <Dots {...dots} /> : <span />}
        <div className="flex gap-2">
          <button aria-label="replay" className="h-14 w-14 rounded-full bg-gray-100 text-3xl shadow" onClick={() => void say(instruction)}>
            🔁
          </button>
          <button aria-label="slow" className="h-14 w-14 rounded-full bg-gray-100 text-3xl shadow" onClick={() => void say(instruction, true)}>
            🐢
          </button>
        </div>
      </div>
      {speaking && (
        <p className="flex items-center gap-2 text-lg text-blue-700" role="status">
          <span className="animate-pulse text-2xl">🔊</span> बोल रही हूँ…
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

/** Colour + icon + word (never colour alone). The sound is played by the caller (chime/buzz/tick). */
export function StatusBadge({ status, big = false }: { status: Status; big?: boolean }) {
  const s = STATUS_UI[status];
  return (
    <span className={`inline-flex items-center gap-2 rounded-xl border-2 px-3 py-1 font-bold ${s.cls} ${big ? "text-2xl" : "text-lg"}`}>
      <span className={big ? "text-4xl" : "text-2xl"}>{s.icon}</span>
      {s.word}
    </span>
  );
}
