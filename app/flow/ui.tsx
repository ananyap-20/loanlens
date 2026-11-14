"use client";

// Small shared pieces: the screen frame (auto-play + 🔁 + 🐢 + progress dots + speaker tint), big buttons,
// status badges, labelled field chips and the status legend. Words come from the selected language pack.
import { useEffect } from "react";
import { resumeAudio } from "@/lib/audio/cues";
import type { Field, Status } from "@/lib/engine/types";
import type { Speaker } from "@/lib/flow/session";
import { statusPresentation } from "@/lib/flow/statusPresentation";
import { useLang } from "./lang";
import { useSpeech } from "./speech";

/** Focus ring for every tappable thing: 3px saffron, shown for keyboard / switch focus. */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-saffron-strong focus-visible:ring-offset-2 focus-visible:ring-offset-cream";
export const bigBtn = `press flex min-h-16 w-full items-center justify-center gap-3 rounded-btn px-6 py-4 text-xl font-semibold shadow-soft disabled:opacity-40 ${focusRing}`;
export const primary = `${bigBtn} bg-primary text-white active:bg-primary-pressed`;
export const secondary = `${bigBtn} border-2 border-primary bg-surface text-primary`;

/** Who is speaking now: whole-screen tint + banner colour. agent = purple, borrower = pink. */
export const SPEAKER_THEME: Record<Speaker, { icon: string; bg: string; banner: string; button: string }> = {
  agent: { icon: "🧑‍💼", bg: "bg-purple-50", banner: "bg-purple-700", button: "bg-purple-700" },
  borrower: { icon: "🧑", bg: "bg-pink-50", banner: "bg-pink-600", button: "bg-pink-600" },
  helper: { icon: "🤝", bg: "bg-teal-50", banner: "bg-teal-700", button: "bg-teal-700" },
};

export function Dots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-label={`step ${current + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`rounded-full ${
            i < current
              ? "h-2.5 w-2.5 bg-saffron-strong"
              : i === current
                ? "h-3 w-3 bg-saffron-strong ring-4 ring-saffron/25"
                : "h-2.5 w-2.5 border-[1.5px] border-sand-edge bg-sand-dot"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Big 🔁 replay and 🐢 slow (0.85) buttons for a screen's spoken text: icon on top, the pack's own
 * "say again" / "say slowly" word below (icon only if the pack has no word). Same place on every screen.
 */
export function ReplayButtons({ text, className = "", onTap }: { text: string; className?: string; onTap?: () => void }) {
  const { say, speaking } = useSpeech();
  const { ui } = useLang().pack;
  const btn = `press flex min-h-16 min-w-[88px] flex-col items-center justify-center gap-0.5 rounded-btn border border-line bg-cream px-2 py-1.5 text-ink shadow-soft ${focusRing} ${speaking ? "pulse-ring" : ""}`;
  const run = (slow: boolean) => {
    onTap?.();
    void resumeAudio(); // a tap is the moment the browser allows audio (matters on Welcome, before any other tap)
    void say(text, slow);
  };
  return (
    <div className={`flex shrink-0 gap-2 ${className}`}>
      {([false, true] as const).map((slow) => {
        const label = slow ? ui.slow : ui.replay;
        return (
          <button key={String(slow)} aria-label={label} className={btn} onClick={() => run(slow)}>
            <span aria-hidden="true" className="text-3xl leading-none">
              {slow ? "🐢" : "🔁"}
            </span>
            {label && <span className="text-[15px] font-semibold leading-tight">{label}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Persistent banner: who should be speaking into the phone right now. */
export function SpeakerBanner({ speaker }: { speaker: Speaker }) {
  const { ui } = useLang().pack;
  const t = SPEAKER_THEME[speaker];
  return (
    <div
      className={`sticky top-0 z-10 -mx-5 -mt-4 flex items-center justify-center gap-2 rounded-b-card px-5 py-3 text-xl font-semibold text-white shadow-soft ${t.banner}`}
      role="status"
    >
      {ui.speakingNow} <span className="text-3xl">{t.icon}</span> {ui.role[speaker]}
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
  const { ui } = useLang().pack;
  useEffect(() => {
    if (instruction) void say(instruction, slow);
  }, [instruction, playKey, slow, say]);

  return (
    <main className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-8 pt-4 text-ink ${speaker ? SPEAKER_THEME[speaker].bg : "bg-cream"}`}>
      {speaker && <SpeakerBanner speaker={speaker} />}
      <div className="flex items-center justify-between gap-3">
        {dots ? <Dots {...dots} /> : <span />}
        <ReplayButtons text={instruction} />
      </div>
      {speaking && (
        <p className="flex items-center gap-2 rounded-chip border border-line bg-surface px-4 py-2 text-lg font-semibold text-ink" role="status">
          <span className="animate-pulse text-2xl">📱</span> {ui.appSpeaking}
        </p>
      )}
      {error && (
        <p className="rounded-chip border border-conflict/30 bg-conflict-soft p-3 text-lg text-conflict" role="alert">
          {ui.audioFailed.replace("{error}", error)}
        </p>
      )}
      {children}
    </main>
  );
}

/** Colour + icon + word (never colour alone), plus an optional reason line. Sound is played by the caller. */
export function StatusBadge({ status, big = false, reason }: { status: Status; big?: boolean; reason?: string }) {
  const { ui } = useLang().pack;
  const s = statusPresentation(status);
  return (
    <span className="inline-flex flex-col gap-1">
      <span className={`inline-flex items-center gap-2 self-start rounded-chip border-2 py-1 pl-1 pr-3 font-semibold ${s.cls} ${big ? "text-2xl" : "text-lg"}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-full bg-surface ${big ? "h-12 w-12 text-3xl" : "h-9 w-9 text-xl"}`}>{s.icon}</span>
        {ui.status[status]}
      </span>
      {reason && <span className="text-base font-semibold text-muted">↳ {reason}</span>}
    </span>
  );
}

/** One-line legend shown on the check screens. */
export function Legend() {
  const { ui } = useLang().pack;
  return (
    <p className="rounded-chip border border-line bg-surface px-3 py-2 text-center text-base font-semibold" aria-label="legend">
      {ui.legend}
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
  const { ui } = useLang().pack;
  return (
    <button
      type="button"
      aria-label={ui.fieldName[field]}
      onClick={() => void say(ui.fieldName[field])}
      className={`flex min-h-16 min-w-16 flex-col items-center justify-center gap-0.5 rounded-chip border-2 bg-surface p-1 ${focusRing} ${
        active ? "border-primary ring-2 ring-primary/20" : "border-line"
      }`}
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="text-xs font-semibold leading-tight">{ui.fieldShort[field]}</span>
      {mark !== undefined && <span className="h-5 text-base leading-none">{mark}</span>}
      {extra}
    </button>
  );
}
