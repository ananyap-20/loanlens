"use client";

// Field-by-field agent check: ask -> agent speaks -> ✅/❌/❔ + sound + spoken flag. Re-record any time.
import { useEffect, useState } from "react";
import { cueFor } from "@/lib/audio/cues";
import { prefetchSpeech } from "@/lib/audio/voice";
import { isNavigationOnly } from "@/lib/engine";
import {
  AGENT_ASK,
  AGENT_CHANGED_HI,
  AGENT_FIELDS,
  AGENT_QUESTION_TEXT,
  agentChangedEarlier,
  checkAgentClip,
  type AgentCheck as Check,
} from "@/lib/flow/agent";
import { NAV_ONLY_HI, REASON_HI } from "@/lib/flow/scripts";
import type { PaperInput } from "@/lib/flow/session";
import { useSpeech } from "../speech";
import { RecordPanel } from "../RecordPanel";
import { FIELD_ICON, ValueView } from "../TermCard";
import { FieldChip, Legend, primary, Screen, StatusBadge } from "../ui";
import { useClipRecorder, type ClipResult } from "../useClipRecorder";

export function AgentCheck({
  dots,
  paper,
  checks,
  onClip,
  onDone,
}: {
  dots: { total: number; current: number };
  paper: PaperInput;
  checks: Check[]; // every attempt so far (latest per field counts)
  onClip: (r: ClipResult, check: Check | null) => void; // null = not an answer ("next", "skip"), kept as a recording only
  onDone: () => void;
}) {
  const { say } = useSpeech();
  const [i, setI] = useState(0);
  const field = AGENT_FIELDS[i];
  const latest = (f: string) => [...checks].reverse().find((c) => c.field === f);
  const current = latest(field);
  const changed = agentChangedEarlier(checks, field);

  // Fetch the next question's first words now, so it starts at once after "आगे".
  useEffect(() => {
    if (i + 1 < AGENT_FIELDS.length) prefetchSpeech(AGENT_ASK[AGENT_FIELDS[i + 1]]);
  }, [i]);

  const rec = useClipRecorder((r) => {
    if (isNavigationOnly(r.transcript)) {
      onClip(r, null); // keep the recording, do not count it as an answer
      void say(NAV_ONLY_HI);
      return;
    }
    const c = checkAgentClip(field, r.transcript, paper.terms);
    onClip(r, c);
    cueFor(c.status);
    void say(c.flag);
  });

  return (
    <Screen instruction={AGENT_ASK[field]} dots={dots} speaker="agent">
      <Legend />
      <div className="flex justify-center gap-2" aria-label="fields">
        {AGENT_FIELDS.map((f, k) => {
          const c = latest(f);
          const mark = c ? (c.status === "match" ? "✅" : c.status === "conflict" ? "❌" : "❔") : "";
          return (
            <FieldChip
              key={f}
              field={f}
              icon={FIELD_ICON[f]}
              active={k === i}
              mark={mark + (agentChangedEarlier(checks, f) ? "⚠️" : "")}
            />
          );
        })}
      </div>

      <p className="rounded-2xl border-2 border-purple-300 bg-white p-3 text-2xl font-bold leading-snug">{AGENT_QUESTION_TEXT[field]}</p>

      <RecordPanel speaker="agent" {...rec} onToggle={rec.toggle} />

      {current && rec.phase === "idle" && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 bg-white p-3">
          <StatusBadge status={current.status} big reason={current.status === "unable_to_verify" && current.reason ? REASON_HI[current.reason] : undefined} />
          {changed && (
            <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-2 text-lg font-bold text-amber-900" role="alert">
              ⚠️ {AGENT_CHANGED_HI}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-lg font-bold">🧑‍💼 एजेंट</span>
              {current.spoken[0] ? <ValueView v={current.spoken[0]} /> : <span className="text-3xl">❔</span>}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-lg font-bold">📄 कागज़</span>
              {current.paper ? <ValueView v={current.paper} /> : <span className="text-3xl">❔</span>}
            </div>
          </div>
          <p className="text-base text-gray-600">“{current.transcript}”</p>
        </div>
      )}

      <button
        className={primary}
        disabled={rec.phase !== "idle"}
        onClick={() => (i + 1 < AGENT_FIELDS.length ? setI(i + 1) : onDone())}
      >
        आगे <span className="text-4xl">▶️</span>
      </button>
    </Screen>
  );
}
