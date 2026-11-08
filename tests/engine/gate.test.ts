import { describe, expect, it } from "vitest";
import {
  answerGate,
  createGate,
  GATE_FIELDS,
  GATE_LABEL,
  GATE_MAX_ATTEMPTS,
  shuffledGateFields,
  SLOW_SPEED,
  STOP_MESSAGE,
  type GateFieldId,
  type GateState,
} from "@/lib/engine/gate";
import { paperWithout, SAMPLE_PAPER } from "../fixtures/paper";

/** Answers in sequence, returning the last result. */
function run(state: GateState, answers: [GateFieldId, string][]) {
  let s = state;
  let last: ReturnType<typeof answerGate> | undefined;
  for (const [f, t] of answers) {
    last = answerGate(s, f, t);
    s = last.state;
  }
  return last!;
}

const CORRECT: Record<GateFieldId, string> = {
  amount_in_hand: "मेरे हाथ में 28,500 रुपये आएंगे",
  installment: "हर महीने 2,666 रुपये की किस्त देनी है",
  processing_fee: "processing fee 1500 rupaye hai",
  missed_payment: "agar kisht nahi di toh 200 rupaye late fee lagegi",
};

describe("gate: labelling", () => {
  it("is called a number-and-keyword check", () => {
    expect(GATE_LABEL).toBe("number-and-keyword check");
    expect(GATE_MAX_ATTEMPTS).toBe(3);
    expect(SLOW_SPEED).toBe(0.85);
  });
});

describe("gate: all correct", () => {
  it("passes when every required field passes", () => {
    const { state, next } = createGate(SAMPLE_PAPER);
    expect(next).toEqual({ kind: "ask", field: "amount_in_hand" });
    let s = state;
    for (const f of GATE_FIELDS) {
      const r = answerGate(s, f, CORRECT[f]);
      expect(r.outcome, f).toBe("pass");
      s = r.state;
    }
    expect(s.result).toBe("passed");
    expect(Object.values(s.fields).every((f) => f.status === "passed" && f.failedAttempts === 0)).toBe(true);
  });

  it("asks the next field after a pass", () => {
    const { state } = createGate(SAMPLE_PAPER);
    expect(answerGate(state, "amount_in_hand", CORRECT.amount_in_hand).next).toEqual({ kind: "ask", field: "installment" });
  });

  it("amount in hand accepts the loan amount too (net_disbursed OR loan_amount)", () => {
    const { state } = createGate(SAMPLE_PAPER);
    expect(answerGate(state, "amount_in_hand", "30,000 ka loan hai").outcome).toBe("pass");
  });

  it("works in any question order", () => {
    const order = shuffledGateFields(() => 0.1);
    expect([...order].sort()).toEqual([...GATE_FIELDS].sort());
    const { state, next } = createGate(SAMPLE_PAPER, order);
    expect(next).toEqual({ kind: "ask", field: order[0] });
    const last = run(state, order.map((f) => [f, CORRECT[f]] as [GateFieldId, string]));
    expect(last.next).toEqual({ kind: "passed" });
  });
});

describe("gate: one wrong number", () => {
  it("fails only that field, re-explains slowly, then passes", () => {
    const { state } = createGate(SAMPLE_PAPER);
    const r1 = answerGate(state, "processing_fee", "processing fee 1000 hai");
    expect(r1.outcome).toBe("wrong");
    expect(r1.next).toEqual({ kind: "re_explain_and_ask", field: "processing_fee", speed: 0.85 });
    expect(r1.state.fields.processing_fee.failedAttempts).toBe(1);
    expect(r1.state.fields.amount_in_hand.status).toBe("pending"); // other fields untouched
    const r2 = answerGate(r1.state, "processing_fee", "pandrah sau rupaye");
    expect(r2.outcome).toBe("pass");
    expect(r2.state.fields.processing_fee.status).toBe("passed");
  });

  it("'nahi' for a ₹1,500 fee is a wrong answer", () => {
    expect(answerGate(createGate(SAMPLE_PAPER).state, "processing_fee", "koi processing fee nahi").outcome).toBe("wrong");
  });

  it("a wrong amount in hand fails", () => {
    expect(answerGate(createGate(SAMPLE_PAPER).state, "amount_in_hand", "haath mein 25,000").outcome).toBe("wrong");
  });

  it("does not leak: the original state is unchanged", () => {
    const { state } = createGate(SAMPLE_PAPER);
    answerGate(state, "processing_fee", "1000");
    expect(state.fields.processing_fee.failedAttempts).toBe(0);
  });
});

