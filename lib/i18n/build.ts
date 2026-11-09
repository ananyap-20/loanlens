// Builds a pack's spoken templates from its phrases. The control logic mirrors the Hindi functions in
// lib/flow (scripts.ts, agent.ts, teachback.ts) exactly; only the words differ. Pure and tested.
import type { AnswerOutcome, FollowUpKey, GateFieldId, GateFieldStatus, NextStep } from "@/lib/engine/gate";
import type { VerifyReason } from "@/lib/engine";
import type { Field, Value } from "@/lib/engine/types";
import type { AgentCheck, AgentField } from "@/lib/flow/agent";
import type { PaperFacts } from "@/lib/flow/scripts";
import type { PaperFailure } from "@/lib/paper/terms";
import type { SpokenTemplates } from "./types";

export type Phrases = {
  /** spoken value, numbers already as words */
  value: (v: Value) => string;
  /** field names as used inside a sentence */
  fieldName: Record<Field, string>;
  fixed: Omit<
    SpokenTemplates,
    "explainPaper" | "agentFlag" | "gatePrompt" | "lenderQuestions" | "resultSpeech" | "paperFail" | "handover" | "agentAsk"
  >;
  paperFail: Record<PaperFailure, string>;
  handover: { agent: string; borrower: string };
  agentAsk: Record<AgentField, string>;
  explain: {
    intro: string;
    loan: (v: string) => string;
    net: (v: string) => string;
    notFullLoan: (loan: string) => string;
    fee: (v: string) => string;
    feeZero: string;
    installment: (v: string) => string;
    tenure: (v: string) => string;
    rate: (v: string) => string;
    late: (v: string) => string;
    missing: (list: string) => string;
    ambiguous: (name: string) => string;
    outro: string;
    and: string;
  };
  flag: {
    match: (name: string) => string;
    conflictNegated: (name: string, paper: string) => string;
    conflict: (name: string, said: string, paper: string) => string;
    notMentioned: (name: string) => string;
    reason: (name: string, reason: string) => string;
    unableWithPaper: (name: string, paper: string) => string;
    notOnPaper: (name: string) => string;
  };
  reason: Record<VerifyReason, string>;
  gate: {
    ask: Record<GateFieldId, string>;
    followUp: Record<FollowUpKey, string>;
    matched: string;
    stop: string;
    notMatched: string;
    noProblem: string;
    listen: string;
    tellAgain: string;
    implausible: string;
    reExplain: {
      net: (v: string) => string;
      loan: (v: string) => string;
      installment: (v: string) => string;
      fee: (v: string) => string;
      late: (v: string) => string;
      noLate: string;
    };
  };
  gateFieldName: Record<GateFieldId, string>;
  lender: {
    conflict: (name: string, negated: boolean, said: string, paper: string) => string;
    missing: (name: string) => string;
    ambiguous: (name: string) => string;
    gateFailed: (name: string) => string;
    none: string;
  };
  result: {
    passed: string;
    stoppedExtra: string;
    ask: (questions: string) => string;
    grievanceOnPaper: string;
    grievanceNotOnPaper: string;
  };
};

const IMPORTANT: Field[] = ["loan_amount", "net_disbursed", "installment", "processing_fee", "late_fee"];
const get = (terms: Value[], f: Field) => terms.find((v) => v.field === f && v.amount !== undefined);
const getPaper = (paper: Value[], f: Field) => paper.find((v) => v.field === f && v.source === "paper" && v.amount !== undefined);

