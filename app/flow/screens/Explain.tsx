"use client";

import type { PaperInput } from "@/lib/flow/session";
import { useEffect, useMemo } from "react";
import { prefetchSpeech } from "@/lib/audio/voice";
import { useLang } from "../lang";
import { FIELD_ICON, TermCard } from "../TermCard";
import { primary, Screen } from "../ui";

const ORDER = ["loan_amount", "net_disbursed", "processing_fee", "installment", "tenure", "interest_rate", "late_fee"] as const;

export function Explain({
  dots,
  paper,
  nextSpeaker,
  onNext,
}: {
  dots: { total: number; current: number };
  paper: PaperInput;
  nextSpeaker: "agent" | "borrower";
  onNext: () => void;
}) {
  const { say, ui } = useLang().pack;
  const text = useMemo(() => say.explainPaper(paper), [paper, say]);
  useEffect(() => prefetchSpeech(say.handover[nextSpeaker]), [nextSpeaker, say]);
  const terms = ORDER.flatMap((f) => paper.terms.filter((v) => v.field === f));
  return (
    <Screen instruction={text} dots={dots}>
      {paper.lender && <p className="text-lg font-semibold text-gray-600">🏦 {paper.lender}</p>}
      <div className="flex flex-col gap-3">
        {terms.map((v) => (
          <TermCard key={v.field} v={v} />
        ))}
        {paper.missing.map((f) => (
          <div key={f} className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-gray-400 bg-gray-50 p-3 text-xl">
            <span className="text-3xl">{FIELD_ICON[f]}</span> {ui.fieldName[f]} <span className="ml-auto text-3xl">❔</span>
          </div>
        ))}
        {paper.ambiguous.map((f) => (
          <div key={f} className="flex items-center gap-2 rounded-2xl border-2 border-orange-500 bg-orange-50 p-3 text-xl">
            <span className="text-3xl">{FIELD_ICON[f]}</span> {ui.fieldName[f]} <span className="ml-auto text-3xl">⚠️❔</span>
          </div>
        ))}
      </div>
      <button className={`${primary} sticky bottom-3`} onClick={onNext}>
        {ui.next} <span className="text-4xl">▶️</span>
      </button>
    </Screen>
  );
}
