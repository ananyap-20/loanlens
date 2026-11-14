"use client";

import { chime } from "@/lib/audio/cues";
import { useEffect } from "react";
import { prefetchSpeech } from "@/lib/audio/voice";

import { useLang } from "../lang";
import { useSpeech } from "../speech";
import { RecordPanel } from "../RecordPanel";
import { primary, Screen } from "../ui";
import { useClipRecorder, type ClipResult } from "../useClipRecorder";

// The agent records a spoken consent line before anything about the loan is recorded.
export function Consent({
  dots,
  consentTranscript,
  onRecorded,
  onNext,
}: {
  dots: { total: number; current: number };
  consentTranscript: string | null;
  onRecorded: (r: ClipResult) => void;
  onNext: () => void;
}) {
  const { say } = useSpeech();
  const { say: t, ui } = useLang().pack;
  useEffect(() => prefetchSpeech(t.agentAsk.loan_amount), [t]);
  const rec = useClipRecorder((r) => {
    onRecorded(r);
    chime();
    void say(t.consentDone);
  });

  return (
    <Screen instruction={t.consentSay} dots={dots} speaker="agent">
      <p className="rounded-card border border-line bg-surface p-5 text-2xl font-semibold leading-relaxed shadow-soft">🧑‍💼 “{ui.consentLine}”</p>
      <RecordPanel speaker="agent" {...rec} onToggle={rec.toggle} />
      {consentTranscript && (
        <p className="rounded-chip bg-match-soft p-3 text-lg">
          ✅ <span className="text-muted">“{consentTranscript}”</span>
        </p>
      )}
      <button className={primary} disabled={!consentTranscript || rec.phase !== "idle"} onClick={onNext}>
        {ui.next} <span className="text-4xl">▶️</span>
      </button>
    </Screen>
  );
}
