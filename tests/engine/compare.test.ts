import { describe, expect, it } from "vitest";
import { compare, compareField, rateBasis } from "@/lib/engine/compare";
import { extractClaims } from "@/lib/engine/extractClaims";
import { ALL_FIELDS } from "@/lib/engine/types";
import { paperWithout, SAMPLE_PAPER } from "../fixtures/paper";

const agentSays = (t: string, asked?: Parameters<typeof extractClaims>[1]) => extractClaims(t, asked, "agent");
const borrowerSays = (t: string, asked?: Parameters<typeof extractClaims>[1]) => extractClaims(t, asked, "borrower");
const status = (field: Parameters<typeof compareField>[0], spoken: ReturnType<typeof extractClaims>, paper = SAMPLE_PAPER) =>
  compareField(field, paper, spoken).status;

describe("compare: required cases (CLAUDE.md section 6)", () => {
  it("fee conflict: paper ₹1,500 vs agent 'koi processing fee nahi'", () => {
    expect(status("processing_fee", agentSays("koi processing fee nahi lagegi", "processing_fee"))).toBe("conflict");
  });
  it("EMI match", () => {
    expect(status("installment", agentSays("EMI 2666 har mahine", "installment"))).toBe("match");
    expect(status("installment", agentSays("EMI 2666"))).toBe("match"); // no frequency said: amount only
  });
  it("missing -> not_mentioned (not 0)", () => {
    const spoken = agentSays("EMI 2666 har mahine");
    expect(status("late_fee", spoken)).toBe("not_mentioned");
    expect(status("processing_fee", spoken)).toBe("not_mentioned");
  });
  it("paper missing a value -> unable_to_verify, even when the agent says 'nahi'", () => {
    expect(status("processing_fee", agentSays("koi processing fee nahi", "processing_fee"), paperWithout("processing_fee"))).toBe(
      "unable_to_verify",
    );
  });
  it("weekly vs monthly -> unable_to_verify, never conflict", () => {
    expect(status("installment", agentSays("EMI 2666 har hafte"))).toBe("unable_to_verify");
    expect(status("installment", agentSays("EMI 700 har hafte"))).toBe("unable_to_verify");
  });
  it("nominal vs APR is not a conflict", () => {
    expect(rateBasis(SAMPLE_PAPER[1].evidence)).toBe("reducing");
    expect(status("interest_rate", agentSays("APR 13.5% hai"))).toBe("unable_to_verify");
    expect(status("interest_rate", agentSays("APR 12% hai"))).toBe("unable_to_verify");
    expect(status("interest_rate", agentSays("byaj 12 pratishat hai"))).toBe("match");
    expect(status("interest_rate", agentSays("byaj 18 pratishat"))).toBe("unable_to_verify"); // basis unknown
    expect(status("interest_rate", agentSays("reducing balance par 14% byaj"))).toBe("conflict"); // same basis, different rate
  });
  it("Hinglish: processing fee pandrah sau hai", () => {
    expect(status("processing_fee", agentSays("processing fee pandrah sau hai", "processing_fee"))).toBe("match");
  });
  it("Devanagari words: प्रोसेसिंग फीस पंद्रह सौ रुपये", () => {
    expect(status("processing_fee", agentSays("प्रोसेसिंग फीस पंद्रह सौ रुपये है"))).toBe("match");
  });
  it("empty transcript -> every field not_mentioned for both", () => {
    const rows = compare(SAMPLE_PAPER, agentSays("", "processing_fee"), borrowerSays(""));
    expect(rows.map((r) => r.field)).toEqual(ALL_FIELDS);
    for (const r of rows) {
      expect(r.agent.status).toBe("not_mentioned");
      expect(r.borrower.status).toBe("not_mentioned");
    }
  });
});

describe("compare: extra cases", () => {
  it("Devanagari digits", () => {
    expect(status("processing_fee", agentSays("प्रोसेसिंग फीस १,५०० रुपये"))).toBe("match");
  });
  it("Rs. 1,500/-", () => {
    expect(status("processing_fee", agentSays("processing fee Rs. 1,500/-"))).toBe("match");
  });
  it("dedh hazaar / dhai hazaar / saadhe teen hazaar / teen hazaar paanch sau", () => {
    expect(status("processing_fee", agentSays("processing fee dedh hazaar"))).toBe("match");
    expect(status("processing_fee", agentSays("processing fee dhai hazaar"))).toBe("conflict");
    const p3500 = SAMPLE_PAPER.map((v) => (v.field === "processing_fee" ? { ...v, amount: 3500 } : v));
    expect(status("processing_fee", agentSays("processing fee saadhe teen hazaar"), p3500)).toBe("match");
    expect(status("processing_fee", agentSays("processing fee teen hazaar paanch sau"), p3500)).toBe("match");
  });
  it("agent says a different EMI -> conflict", () => {
    expect(status("installment", agentSays("EMI 2800 har mahine"))).toBe("conflict");
    expect(status("installment", agentSays("kisht do hazaar paanch sau"))).toBe("conflict");
  });
  it("borrower says 'pata nahi' -> unable_to_verify", () => {
    expect(status("processing_fee", borrowerSays("pata nahi", "processing_fee"))).toBe("unable_to_verify");
  });
  it("uncertain number -> unable_to_verify", () => {
    expect(status("processing_fee", agentSays("shayad 1500", "processing_fee"))).toBe("unable_to_verify");
  });
  it("two different numbers for one field -> unable_to_verify", () => {
    expect(status("processing_fee", agentSays("processing fee 1500, nahi nahi processing fee 1000"))).toBe("unable_to_verify");
  });
  it("tenure needs a unit; 12 months matches, 12 weeks does not", () => {
    expect(status("tenure", agentSays("12 mahine"))).toBe("match");
    expect(status("tenure", agentSays("12 hafte"))).toBe("unable_to_verify");
    expect(status("tenure", agentSays("tenure 12"))).toBe("unable_to_verify");
  });
  it("net disbursed: 'poore 30,000 haath mein' conflicts with ₹28,500", () => {
    expect(status("net_disbursed", agentSays("poore 30,000 haath mein milenge"))).toBe("conflict");
  });
});

describe("compare: full table from the playground fixture", () => {
  it("agent fixture vs paper", () => {
    const agent = agentSays("आपको 30,000 का loan मिलेगा। EMI 2666 और processing fee नहीं लगेगी।");
    const rows = Object.fromEntries(compare(SAMPLE_PAPER, agent, []).map((r) => [r.field, r.agent.status]));
    expect(rows).toEqual({
      loan_amount: "match",
      interest_rate: "not_mentioned",
      tenure: "not_mentioned",
      installment: "match",
      processing_fee: "conflict",
      net_disbursed: "not_mentioned",
      late_fee: "not_mentioned",
    });
  });
  it("each row carries the paper value and the spoken evidence", () => {
    const row = compare(SAMPLE_PAPER, agentSays("koi processing fee nahi", "processing_fee"), []).find(
      (r) => r.field === "processing_fee",
    )!;
    expect(row.paper?.evidence).toBe("Processing fee: ₹1,500 (deducted upfront)");
    expect(row.agent.spoken[0].evidence).toBe("koi processing fee nahi");
  });
});
