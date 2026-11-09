"use client";

// Teach-back: the borrower explains in her own words. lib/engine/gate.ts decides every step
// (random order, follow-ups, slow re-explain, max 3 tries); this screen only plays and records.
import { useState } from "react";
import { cueFor } from "@/lib/audio/cues";
import { isNavigationOnly } from "@/lib/engine";
import {
  answerGate,
  createGate,
  GATE_FIELDS,
  GATE_LABEL,
  GATE_MAX_ATTEMPTS,
  shuffledGateFields,
  type AnswerOutcome,
  type GateFieldId,
  type GateState,
  type NextStep,
} from "@/lib/engine/gate";
import type { Field, Status } from "@/lib/engine/types";
import { NAV_ONLY_HI, REASON_HI } from "@/lib/flow/scripts";
import type { PaperInput } from "@/lib/flow/session";
import { FOLLOW_UP_HI, GATE_ASK_HI, gatePrompt } from "@/lib/flow/teachback";
import { RecordPanel } from "../RecordPanel";
import { useSpeech } from "../speech";
import { FIELD_ICON } from "../TermCard";
import { FieldChip, Legend, Screen, StatusBadge } from "../ui";
import { useClipRecorder, type ClipResult } from "../useClipRecorder";

const OUTCOME_STATUS: Record<AnswerOutcome, Status> = {
  pass: "match",
  wrong: "conflict",
  uncertain: "unable_to_verify",
  not_mentioned: "not_mentioned",
  implausible: "unable_to_verify",
};

const OUTCOME_REASON: Partial<Record<AnswerOutcome, string>> = {
  uncertain: REASON_HI.uncertain,
  implausible: REASON_HI.implausible,
  not_mentioned: REASON_HI.no_number,
};

// Each teach-back point shown with the paper field it is about (icon + one-word label).
const GATE_CHIP: Record<GateFieldId, Field> = {
  amount_in_hand: "net_disbursed",
  installment: "installment",
  processing_fee: "processing_fee",
  missed_payment: "late_fee",
};

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
  const { say } = useSpeech();
  const [gate, setGate] = useState<{ state: GateState; next: NextStep }>(() => createGate(paper.terms, shuffledGateFields()));
  const [last, setLast] = useState<{ outcome: AnswerOutcome; transcript: string } | null>(null);
  const [turn, setTurn] = useState(0);

  const prompt = gatePrompt(gate.next, paper.terms, last?.outcome, turn === 0);
  const field = "field" in gate.next ? gate.next.field : null;
  const questionText =
    gate.next.kind === "follow_up" ? FOLLOW_UP_HI[gate.next.key] : field ? GATE_ASK_HI[field] : "";

  const rec = useClipRecorder((r) => {
    if (!field || gate.state.result !== "in_progress") return;
    if (isNavigationOnly(r.transcript)) {
      onClip(r, "navigation"); // kept as a recording, not an answer: no attempt is counted
      void say(NAV_ONLY_HI);
      return;
    }
    const a = answerGate(gate.state, field, r.transcript);
    onClip(r, field);
    cueFor(OUTCOME_STATUS[a.outcome]);
    setLast({ outcome: a.outcome, transcript: r.transcript });
    setGate({ state: a.state, next: a.next });
    setTurn((t) => t + 1);
    if (a.next.kind === "passed" || a.next.kind === "stop") onDone(a.state);
  });

  return (
    <Screen instruction={prompt.text} slow={prompt.slow} playKey={turn} dots={dots} speaker="borrower">
      <Legend />
      <p className="text-base text-gray-600">🔢 नंबर और शब्दों की जाँच ({GATE_LABEL})</p>

      <div className="grid grid-cols-4 gap-2">
        {GATE_FIELDS.map((id) => {
          const fs = gate.state.fields[id];
          const mark = fs.status === "passed" ? "✅" : fs.status === "failed" ? "❌" : fs.status === "not_on_paper" ? "❔" : "";
          const tries = Math.min(fs.failedAttempts + (id === field ? 1 : 0), GATE_MAX_ATTEMPTS);
          return (
            <FieldChip
              key={id}
              field={GATE_CHIP[id]}
              icon={FIELD_ICON[GATE_CHIP[id]]}
              active={id === field}
              mark={mark}
              extra={
                tries > 0 && fs.status === "pending" ? (
                  <span className="flex items-center gap-1" aria-label={`कोशिश ${tries}/${GATE_MAX_ATTEMPTS}`}>
                    {Array.from({ length: GATE_MAX_ATTEMPTS }, (_, k) => (
                      <span key={k} className={`h-2 w-2 rounded-full ${k < fs.failedAttempts ? "bg-red-500" : k < tries ? "bg-blue-500" : "bg-gray-300"}`} />
                    ))}
                    <span className="text-[10px] font-bold">
                      कोशिश {tries}/{GATE_MAX_ATTEMPTS}
                    </span>
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </div>

      {questionText && (
        <p className="rounded-2xl border-2 border-pink-300 bg-white p-3 text-2xl font-bold leading-snug">
          {field ? FIELD_ICON[GATE_CHIP[field]] : ""} {questionText}
        </p>
      )}

      <RecordPanel speaker="borrower" {...rec} onToggle={rec.toggle} />

      {last && rec.phase === "idle" && (
        <div className="flex flex-col gap-2 rounded-2xl border-2 border-gray-200 bg-white p-3">
          <StatusBadge status={OUTCOME_STATUS[last.outcome]} big reason={OUTCOME_REASON[last.outcome]} />
          <p className="text-base text-gray-600">“{last.transcript}”</p>
        </div>
      )}
    </Screen>
  );
}
