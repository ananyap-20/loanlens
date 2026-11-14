"use client";

// Big mic button + always-visible recording state + speaker label.
import { MAX_RECORD_SECONDS } from "@/lib/audio/recorder";
import type { Speaker } from "@/lib/flow/session";
import { useLang } from "./lang";
import { useSpeech } from "./speech";
import { focusRing } from "./ui";
import type { ClipPhase } from "./useClipRecorder";

export const SPEAKER_UI: Record<Speaker, { icon: string; cls: string }> = {
  agent: { icon: "🧑‍💼", cls: "bg-purple-100 text-purple-900 border-purple-500" },
  borrower: { icon: "🧑", cls: "bg-pink-100 text-pink-900 border-pink-500" },
  helper: { icon: "🤝", cls: "bg-teal-100 text-teal-900 border-teal-500" },
};

const fmt = (s: number) => `0:${Math.floor(s).toString().padStart(2, "0")}`;

export function SpeakerChip({ speaker }: { speaker: Speaker }) {
  const { ui } = useLang().pack;
  const s = SPEAKER_UI[speaker];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border-2 px-4 py-1 text-lg font-semibold ${s.cls}`}>
      <span className="text-2xl">{s.icon}</span> {ui.role[speaker]}
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
  const { ui } = useLang().pack;
  return (
    <section className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-5 shadow-soft">
      <SpeakerChip speaker={speaker} />
      {recording ? (
        // Recording is impossible to miss: a solid red pill with a pulsing dot, the speaker and the timer.
        <div role="status" className="flex w-full items-center justify-center gap-3 rounded-full bg-conflict px-4 py-3 text-xl font-semibold text-white shadow-soft">
          <span className="relative flex h-5 w-5 items-center justify-center">
            <span className="absolute h-5 w-5 animate-pulse rounded-full bg-white/50" />
            <span className="h-3 w-3 rounded-full bg-white" />
          </span>
          {ui.recording} · {SPEAKER_UI[speaker].icon} {fmt(elapsed)} / {fmt(MAX_RECORD_SECONDS)}
        </div>
      ) : (
        <div
          role="status"
          className={`w-full rounded-chip p-3 text-center text-xl font-semibold ${
            // not green: green is reserved for ✅ match, and this box sits right above a ❌ result
            phase === "idle" && !speaking ? "bg-cream text-ink ring-2 ring-saffron-strong" : "bg-sand text-ink"
          }`}
        >
          {phase === "requesting" && ui.micPermission}
          {phase === "sending" && ui.appUnderstanding}
          {phase === "idle" && (speaking ? ui.appSpeakingListen : ui.yourTurn)}
        </div>
      )}
      {/* calm timer ring: fills as the clip approaches its limit (only while recording) */}
      <div
        className="rounded-full p-2"
        style={
          recording
            ? { background: `conic-gradient(#b91c1c ${Math.min(100, (elapsed / MAX_RECORD_SECONDS) * 100)}%, #f3eadb 0)` }
            : undefined
        }
      >
        <button
          aria-label={recording ? "stop recording" : "start recording"}
          disabled={disabled || phase === "sending" || phase === "requesting"}
          onClick={onToggle}
          className={`press flex h-32 w-32 items-center justify-center rounded-full border-4 border-surface text-6xl text-white shadow-soft disabled:opacity-40 ${focusRing} ${
            recording ? "bg-conflict" : "bg-primary active:bg-primary-pressed"
          }`}
        >
          {recording ? "⏹️" : "🎤"}
        </button>
      </div>
      {problem && (
        <p className="w-full rounded-chip bg-unknown-soft p-3 text-base text-unknown-ink" role="alert">
          ❔ {problem}
        </p>
      )}
    </section>
  );
}
