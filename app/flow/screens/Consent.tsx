"use client";

import { chime } from "@/lib/audio/cues";
import { useEffect } from "react";
import { prefetchSpeech } from "@/lib/audio/voice";
import { AGENT_ASK, CONSENT_DONE, CONSENT_LINE, CONSENT_SAY } from "@/lib/flow/agent";
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
  useEffect(() => prefetchSpeech(AGENT_ASK.loan_amount), []);
  const rec = useClipRecorder((r) => {
    onRecorded(r);
    chime();
    void say(CONSENT_DONE);
  });

  return (
    <Screen instruction={CONSENT_SAY} dots={dots} speaker="agent">
      <p className="rounded-2xl border-2 border-indigo-400 bg-indigo-50 p-4 text-2xl font-semibold leading-relaxed">🧑‍💼 “{CONSENT_LINE}”</p>
      <RecordPanel speaker="agent" {...rec} onToggle={rec.toggle} />
      {consentTranscript && (
        <p className="rounded-xl bg-green-50 p-3 text-lg">
          ✅ <span className="text-gray-700">“{consentTranscript}”</span>
        </p>
      )}
      <button className={primary} disabled={!consentTranscript || rec.phase !== "idle"} onClick={onNext}>
        आगे <span className="text-4xl">▶️</span>
      </button>
    </Screen>
  );
}
