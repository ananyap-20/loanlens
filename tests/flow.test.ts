import { describe, expect, it } from "vitest";
import { breakdown, formatINR } from "@/lib/flow/money";
import { explainPaper, FIELD_NAME_HI, PAPER_FAIL_HI, SAY, valueHi } from "@/lib/flow/scripts";
import { paperResultFromLines } from "@/lib/paper/pdf";
import { SAMPLE_PAPER } from "./fixtures/paper";

// Timbre mispronounces digits: nothing we speak may contain ASCII or Devanagari digits.
const DIGIT = /[0-9०-९]/;

describe("money pictures", () => {
  it("splits exactly into notes and coins", () => {
    expect(breakdown(1500)).toEqual([{ denom: 500, count: 3, kind: "note" }]);
    const p = breakdown(2666);
    expect(p.reduce((s, x) => s + x.denom * x.count, 0)).toBe(2666);
    expect(p.find((x) => x.denom === 1)).toEqual({ denom: 1, count: 1, kind: "coin" });
  });
  it("gives no pictures for 0, negative or fractional amounts", () => {
    expect(breakdown(0)).toEqual([]);
    expect(breakdown(-5)).toEqual([]);
    expect(breakdown(12.5)).toEqual([]);
  });
  it("formats with Indian grouping", () => {
    expect(formatINR(28500)).toBe("₹28,500");
    expect(formatINR(150000)).toBe("₹1,50,000");
  });
});

describe("spoken Hindi", () => {
  const all = { terms: SAMPLE_PAPER, missing: [], ambiguous: [] };

  it("explains the sample paper with numbers as words", () => {
    const t = explainPaper(all);
    expect(t).not.toMatch(DIGIT);
    expect(t).toContain("तीस हज़ार रुपये");
    expect(t).toContain("अट्ठाईस हज़ार पाँच सौ रुपये");
    expect(t).toContain("पंद्रह सौ रुपये");
    expect(t).toContain("दो हज़ार छह सौ छियासठ रुपये, हर महीने");
    expect(t).toContain("बारह प्रतिशत सालाना");
    expect(t).toContain("यानी पूरे तीस हज़ार रुपये हाथ में नहीं आएँगे");
    expect(t.length).toBeLessThan(1000); // /api/speak limit
  });

  it("says what is missing instead of inventing it", () => {
    const t = explainPaper({ terms: SAMPLE_PAPER.filter((v) => v.field !== "processing_fee"), missing: ["processing_fee"], ambiguous: [] });
    expect(t).toContain(`इस कागज़ पर ${FIELD_NAME_HI.processing_fee} नहीं लिखी है`);
    expect(t).not.toContain("पंद्रह सौ");
  });

  it("flags fields the paper states twice differently", () => {
    expect(explainPaper({ terms: [], missing: [], ambiguous: ["installment"] })).toContain("दो अलग-अलग");
  });

  it("speaks values by unit", () => {
    const base = { source: "paper" as const, confidence: "high" as const, evidence: "" };
    expect(valueHi({ ...base, field: "tenure", amount: 12, unit: "months" })).toBe("बारह महीने");
    expect(valueHi({ ...base, field: "tenure", amount: 52, unit: "weeks" })).toBe("बावन हफ़्ते");
    expect(valueHi({ ...base, field: "processing_fee", amount: 0, unit: "INR", negated: true })).toBe("कुछ नहीं");
    expect(valueHi({ ...base, field: "installment", amount: 700, unit: "INR", frequency: "weekly" })).toBe("सात सौ रुपये, हर हफ़्ते");
  });

  it("no fixed prompt contains digits", () => {
    for (const s of [...Object.values(SAY), ...Object.values(PAPER_FAIL_HI)]) expect(s).not.toMatch(DIGIT);
  });
});

describe("grievance line from the KFS", () => {
  it("is kept for the result screen", () => {
    const r = paperResultFromLines(["Loan amount: Rs. 30,000", "Grievance Officer: Mr. A. Sample (fictional), grievance@sahyog.example"]);
    expect(r.ok && r.grievance).toBe("Grievance Officer: Mr. A. Sample (fictional), grievance@sahyog.example");
  });
  it("is absent when not printed", () => {
    const r = paperResultFromLines(["Loan amount: Rs. 30,000"]);
    expect(r.ok && r.grievance).toBeUndefined();
  });
});
