import { describe, expect, it } from "vitest";
import { detectFrequency, extractClaims, hasConsequenceKeyword, isUncertain } from "@/lib/engine/extractClaims";

const pairs = (t: string, asked?: Parameters<typeof extractClaims>[1]) =>
  extractClaims(t, asked).map((v) => [v.field, v.amount]);

describe("extractClaims: asked field (one field per clip)", () => {
  it("numbers with no field word go to the asked field", () => {
    expect(extractClaims("2666 rupaye", "installment")).toEqual([
      expect.objectContaining({ field: "installment", amount: 2666, unit: "INR", confidence: "high", source: "agent" }),
    ]);
  });
  it("source is recorded", () => {
    expect(extractClaims("1500", "processing_fee", "borrower")[0].source).toBe("borrower");
  });
  it("Hinglish: processing fee pandrah sau hai", () => {
    expect(extractClaims("processing fee pandrah sau hai", "processing_fee")).toEqual([
      expect.objectContaining({ field: "processing_fee", amount: 1500, confidence: "medium" }),
    ]);
  });
  it("Devanagari words: प्रोसेसिंग फीस पंद्रह सौ रुपये", () => {
    expect(pairs("प्रोसेसिंग फीस पंद्रह सौ रुपये है", "processing_fee")).toEqual([["processing_fee", 1500]]);
  });
  it("without an asked field, numbers with no field word are dropped (never guessed)", () => {
    expect(extractClaims("2666 rupaye")).toEqual([]);
  });
  it("a lone ambiguous word ('kar do') is ignored", () => {
    expect(extractClaims("sign kar do", "installment")).toEqual([]);
  });
});

describe("extractClaims: field words", () => {
  it("EMI / किस्त / instalment all mean installment", () => {
    expect(pairs("EMI 2666")).toEqual([["installment", 2666]]);
    expect(pairs("किस्त 2,666 रुपये")).toEqual([["installment", 2666]]);
    expect(pairs("instalment 2666")).toEqual([["installment", 2666]]);
    expect(pairs("kisht 2666")).toEqual([["installment", 2666]]);
  });
  it("several fields in one clip", () => {
    expect(pairs("loan 30000, EMI 2666 aur processing fee 1500")).toEqual([
      ["loan_amount", 30000],
      ["installment", 2666],
      ["processing_fee", 1500],
    ]);
  });
  it("nearest field word wins within a clause", () => {
    expect(pairs("agar kisht nahi di toh 200 late fee lagegi", "late_fee")).toEqual([["late_fee", 200]]);
  });
  it("percent -> interest_rate, months -> tenure", () => {
    expect(extractClaims("12% byaj")[0]).toMatchObject({ field: "interest_rate", amount: 12, unit: "percent" });
    expect(extractClaims("loan 12 महीने के लिए")[0]).toMatchObject({ field: "tenure", amount: 12, unit: "months" });
    expect(extractClaims("52 hafte", "tenure")[0]).toMatchObject({ field: "tenure", amount: 52, unit: "weeks" });
  });
  it("haath mein -> net_disbursed", () => {
    expect(pairs("haath mein 28,500 aayenge")).toEqual([["net_disbursed", 28500]]);
  });
});

describe("extractClaims: negation", () => {
  it("koi processing fee nahi -> 0, negated", () => {
    expect(extractClaims("koi processing fee nahi hai", "processing_fee")).toEqual([
      expect.objectContaining({ field: "processing_fee", amount: 0, negated: true }),
    ]);
  });
  it("no processing fee / processing fee free hai / कोई प्रोसेसिंग फीस नहीं", () => {
    for (const t of ["no processing fee", "processing fee free hai", "कोई प्रोसेसिंग फीस नहीं लगेगी"]) {
      expect(extractClaims(t, "processing_fee"), t).toEqual([expect.objectContaining({ amount: 0, negated: true })]);
    }
  });
  it("bare 'nahi' answers the asked fee field", () => {
    expect(pairs("nahi", "processing_fee")).toEqual([["processing_fee", 0]]);
  });
  it("negation never zeroes a non-fee field", () => {
    expect(extractClaims("loan nahi milega")).toEqual([]);
    expect(extractClaims("EMI nahi", "installment")).toEqual([]);
  });
  it("negation about another field is ignored when a field was asked", () => {
    expect(extractClaims("agar kisht nahi di", "late_fee")).toEqual([]);
  });
  it("an explicit zero is negated", () => {
    expect(extractClaims("processing fee zero hai", "processing_fee")[0]).toMatchObject({ amount: 0, negated: true });
  });
});

describe("extractClaims: uncertainty and missing", () => {
  it("pata nahi -> low confidence, no amount, NOT negated", () => {
    const v = extractClaims("pata nahi", "processing_fee", "borrower");
    expect(v).toEqual([expect.objectContaining({ field: "processing_fee", confidence: "low" })]);
    expect(v[0].amount).toBeUndefined();
    expect(v[0].negated).toBeUndefined();
  });
  it("shayad 1500 -> low confidence", () => {
    expect(extractClaims("shayad 1500", "processing_fee")[0]).toMatchObject({ amount: 1500, confidence: "low" });
  });
  it("पता नहीं (Devanagari)", () => {
    expect(extractClaims("मुझे पता नहीं", "installment")[0]).toMatchObject({ confidence: "low" });
  });
  it("missing field -> no Value at all (never 0)", () => {
    const v = extractClaims("EMI 2666 har mahine");
    expect(v.find((x) => x.field === "late_fee")).toBeUndefined();
    expect(v.find((x) => x.field === "processing_fee")).toBeUndefined();
  });
  it("empty transcript -> []", () => {
    expect(extractClaims("", "processing_fee")).toEqual([]);
    expect(extractClaims("   ")).toEqual([]);
  });
});

describe("frequency", () => {
  it("detectFrequency", () => {
    expect(detectFrequency("har mahine 2666")).toBe("monthly");
    expect(detectFrequency("हर महीने")).toBe("monthly");
    expect(detectFrequency("har hafte")).toBe("weekly");
    expect(detectFrequency("हर हफ़्ते")).toBe("weekly");
    expect(detectFrequency("pandrah din mein")).toBe("fortnightly");
    expect(detectFrequency("monthly")).toBe("monthly");
    expect(detectFrequency("2666 hai")).toBeUndefined();
    expect(detectFrequency("har hafte 500, 12 mahine tak")).toBe("weekly");
  });
  it("installment values carry the frequency", () => {
    expect(extractClaims("EMI 2666 har mahine")[0]).toMatchObject({ field: "installment", frequency: "monthly" });
    expect(extractClaims("EMI 2666 har hafte")[0]).toMatchObject({ frequency: "weekly" });
    expect(extractClaims("EMI 2666")[0].frequency).toBeUndefined();
  });
});

describe("helpers", () => {
  it("isUncertain", () => {
    expect(isUncertain("pata nahi")).toBe(true);
    expect(isUncertain("processing fee nahi")).toBe(false);
  });
  it("hasConsequenceKeyword", () => {
    for (const t of ["late fee lagegi", "penalty", "jurmana lagega", "extra lagega", "जुर्माना देना होगा", "लेट फीस"]) {
      expect(hasConsequenceKeyword(t), t).toBe(true);
    }
    expect(hasConsequenceKeyword("kuch nahi hoga")).toBe(false);
  });
});
