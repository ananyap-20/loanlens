"use client";

// Teach-back: the borrower explains in their own words. lib/engine/gate.ts decides every step
// (random order, follow-ups, slow re-explain, max 3 tries); this screen only plays and records.
// The transcript is normalised by the language pack first; the borrower's own words are what the receipt keeps.
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
import type { PaperInput } from "@/lib/flow/session";
import { statusPresentation } from "@/lib/flow/statusPresentation";
import { useLang } from "../lang";
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

const OUTCOME_REASON = { uncertain: "uncertain", implausible: "implausible", not_mentioned: "no_number" } as const;

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
  const { pack } = useLang();
  const { say: t, ui } = pack;
  const [gate, setGate] = useState<{ state: GateState; next: NextStep }>(() => createGate(paper.terms, shuffledGateFields()));
  const [last, setLast] = useState<{ outcome: AnswerOutcome; transcript: string } | null>(null);
  const [turn, setTurn] = useState(0);

  const prompt = t.gatePrompt(gate.next, paper.terms, last?.outcome, turn === 0);
  const field = "field" in gate.next ? gate.next.field : null;
  const questionText = gate.next.kind === "follow_up" ? ui.followUp[gate.next.key] : field ? ui.gateAsk[field] : "";

  const rec = useClipRecorder((r) => {
    if (!field || gate.state.result !== "in_progress") return;
    const engineText = pack.normalize(r.transcript);
    if (isNavigationOnly(engineText)) {
      onClip(r, "navigation"); // kept as a recording, not an answer: no attempt is counted
      void say(t.navOnly);
      return;
    }
    const a = answerGate(gate.state, field, engineText);
    const answers = a.state.fields[field].answers;
    answers[answers.length - 1] = { ...answers[answers.length - 1], transcript: r.transcript }; // keep their own words
    onClip(r, field);
    cueFor(OUTCOME_STATUS[a.outcome]);
    setLast({ outcome: a.outcome, transcript: r.transcript });
    setGate({ state: a.state, next: a.next });
    setTurn((n) => n + 1);
    if (a.next.kind === "passed" || a.next.kind === "stop") onDone(a.state);
  });

  const reasonFor = (o: AnswerOutcome) => (o in OUTCOME_REASON ? ui.reason[OUTCOME_REASON[o as keyof typeof OUTCOME_REASON]] : undefined);

  return (
    <Screen instruction={prompt.text} slow={prompt.slow} playKey={turn} dots={dots} speaker="borrower">
      <Legend />
      <p className="text-base text-muted">
        {ui.numberKeywordCheck} ({GATE_LABEL})
      </p>

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
                  <span className="flex items-center gap-1" aria-label={`${ui.tries} ${tries}/${GATE_MAX_ATTEMPTS}`}>
                    {Array.from({ length: GATE_MAX_ATTEMPTS }, (_, k) => (
                      <span key={k} className={`h-2 w-2 rounded-full ${k < fs.failedAttempts ? "bg-conflict" : k < tries ? "bg-primary" : "border border-sand-edge bg-sand-dot"}`} />
                    ))}
                    <span className="text-[10px] font-semibold">
                      {ui.tries} {tries}/{GATE_MAX_ATTEMPTS}
                    </span>
                  </span>
                ) : undefined
              }
            />
          );
        })}
      </div>

      {questionText && (
        <p className="rounded-card border border-line bg-surface p-5 text-[26px] font-semibold leading-tight shadow-soft">
          {field ? FIELD_ICON[GATE_CHIP[field]] : ""} {questionText}
        </p>
      )}

      <RecordPanel speaker="borrower" {...rec} onToggle={rec.toggle} />

      {last && rec.phase === "idle" && (
        <div className={`flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-soft ${statusPresentation(OUTCOME_STATUS[last.outcome]).stripe}`}>
          <StatusBadge status={OUTCOME_STATUS[last.outcome]} big reason={reasonFor(last.outcome)} />
          <p className="rounded-chip bg-sand p-3 text-base text-muted">“{last.transcript}”</p>
        </div>
      )}
    </Screen>
  );
}
