// Phone-test fixes: plausibility guard, consequence keywords, navigation words, agent changed answers.
import { describe, expect, it } from "vitest";
import { answerGate, createGate } from "@/lib/engine/gate";
import { compareField, extractClaims, hasConsequenceKeyword, isNavigationOnly, plausibility } from "@/lib/engine";
import { agentChangedEarlier, checkAgentClip, AGENT_CHANGED_HI } from "@/lib/flow/agent";
import { gatePrompt, lenderQuestions } from "@/lib/flow/teachback";
import { SAMPLE_PAPER } from "../fixtures/paper";

const facts = { terms: SAMPLE_PAPER, missing: [], ambiguous: [] };
const agent = (field: Parameters<typeof checkAgentClip>[0], t: string) => checkAgentClip(field, t, SAMPLE_PAPER);

describe("C1 plausibility guard", () => {
  it("an INR amount below 20% of the paper is 'couldn't check — say it again', not a difference", () => {
    const c = agent("processing_fee", "processing fee 5 rupaye"); // 5 vs ₹1,500
    expect(c.status).toBe("unable_to_verify");
    expect(c.reason).toBe("implausible");
    expect(c.flag).toContain("फिर से बोलिए");
  });

  it("an INR amount above 500% of the paper is implausible too", () => {
    expect(agent("late_fee", "late fee 5000 rupaye").reason).toBe("implausible"); // 5000 vs ₹200
  });

  it("inside 20%–500% a different number is still a real difference", () => {
    expect(agent("processing_fee", "processing fee 500 rupaye").status).toBe("conflict"); // 33%
    expect(agent("installment", "EMI 2500 har mahine").status).toBe("conflict");
  });

  it("a bare '12' answered for the loan amount matches another field (tenure) -> implausible", () => {
    const c = agent("loan_amount", "12");
    expect(c.status).toBe("unable_to_verify");
    expect(c.reason).toBe("implausible");
  });

  it("'nahi' / zero for a fee is never implausible: the demo conflict stays", () => {
    expect(agent("processing_fee", "processing fee नहीं लगेगी").status).toBe("conflict");
  });

  it("the bare-number rule does not fire with a currency word or this field's word", () => {
    const [v] = extractClaims("loan 12 ka", "loan_amount", "agent");
    expect(plausibility({ ...v, amount: 12 }, SAMPLE_PAPER)).not.toBe("other_field");
  });

  it("implausible values never become a question for the lender", () => {
    const q = lenderQuestions(facts, [agent("processing_fee", "processing fee 5 rupaye"), agent("late_fee", "late fee 5000")]);
    expect(q).toEqual(["कुल मिलाकर मुझे कितना चुकाना होगा? लिखकर दीजिए।"]);
  });

  it("compareField reports a reason for every 'couldn't check'", () => {
    expect(compareField("processing_fee", [], extractClaims("fee 1500", "processing_fee")).reason).toBe("not_on_paper");
    expect(compareField("processing_fee", SAMPLE_PAPER, extractClaims("fee pata nahi", "processing_fee")).reason).toBe("uncertain");
    expect(compareField("installment", SAMPLE_PAPER, extractClaims("EMI 2666 har hafte", "installment")).reason).toBe("unit_or_frequency");
  });

  it("teach-back: an implausible number is asked again (no failed attempt)", () => {
    const r = answerGate(createGate(SAMPLE_PAPER, ["processing_fee"]).state, "processing_fee", "processing fee 5 rupaye");
    expect(r.outcome).toBe("implausible");
    expect(r.state.fields.processing_fee.failedAttempts).toBe(0);
    expect(r.next.kind).toBe("follow_up");
    expect(gatePrompt(r.next, SAMPLE_PAPER, "implausible").text).toContain("फिर से बोलिए");
  });

  it("teach-back: amount in hand accepts the loan amount said without 'rupees'", () => {
    const r = answerGate(createGate(SAMPLE_PAPER, ["amount_in_hand"]).state, "amount_in_hand", "30,000");
    expect(r.outcome).toBe("pass");
  });
});

describe("C2 consequence keywords", () => {
  it.each(["fine lagega", "फाइन लगेगा", "penalty", "पेनल्टी", "jurmana", "जुर्माना", "charge lagega", "चार्ज", "extra dena padega", "late ho jayega", "लेट", "dand", "दंड"])(
    "'%s' counts as a consequence",
    (t) => expect(hasConsequenceKeyword(t)).toBe(true),
  );
  it("a keyword alone passes the missed-payment question", () => {
    expect(answerGate(createGate(SAMPLE_PAPER, ["missed_payment"]).state, "missed_payment", "fine lagega").outcome).toBe("pass");
  });
  it("'kuch nahi hoga' is still not a pass", () => {
    expect(hasConsequenceKeyword("kuch nahi hoga")).toBe(false);
  });
});

describe("C3 navigation words are not an answer", () => {
  it.each(["next", "आगे", "aage badho", "skip", "please", "next please", "ok next", "आगे बढ़िए जी"])("'%s' -> not an answer", (t) =>
    expect(isNavigationOnly(t)).toBe(true),
  );
  it.each(["", "processing fee 1500", "next 1500", "haan ji", "fee nahi", "आगे की किस्त 2666"])("'%s' -> not navigation", (t) =>
    expect(isNavigationOnly(t)).toBe(false),
  );
});

describe("C4 agent changed answers", () => {
  it("an earlier conflict is flagged even when the latest matches; all attempts are kept", () => {
    const checks = [agent("processing_fee", "processing fee नहीं लगेगी"), agent("processing_fee", "processing fee 1500 rupaye")];
    expect(checks.map((c) => c.status)).toEqual(["conflict", "match"]);
    expect(agentChangedEarlier(checks, "processing_fee")).toBe(true);
    expect(AGENT_CHANGED_HI).toBe("एजेंट ने पहले अलग बताया था");
  });
  it("no flag when only the latest differs, or when nothing differed", () => {
    expect(agentChangedEarlier([agent("installment", "EMI 2666 har mahine"), agent("installment", "EMI 2500 har mahine")], "installment")).toBe(false);
    expect(agentChangedEarlier([agent("installment", "EMI 2666 har mahine")], "installment")).toBe(false);
  });
});