export function buildSay(p: Phrases): SpokenTemplates {
  const list = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ${p.explain.and} ${names.at(-1)}`);

  function explainPaper(f: PaperFacts): string {
    const s = [p.explain.intro];
    const loan = get(f.terms, "loan_amount");
    const net = get(f.terms, "net_disbursed");
    const fee = get(f.terms, "processing_fee");
    const inst = get(f.terms, "installment");
    const tenure = get(f.terms, "tenure");
    const rate = get(f.terms, "interest_rate");
    const late = get(f.terms, "late_fee");
    if (loan) s.push(p.explain.loan(p.value(loan)));
    if (net) {
      s.push(p.explain.net(p.value(net)));
      if (loan && net.unit === "INR" && loan.unit === "INR" && (net.amount as number) < (loan.amount as number)) s.push(p.explain.notFullLoan(p.value(loan)));
    }
    if (fee) s.push(fee.amount === 0 ? p.explain.feeZero : p.explain.fee(p.value(fee)));
    if (inst) s.push(p.explain.installment(p.value(inst)));
    if (tenure) s.push(p.explain.tenure(p.value(tenure)));
    if (rate) s.push(p.explain.rate(p.value(rate)));
    if (late) s.push(p.explain.late(p.value(late)));
    if (f.missing.length) s.push(p.explain.missing(list(f.missing.map((x) => p.fieldName[x]))));
    for (const x of f.ambiguous) s.push(p.explain.ambiguous(p.fieldName[x]));
    s.push(p.explain.outro);
    return s.join(" ");
  }

  function agentFlag(c: AgentCheck): string {
    const name = p.fieldName[c.field];
    const paperSay = c.paper && c.paper.amount !== undefined ? p.value(c.paper) : undefined;
    switch (c.status) {
      case "match":
        return p.flag.match(name);
      case "conflict": {
        const s = c.spoken[0];
        return s.negated ? p.flag.conflictNegated(name, paperSay ?? "") : p.flag.conflict(name, p.value(s), paperSay ?? "");
      }
      case "not_mentioned":
        return p.flag.notMentioned(name);
      case "unable_to_verify":
        if (c.reason && c.reason !== "not_on_paper" && c.reason !== "rate_basis" && c.reason !== "unit_or_frequency") {
          return p.flag.reason(name, p.reason[c.reason].replace(" — ", ". "));
        }
        return paperSay ? p.flag.unableWithPaper(name, paperSay) : p.flag.notOnPaper(name);
    }
  }

  function reExplain(field: GateFieldId, paper: Value[]): string {
    const r = p.gate.reExplain;
    switch (field) {
      case "amount_in_hand": {
        const net = getPaper(paper, "net_disbursed");
        return net ? r.net(p.value(net)) : r.loan(p.value(getPaper(paper, "loan_amount")!));
      }
      case "installment":
        return r.installment(p.value(getPaper(paper, "installment")!));
      case "processing_fee":
        return r.fee(p.value(getPaper(paper, "processing_fee")!));
      case "missed_payment": {
        const late = getPaper(paper, "late_fee");
        return late ? r.late(p.value(late)) : r.noLate;
      }
    }
  }

  function gatePrompt(next: NextStep, paper: Value[], last?: AnswerOutcome, first = false) {
    const g = p.gate;
    switch (next.kind) {
      case "ask":
        return { text: (first ? `${p.fixed.teachbackIntro} ` : last === "pass" ? `${g.matched} ` : "") + g.ask[next.field], slow: false };
      case "follow_up":
        return { text: (last === "implausible" ? `${g.implausible} ` : "") + g.followUp[next.key], slow: false };
      case "re_explain_and_ask":
        return {
          text: `${last === "uncertain" ? g.noProblem : g.notMatched} ${g.listen} ${reExplain(next.field, paper)} ${g.tellAgain} ${g.ask[next.field]}`,
          slow: true,
        };
      case "passed":
        return { text: g.matched, slow: false };
      case "stop":
        return { text: g.stop, slow: true };
    }
  }

  function lenderQuestions(f: PaperFacts, checks: AgentCheck[] = [], gateFields?: Record<GateFieldId, { status: GateFieldStatus }>): string[] {
    const q: string[] = [];
    const latest = new Map<string, AgentCheck>();
    for (const c of checks) latest.set(c.field, c);
    for (const c of latest.values()) {
      if (c.status !== "conflict" || !c.paper) continue;
      const s = c.spoken[0];
      q.push(p.lender.conflict(p.fieldName[c.field], !!s.negated, s.negated ? "" : p.value(s), p.value(c.paper)));
    }
    for (const x of f.missing) if (IMPORTANT.includes(x)) q.push(p.lender.missing(p.fieldName[x]));
    for (const x of f.ambiguous) q.push(p.lender.ambiguous(p.fieldName[x]));
    if (gateFields) {
      for (const [id, fs] of Object.entries(gateFields) as [GateFieldId, { status: GateFieldStatus }][]) {
        if (fs.status === "failed") q.push(p.lender.gateFailed(p.gateFieldName[id]));
      }
    }
    if (q.length === 0) q.push(p.lender.none);
    return q;
  }

  function resultSpeech(kind: "passed" | "stopped", questions: string[], grievanceOnPaper: boolean): string {
    return [
      kind === "passed" ? p.result.passed : `${p.gate.stop} ${p.result.stoppedExtra}`,
      p.result.ask(questions.slice(0, 3).join(" ")),
      grievanceOnPaper ? p.result.grievanceOnPaper : p.result.grievanceNotOnPaper,
    ].join(" ");
  }

  return {
    ...p.fixed,
    paperFail: p.paperFail,
    explainPaper,
    handover: p.handover,
    agentAsk: p.agentAsk,
    agentFlag,
    gatePrompt,
    lenderQuestions,
    resultSpeech,
  };
}
