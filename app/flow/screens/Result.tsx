"use client";

// Result: outcome of the number-and-keyword check, agent differences, the question(s) to ask the lender,
// and where to complain (lender grievance officer from the KFS, then RBI CMS). No verdict words.
import { useEffect, useMemo } from "react";
import { buzz, chime } from "@/lib/audio/cues";
import { GATE_FIELDS, GATE_LABEL, type GateState } from "@/lib/engine/gate";
import { agentChangedEarlier, type AgentCheck } from "@/lib/flow/agent";
import type { PaperInput } from "@/lib/flow/session";
import { statusPresentation } from "@/lib/flow/statusPresentation";
import { ClearButton } from "../ClearButton";
import { useLang } from "../lang";
import { FIELD_ICON } from "../TermCard";
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
  const { say: t, ui } = useLang().pack;
  const kind = gate.result === "passed" ? "passed" : "stopped";
  const questions = useMemo(() => t.lenderQuestions(paper, checks, gate.fields), [paper, checks, gate, t]);
  const speech = useMemo(() => t.resultSpeech(kind, questions, !!paper.grievance), [kind, questions, paper.grievance, t]);
  const latest = [...new Map(checks.map((c) => [c.field, c])).values()];

  useEffect(() => {
    if (kind === "passed") chime();
    else buzz();
  }, [kind]);

  return (
    <Screen instruction={speech} dots={dots}>
      {kind === "passed" ? (
        <div className="flex flex-col items-center gap-2 rounded-card border-2 border-match bg-match-soft p-5 text-center text-match shadow-soft">
          <span className="text-7xl">✅</span>
          <span className="text-2xl font-semibold leading-tight">{ui.proofTitle}</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-card border-2 border-conflict bg-conflict-soft p-5 text-center text-conflict shadow-soft">
          <span className="text-7xl">✋❌</span>
          <span className="text-2xl font-semibold leading-tight">{ui.dontSign}</span>
          <span className="text-lg text-ink">{ui.bringTrusted}</span>
        </div>
      )}
      <p className="text-sm text-muted">
        Proof of understanding, alongside the signature — not a signature, not a loan approval. ({GATE_LABEL})
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">{ui.ownWords}</h2>
        {GATE_FIELDS.map((id) => {
          const s = gate.fields[id].status;
          return (
            <div key={id} className={`flex items-center justify-between gap-2 rounded-chip border border-line bg-surface p-3 text-lg shadow-soft ${statusPresentation(s === "passed" ? "match" : s === "failed" ? "conflict" : "unable_to_verify").stripe}`}>
              <span>{ui.gateFieldName[id]}</span>
              {/* pending = never asked because the check stopped earlier -> "couldn't check", not "not said" */}
              <StatusBadge status={s === "passed" ? "match" : s === "failed" ? "conflict" : "unable_to_verify"} />
            </div>
          );
        })}
      </section>

      {latest.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">{ui.agentVsPaper}</h2>
          {latest.map((c) => (
            <div key={c.field} className={`flex items-center justify-between gap-2 rounded-chip border border-line bg-surface p-3 text-lg shadow-soft ${statusPresentation(c.status).stripe}`}>
              <span>
                {FIELD_ICON[c.field]} {ui.fieldName[c.field]}
              </span>
              <span className="flex flex-col items-end gap-1">
                <StatusBadge status={c.status} />
                {agentChangedEarlier(checks, c.field) && <span className="text-base font-semibold text-amber-800">⚠️ {ui.agentChanged}</span>}
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2 rounded-card border-2 border-amber-500 bg-amber-50 p-5">
        <h2 className="text-xl font-semibold">{ui.askLender}</h2>
        {questions.map((q) => (
          <p key={q} className="text-lg">
            • {q}
          </p>
        ))}
      </section>

      <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5 text-lg shadow-soft">
        <h2 className="text-xl font-semibold">{ui.complaint}</h2>
        <p>1. {paper.grievance ?? ui.grievanceMissing}</p>
        <p>
          2. RBI: <span className="font-bold">cms.rbi.org.in</span>
        </p>
      </section>

      <button className={primary} onClick={onReceipt}>
        <span className="text-4xl">🧾</span> {ui.receiptBtn}
      </button>
      <ClearButton onClear={onClear} />
    </Screen>
  );
}
