"use client";

// Big mic button + always-visible recording state + speaker label.
import { MAX_RECORD_SECONDS } from "@/lib/audio/recorder";
import type { Speaker } from "@/lib/flow/session";
import { useSpeech } from "./speech";
import type { ClipPhase } from "./useClipRecorder";

export const SPEAKER_UI: Record<Speaker, { icon: string; word: string; cls: string }> = {
  agent: { icon: "🧑‍💼", word: "एजेंट", cls: "bg-purple-100 text-purple-900 border-purple-500" },
  borrower: { icon: "👩", word: "उधार लेने वाली", cls: "bg-pink-100 text-pink-900 border-pink-500" },
  helper: { icon: "🤝", word: "मददगार", cls: "bg-teal-100 text-teal-900 border-teal-500" },
};

const fmt = (s: number) => `0:${Math.floor(s).toString().padStart(2, "0")}`;

export function SpeakerChip({ speaker }: { speaker: Speaker }) {
  const s = SPEAKER_UI[speaker];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-lg font-bold ${s.cls}`}>
      <span className="text-2xl">{s.icon}</span> {s.word}
    </span>
  );
}

export function RecordPanel({
  speaker,
  phase,
  elapsed,
  problem,
  onToggle,
  disabled = false,
}: {
  speaker: Speaker;
  phase: ClipPhase;
  elapsed: number;
  problem: string;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const recording = phase === "recording";
  const { speaking } = useSpeech();
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 p-4">
      <SpeakerChip speaker={speaker} />
      {recording ? (
        <div role="status" className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 p-3 text-xl font-bold text-white">
          <span className="h-5 w-5 animate-pulse rounded-full bg-white" />
          रिकॉर्डिंग · {SPEAKER_UI[speaker].icon} {fmt(elapsed)} / {fmt(MAX_RECORD_SECONDS)}
        </div>
      ) : (
        <div
          role="status"
          className={`w-full rounded-xl p-3 text-center text-xl font-semibold ${
            phase === "idle" && !speaking ? "bg-green-100 text-green-900 ring-2 ring-green-500" : "bg-gray-100"
          }`}
        >
          {phase === "requesting" && "🎤❔ माइक की अनुमति…"}
          {phase === "sending" && "📱 ऐप आपकी बात समझ रहा है…"}
          {phase === "idle" && (speaking ? "📱 ऐप बोल रहा है — सुनिए, फिर बोलिए" : "🎤 आपकी बारी — माइक दबाइए")}
        </div>
      )}
      <button
        aria-label={recording ? "stop recording" : "start recording"}
        disabled={disabled || phase === "sending" || phase === "requesting"}
        onClick={onToggle}
        className={`flex h-32 w-32 items-center justify-center rounded-full text-6xl text-white shadow-lg active:scale-95 disabled:opacity-40 ${
          recording ? "bg-red-600 ring-8 ring-red-200" : "bg-blue-600"
        }`}
      >
        {recording ? "⏹️" : "🎤"}
      </button>
      {problem && (
        <p className="w-full rounded-xl bg-gray-100 p-2 text-base text-gray-700" role="alert">
          ❔ {problem}
        </p>
      )}
    </section>
  );
}
