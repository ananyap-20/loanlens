"use client";

// Result: outcome of the number-and-keyword check, agent differences, the question(s) to ask the lender,
// and where to complain (lender grievance officer from the KFS, then RBI CMS). No verdict words.
import { useEffect, useMemo } from "react";
import { buzz, chime } from "@/lib/audio/cues";
import { GATE_FIELDS, GATE_LABEL, type GateState } from "@/lib/engine/gate";
import type { AgentCheck } from "@/lib/flow/agent";
import { FIELD_NAME_HI } from "@/lib/flow/scripts";
import type { PaperInput } from "@/lib/flow/session";
import { GATE_FIELD_HI, lenderQuestions, resultSpeech } from "@/lib/flow/teachback";
import { FIELD_ICON } from "../TermCard";
import { ClearButton } from "../ClearButton";
import { primary, Screen, StatusBadge } from "../ui";

export function Result({
  dots,
  paper,
  gate,
  checks,
  onReceipt,
  onClear,
}: {
  dots: { total: number; current: number };
  paper: PaperInput;
  gate: GateState;
  checks: AgentCheck[];
  onReceipt: () => void;
  onClear: () => void;
}) {
  const kind = gate.result === "passed" ? "passed" : "stopped";
  const questions = useMemo(() => lenderQuestions(paper, checks, gate.fields), [paper, checks, gate]);
  const speech = useMemo(() => resultSpeech(kind, questions, !!paper.grievance), [kind, questions, paper.grievance]);
  const latest = [...new Map(checks.map((c) => [c.field, c])).values()];

  useEffect(() => {
    if (kind === "passed") chime();
    else buzz();
  }, [kind]);

  return (
    <Screen instruction={speech} dots={dots}>
      {kind === "passed" ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-4 border-green-600 bg-green-100 p-4 text-center text-green-900">
          <span className="text-7xl">✅</span>
          <span className="text-2xl font-extrabold">समझ का सबूत, साइन के साथ</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border-4 border-red-600 bg-red-100 p-4 text-center text-red-900">
          <span className="text-7xl">✋❌</span>
          <span className="text-2xl font-extrabold">अभी साइन मत कीजिए</span>
          <span className="text-lg">किसी भरोसे वाले को साथ लाइए 🤝</span>
        </div>
      )}
      <p className="text-sm text-gray-600">
        Proof of understanding, alongside the signature — not a signature, not a loan approval. ({GATE_LABEL})
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">👩 अपने शब्दों में</h2>
        {GATE_FIELDS.map((id) => {
          const s = gate.fields[id].status;
          return (
            <div key={id} className="flex items-center justify-between gap-2 rounded-xl border-2 border-gray-200 p-2 text-lg">
              <span>{GATE_FIELD_HI[id]}</span>
              {/* pending = never asked because the check stopped earlier -> "couldn't check", not "not said" */}
              <StatusBadge status={s === "passed" ? "match" : s === "failed" ? "conflict" : "unable_to_verify"} />
            </div>
          );
        })}
      </section>

      {latest.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xl font-bold">🧑‍💼 एजेंट बनाम 📄 कागज़</h2>
          {latest.map((c) => (
            <div key={c.field} className="flex items-center justify-between gap-2 rounded-xl border-2 border-gray-200 p-2 text-lg">
              <span>
                {FIELD_ICON[c.field]} {FIELD_NAME_HI[c.field]}
              </span>
              <StatusBadge status={c.status} />
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-amber-500 bg-amber-50 p-3">
        <h2 className="text-xl font-bold">❓ लेंडर से पूछिए</h2>
        {questions.map((q) => (
          <p key={q} className="text-lg">
            • {q}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-1 rounded-2xl border-2 border-gray-300 p-3 text-lg">
        <h2 className="text-xl font-bold">📢 शिकायत</h2>
        <p>1. {paper.grievance ?? "शिकायत अधिकारी का नाम कागज़ पर नहीं मिला — लेंडर से लिखकर माँगिए।"}</p>
        <p>
          2. RBI: <span className="font-bold">cms.rbi.org.in</span>
        </p>
      </section>

      <button className={primary} onClick={onReceipt}>
        <span className="text-4xl">🧾</span> रसीद
      </button>
      <ClearButton onClear={onClear} />
    </Screen>
  );
}
