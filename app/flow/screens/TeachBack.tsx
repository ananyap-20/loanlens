"use client";

// Teach-back: the borrower explains in her own words. lib/engine/gate.ts decides every step
// (random order, follow-ups, slow re-explain, max 3 tries); this screen only plays and records.
import { useState } from "react";
import { cueFor } from "@/lib/audio/cues";
import {
  answerGate,
  createGate,
  GATE_FIELDS,
  GATE_LABEL,
  GATE_MAX_ATTEMPTS,
  shuffledGateFields,
  type AnswerOutcome,
  type GateState,
  type NextStep,
} from "@/lib/engine/gate";
import type { Status } from "@/lib/engine/types";
import type { PaperInput } from "@/lib/flow/session";
import { gatePrompt, GATE_FIELD_HI } from "@/lib/flow/teachback";
import { RecordPanel } from "../RecordPanel";
import { Screen, StatusBadge } from "../ui";
import { useClipRecorder, type ClipResult } from "../useClipRecorder";

const OUTCOME_STATUS: Record<AnswerOutcome, Status> = {
  pass: "match",
  wrong: "conflict",
  uncertain: "unable_to_verify",
  not_mentioned: "not_mentioned",
};

const GATE_ICON = { amount_in_hand: "👛", installment: "🗓️", processing_fee: "🧾", missed_payment: "⏰" } as const;

export function TeachBack({
  dots,
  paper,
  onClip,
  onDone,
}: {
  dots: { total: number; current: number };
  paper: PaperInput;
  onClip: (r: ClipResult, field: string) => void;
  onDone: (state: GateState) => void;
}) {
  const [gate, setGate] = useState<{ state: GateState; next: NextStep }>(() => createGate(paper.terms, shuffledGateFields()));
  const [last, setLast] = useState<{ outcome: AnswerOutcome; transcript: string } | null>(null);
  const [turn, setTurn] = useState(0);

  const prompt = gatePrompt(gate.next, paper.terms, last?.outcome, turn === 0);
  const field = "field" in gate.next ? gate.next.field : null;

  const rec = useClipRecorder((r) => {
    if (!field || gate.state.result !== "in_progress") return;
    const a = answerGate(gate.state, field, r.transcript);
    onClip(r, field);
    cueFor(OUTCOME_STATUS[a.outcome]);
    setLast({ outcome: a.outcome, transcript: r.transcript });
    setGate({ state: a.state, next: a.next });
    setTurn((t) => t + 1);
    if (a.next.kind === "passed" || a.next.kind === "stop") onDone(a.state);
  });

  return (
    <Screen instruction={prompt.text} slow={prompt.slow} playKey={turn} dots={dots}>
      <p className="text-base text-gray-600">🔢 नंबर और शब्दों की जाँच ({GATE_LABEL})</p>

      <div className="grid grid-cols-4 gap-2">
        {GATE_FIELDS.map((id) => {
          const fs = gate.state.fields[id];
          const mark = fs.status === "passed" ? "✅" : fs.status === "failed" ? "❌" : fs.status === "not_on_paper" ? "❔" : "";
          return (
            <div
              key={id}
              className={`flex flex-col items-center gap-1 rounded-xl border-2 p-2 ${id === field ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}
              aria-label={GATE_FIELD_HI[id]}
            >
              <span className="text-3xl">{GATE_ICON[id]}</span>
              <span className="h-6 text-xl">{mark}</span>
              <span className="flex gap-1" aria-label="tries">
                {Array.from({ length: GATE_MAX_ATTEMPTS }, (_, k) => (
                  <span key={k} className={`h-2 w-2 rounded-full ${k < fs.failedAttempts ? "bg-red-500" : "bg-gray-300"}`} />
                ))}
              </span>
            </div>
          );
        })}
      </div>

      {field && (
        <p className="flex items-center gap-2 text-2xl font-bold">
          <span className="text-4xl">{GATE_ICON[field]}</span> ❓
        </p>
      )}

      <RecordPanel speaker="borrower" {...rec} onToggle={rec.toggle} />

      {last && rec.phase === "idle" && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-gray-200 p-3">
          <StatusBadge status={OUTCOME_STATUS[last.outcome]} big />
          <p className="text-base text-gray-600">“{last.transcript}”</p>
        </div>
      )}
    </Screen>
  );
}
