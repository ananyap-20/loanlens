"use client";

// Field-by-field agent check: ask -> agent speaks -> ✅/❌/❔ + sound + spoken flag. Re-record any time.
import { useState } from "react";
import { cueFor } from "@/lib/audio/cues";
import { AGENT_ASK, AGENT_FIELDS, checkAgentClip, type AgentCheck as Check } from "@/lib/flow/agent";
import type { PaperInput } from "@/lib/flow/session";
import { useSpeech } from "../speech";
import { RecordPanel } from "../RecordPanel";
import { FIELD_ICON, ValueView } from "../TermCard";
import { primary, Screen, StatusBadge } from "../ui";
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
  onClip: (r: ClipResult, check: Check) => void;
  onDone: () => void;
}) {
  const { say } = useSpeech();
  const [i, setI] = useState(0);
  const field = AGENT_FIELDS[i];
  const latest = (f: string) => [...checks].reverse().find((c) => c.field === f);
  const current = latest(field);

  const rec = useClipRecorder((r) => {
    const c = checkAgentClip(field, r.transcript, paper.terms);
    onClip(r, c);
    cueFor(c.status);
    void say(c.flag);
  });

  return (
    <Screen instruction={AGENT_ASK[field]} dots={dots}>
      <div className="flex justify-center gap-2" aria-label="fields">
        {AGENT_FIELDS.map((f, k) => {
          const c = latest(f);
          const mark = c ? (c.status === "match" ? "✅" : c.status === "conflict" ? "❌" : "❔") : "";
          return (
            <span key={f} className={`flex h-14 w-14 flex-col items-center justify-center rounded-xl border-2 text-2xl ${k === i ? "border-blue-600" : "border-gray-200"}`}>
              {FIELD_ICON[f]}
              <span className="text-base leading-none">{mark}</span>
            </span>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-2xl font-bold">
        <span className="text-4xl">{FIELD_ICON[field]}</span> ❓
      </p>

      <RecordPanel speaker="agent" {...rec} onToggle={rec.toggle} />

      {current && rec.phase === "idle" && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-gray-200 p-3">
          <StatusBadge status={current.status} big />
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