describe("gate: one missing then answered", () => {
  it("not mentioned is not a fail: ask a specific follow-up", () => {
    const { state } = createGate(SAMPLE_PAPER);
    const r1 = answerGate(state, "processing_fee", "haan ji sab samajh gayi");
    expect(r1.outcome).toBe("not_mentioned");
    expect(r1.next).toEqual({ kind: "follow_up", field: "processing_fee", key: "processing_fee", text: "Processing fee kitni hai?" });
    expect(r1.state.fields.processing_fee.failedAttempts).toBe(0);
    const r2 = answerGate(r1.state, "processing_fee", "pandrah sau");
    expect(r2.outcome).toBe("pass");
    expect(r2.state.fields.processing_fee.failedAttempts).toBe(0);
  });

  it("instalment: amount first, frequency asked as a follow-up", () => {
    const { state } = createGate(SAMPLE_PAPER);
    const r1 = answerGate(state, "installment", "kisht 2666 rupaye ki");
    expect(r1.outcome).toBe("not_mentioned");
    expect(r1.next).toMatchObject({ kind: "follow_up", key: "installment_frequency" });
    const r2 = answerGate(r1.state, "installment", "har mahine");
    expect(r2.outcome).toBe("pass");
  });

  it("instalment: frequency first, amount asked as a follow-up", () => {
    const r1 = answerGate(createGate(SAMPLE_PAPER).state, "installment", "har mahine deni hai");
    expect(r1.next).toMatchObject({ kind: "follow_up", key: "installment_amount", text: "Kisht kitne rupaye ki hai?" });
  });

  it("missed payment passes on a keyword alone", () => {
    for (const t of ["jurmana lagega", "penalty lagegi", "extra lagega", "late fee deni padegi"]) {
      expect(answerGate(createGate(SAMPLE_PAPER).state, "missed_payment", t).outcome, t).toBe("pass");
    }
  });

  it("endless 'not mentioned' becomes a failed attempt after 2 follow-ups", () => {
    const { state } = createGate(SAMPLE_PAPER);
    const r = run(state, [
      ["processing_fee", "haan"],
      ["processing_fee", "theek hai"],
      ["processing_fee", "ji"],
    ]);
    expect(r.next).toEqual({ kind: "re_explain_and_ask", field: "processing_fee", speed: 0.85 });
    expect(r.state.fields.processing_fee.failedAttempts).toBe(1);
  });
});

describe("gate: weekly vs monthly mismatch", () => {
  it("right amount, wrong frequency -> wrong", () => {
    const r = answerGate(createGate(SAMPLE_PAPER).state, "installment", "2666 har hafte");
    expect(r.outcome).toBe("wrong");
    expect(r.next).toMatchObject({ kind: "re_explain_and_ask", speed: 0.85 });
    expect(r.state.fields.installment.frequencyOk).toBe(false);
  });
});

describe("gate: 3 failed attempts", () => {
  it("stops with 'Abhi sign mat kijiye...' after the third failure, not before", () => {
    const { state } = createGate(SAMPLE_PAPER);
    const r2 = run(state, [
      ["processing_fee", "koi processing fee nahi"],
      ["processing_fee", "1000"],
    ]);
    expect(r2.next.kind).toBe("re_explain_and_ask");
    const r3 = answerGate(r2.state, "processing_fee", "pata nahi");
    expect(r3.outcome).toBe("uncertain");
    expect(r3.next).toEqual({ kind: "stop", field: "processing_fee", message: STOP_MESSAGE });
    expect(STOP_MESSAGE).toBe("Abhi sign mat kijiye. Kisi bharose wale ko saath laiye.");
    expect(r3.state.result).toBe("stopped");
    expect(r3.state.fields.processing_fee.status).toBe("failed");
    expect(() => answerGate(r3.state, "amount_in_hand", CORRECT.amount_in_hand)).toThrow();
  });

  it("'pata nahi' counts as a failed attempt", () => {
    const r = answerGate(createGate(SAMPLE_PAPER).state, "processing_fee", "pata nahi");
    expect(r.outcome).toBe("uncertain");
    expect(r.state.fields.processing_fee.failedAttempts).toBe(1);
  });
});

describe("gate: missed payment", () => {
  it("wrong late-fee amount fails; 'koi late fee nahi' fails", () => {
    expect(answerGate(createGate(SAMPLE_PAPER).state, "missed_payment", "late fee 500 lagegi").outcome).toBe("wrong");
    expect(answerGate(createGate(SAMPLE_PAPER).state, "missed_payment", "koi late fee nahi").outcome).toBe("wrong");
  });
  it("'kuch nahi hoga' (nothing will happen) is a wrong answer, never a pass", () => {
    expect(answerGate(createGate(SAMPLE_PAPER).state, "missed_payment", "kuch nahi hoga").outcome).toBe("wrong");
  });
  it("an answer that does not address it is not mentioned", () => {
    expect(answerGate(createGate(SAMPLE_PAPER).state, "missed_payment", "haan ji samajh gayi").outcome).toBe("not_mentioned");
  });
});

describe("gate: fields missing from the paper", () => {
  it("are not asked and do not block the gate", () => {
    const { state, next } = createGate(paperWithout("processing_fee"));
    expect(state.fields.processing_fee.status).toBe("not_on_paper");
    expect(next).toEqual({ kind: "ask", field: "amount_in_hand" });
    const last = run(state, [
      ["amount_in_hand", CORRECT.amount_in_hand],
      ["installment", CORRECT.installment],
      ["missed_payment", CORRECT.missed_payment],
    ]);
    expect(last.next).toEqual({ kind: "passed" });
  });
});
