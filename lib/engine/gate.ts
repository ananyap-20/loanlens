// Teach-back gate: a deterministic NUMBER-AND-KEYWORD CHECK, per field.
// It does NOT detect "understanding"; it checks whether the borrower's own words contain the
// numbers on the paper (or, for a missed payment, a consequence keyword). Rules (CONTEXT.md):
//
// - Required fields: amount in hand (net_disbursed OR loan_amount), instalment amount AND frequency,
//   processing fee, consequence of a missed payment (late-fee amount or a keyword).
// - A field passes when the spoken number equals the paper value (and the frequency matches).
// - A WRONG number (or "pata nahi") fails that field only: re-explain it slowly (0.85) and ask again.
// - NOT MENTIONED is not a fail: ask a specific follow-up. (After 2 follow-ups in a row with still
//   nothing said, it counts as one failed attempt, so the flow can never loop forever.)
// - Max 3 failed attempts per field. Gate passes only when every required field passes.
//   A field failing 3 times stops the gate: "Abhi sign mat kijiye. Kisi bharose wale ko saath laiye."
// - A field the paper does not state is "not_on_paper" and not asked (we never invent paper values).

import { detectFrequency, extractClaims, hasConsequenceKeyword, isUncertain } from "./extractClaims";
import { plausibility } from "./plausibility";
import type { Field, Value } from "./types";

export const GATE_LABEL = "number-and-keyword check";
export const GATE_MAX_ATTEMPTS = 3;
export const GATE_MAX_FOLLOW_UPS = 2;
export const SLOW_SPEED = 0.85;
export const STOP_MESSAGE = "Abhi sign mat kijiye. Kisi bharose wale ko saath laiye.";

export type GateFieldId = "amount_in_hand" | "installment" | "processing_fee" | "missed_payment";
export const GATE_FIELDS: readonly GateFieldId[] = ["amount_in_hand", "installment", "processing_fee", "missed_payment"];

export const FOLLOW_UP_QUESTIONS = {
  amount_in_hand: "Aapke haath mein kitne rupaye aayenge?",
  installment_amount: "Kisht kitne rupaye ki hai?",
  installment_frequency: "Kisht har mahine deni hai ya har hafte?",
  processing_fee: "Processing fee kitni hai?",
  missed_payment: "Agar ek kisht na de paayein toh kya hoga?",
} as const;
export type FollowUpKey = keyof typeof FOLLOW_UP_QUESTIONS;

// "implausible" = a number that cannot be a sensible answer (plausibility guard): asked again like a follow-up,
// never counted as a wrong number.
export type AnswerOutcome = "pass" | "wrong" | "uncertain" | "not_mentioned" | "implausible";
export type GateFieldStatus = "pending" | "passed" | "failed" | "not_on_paper";

export type GateFieldState = {
  id: GateFieldId;
  status: GateFieldStatus;
  failedAttempts: number;
  followUps: number; // consecutive "not mentioned" answers
  amountOk: boolean; // instalment: amount already said correctly
  frequencyOk: boolean; // instalment: frequency already said correctly
  answers: { transcript: string; outcome: AnswerOutcome }[];
};

export type GateState = {
  order: GateFieldId[];
  fields: Record<GateFieldId, GateFieldState>;
  result: "in_progress" | "passed" | "stopped";
  paper: Value[];
};

export type NextStep =
  | { kind: "ask"; field: GateFieldId }
  | { kind: "follow_up"; field: GateFieldId; key: FollowUpKey; text: string }
  | { kind: "re_explain_and_ask"; field: GateFieldId; speed: number }
  | { kind: "passed" }
  | { kind: "stop"; field: GateFieldId; message: string };

const paperValue = (paper: Value[], field: Field) => paper.find((v) => v.field === field && v.source === "paper");
const paperAmount = (paper: Value[], field: Field) => paperValue(paper, field)?.amount;

/** Random question order (Fisher–Yates). Pass a seeded `random` for repeatable tests. */
export function shuffledGateFields(random: () => number = Math.random): GateFieldId[] {
  const a = [...GATE_FIELDS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function onPaper(id: GateFieldId, paper: Value[]): boolean {
  switch (id) {
    case "amount_in_hand":
      return paperAmount(paper, "net_disbursed") !== undefined || paperAmount(paper, "loan_amount") !== undefined;
    case "installment":
      return paperAmount(paper, "installment") !== undefined;
    case "processing_fee":
      return paperAmount(paper, "processing_fee") !== undefined;
    case "missed_payment":
      return true; // keyword path works even if the paper has no late-fee amount
  }
}

function nextPending(state: GateState): NextStep {
  const id = state.order.find((f) => state.fields[f].status === "pending");
  if (!id) {
    state.result = "passed";
    return { kind: "passed" };
  }
  return { kind: "ask", field: id };
}

export function createGate(paper: Value[], order: readonly GateFieldId[] = GATE_FIELDS): { state: GateState; next: NextStep } {
  const fields = {} as Record<GateFieldId, GateFieldState>;
  for (const id of GATE_FIELDS) {
    fields[id] = {
      id,
      status: onPaper(id, paper) ? "pending" : "not_on_paper",
      failedAttempts: 0,
      followUps: 0,
      amountOk: false,
      frequencyOk: false,
      answers: [],
    };
  }
  const state: GateState = { order: [...order], fields, result: "in_progress", paper };
  return { state, next: nextPending(state) };
}

type Evaluation = { outcome: AnswerOutcome; amountOk?: boolean; frequencyOk?: boolean };

const usable = (v: Value) => v.amount !== undefined && v.confidence !== "low";

function evaluate(fs: GateFieldState, transcript: string, paper: Value[]): Evaluation {
  const unsure = () => isUncertain(transcript);

  switch (fs.id) {
    case "amount_in_hand": {
      const targets = [paperAmount(paper, "net_disbursed"), paperAmount(paper, "loan_amount")].filter(
        (x): x is number => x !== undefined,
      );
      const vals = extractClaims(transcript, "net_disbursed", "borrower").filter(
        (v) => v.field === "net_disbursed" || v.field === "loan_amount",
      );
      const usableVals = vals.filter((v) => usable(v) && !v.negated);
      const ok = usableVals.filter((v) => plausibility(v, paper, ["net_disbursed", "loan_amount"]) === "ok");
      if (ok.length) return { outcome: ok.some((v) => targets.includes(v.amount as number)) ? "pass" : "wrong" };
      if (usableVals.length) return { outcome: "implausible" };
      return { outcome: vals.length || unsure() ? "uncertain" : "not_mentioned" };
    }

    case "processing_fee": {
      const target = paperAmount(paper, "processing_fee");
      const vals = extractClaims(transcript, "processing_fee", "borrower").filter((v) => v.field === "processing_fee");
      const usableVals = vals.filter(usable);
      const ok = usableVals.filter((v) => plausibility(v, paper) === "ok");
      if (ok.length) return { outcome: ok.every((v) => v.amount === target) ? "pass" : "wrong" };
      if (usableVals.length) return { outcome: "implausible" };
      return { outcome: vals.length || unsure() ? "uncertain" : "not_mentioned" };
    }

    case "installment": {
      const p = paperValue(paper, "installment")!;
      const vals = extractClaims(transcript, "installment", "borrower").filter((v) => v.field === "installment");
      const usableVals = vals.filter((v) => usable(v) && !v.negated);
      const ok = usableVals.filter((v) => plausibility(v, paper) === "ok");
      const freq = detectFrequency(transcript);
      let amountOk = fs.amountOk;
      let frequencyOk = p.frequency ? fs.frequencyOk : true; // paper has no frequency -> cannot require it
      let wrong = false;
      let said = false;
      if (ok.length) {
        said = true;
        if (ok.every((v) => v.amount === p.amount)) amountOk = true;
        else {
          wrong = true;
          amountOk = false;
        }
      }
      if (p.frequency && freq) {
        said = true;
        if (freq === p.frequency) frequencyOk = true;
        else {
          wrong = true;
          frequencyOk = false;
        }
      }
      if (wrong) return { outcome: "wrong", amountOk, frequencyOk };
      if (amountOk && frequencyOk) return { outcome: "pass", amountOk, frequencyOk };
      if (!said && usableVals.length) return { outcome: "implausible", amountOk, frequencyOk };
      if (!said && (vals.length || unsure())) return { outcome: "uncertain", amountOk, frequencyOk };
      return { outcome: "not_mentioned", amountOk, frequencyOk };
    }

    case "missed_payment": {
      const target = paperAmount(paper, "late_fee");
      const vals = extractClaims(transcript, "late_fee", "borrower").filter((v) => v.field === "late_fee");
      const usableVals = vals.filter(usable);
      const ok = usableVals.filter((v) => plausibility(v, paper) === "ok");
      if (target !== undefined && target > 0 && ok.some((v) => v.negated)) return { outcome: "wrong" }; // "koi late fee nahi"
      if (target !== undefined && ok.some((v) => !v.negated && v.amount !== target)) return { outcome: "wrong" };
      if (ok.some((v) => v.amount === target) || hasConsequenceKeyword(transcript)) return { outcome: "pass" };
      if (usableVals.length) return { outcome: "implausible" };
      return { outcome: vals.length || unsure() ? "uncertain" : "not_mentioned" };
    }
  }
}

function followUpKey(fs: GateFieldState): FollowUpKey {
  if (fs.id === "installment") return fs.amountOk ? "installment_frequency" : "installment_amount";
  return fs.id;
}

/** Record the borrower's answer for `field` and decide what happens next. Pure: returns a new state. */
export function answerGate(
  prev: GateState,
  field: GateFieldId,
  transcript: string,
): { state: GateState; outcome: AnswerOutcome; next: NextStep } {
  if (prev.result !== "in_progress") throw new Error(`Gate is already ${prev.result}`);
  if (prev.fields[field].status !== "pending") throw new Error(`Field ${field} is ${prev.fields[field].status}`);

  const state: GateState = structuredClone(prev);
  const fs = state.fields[field];
  const ev = evaluate(fs, transcript, state.paper);
  if (ev.amountOk !== undefined) fs.amountOk = ev.amountOk;
  if (ev.frequencyOk !== undefined) fs.frequencyOk = ev.frequencyOk;
  fs.answers.push({ transcript, outcome: ev.outcome });

  const fail = (): NextStep => {
    fs.failedAttempts++;
    fs.followUps = 0;
    if (fs.failedAttempts >= GATE_MAX_ATTEMPTS) {
      fs.status = "failed";
      state.result = "stopped";
      return { kind: "stop", field, message: STOP_MESSAGE };
    }
    return { kind: "re_explain_and_ask", field, speed: SLOW_SPEED };
  };

  let next: NextStep;
  switch (ev.outcome) {
    case "pass":
      fs.status = "passed";
      fs.followUps = 0;
      next = nextPending(state);
      break;
    case "wrong":
    case "uncertain":
      next = fail();
      break;
    case "not_mentioned":
    case "implausible":
      fs.followUps++;
      if (fs.followUps > GATE_MAX_FOLLOW_UPS) next = fail();
      else {
        const key = followUpKey(fs);
        next = { kind: "follow_up", field, key, text: FOLLOW_UP_QUESTIONS[key] };
      }
      break;
  }
  return { state, outcome: ev.outcome, next };
}
