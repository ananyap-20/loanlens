// Real Prisma outputs as byte-exact UTF-8 fixtures (no BOM, no newline, exact code points).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractClaims, parseAmounts } from "@/lib/engine";

const dir = path.join(__dirname, "..", "fixtures", "prisma");

/** Reads a fixture strictly: throws on invalid UTF-8. */
export function readFixture(name: string): { text: string; bytes: Buffer } {
  const bytes = readFileSync(path.join(dir, name));
  return { bytes, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
}

// Code points written as escapes, so this file's own encoding cannot hide a difference.
const EXPECTED: Record<string, { escaped: string; byteLength: number }> = {
  "playground-loan-emi-fee.txt": {
    escaped:
      "आपको 30,000 का loan मिलेगा। EMI 2666 और processing fee नहीं लगेगी।",
    byteLength: 116,
  },
  "smoke-timbre-loan-kisht.txt": {
    escaped:
      "नमस्ते, आपका लोन 30,000 रुपये का है, किस्त 2,666 रुपये है।",
    byteLength: 128,
  },
  "laptop-mic-processing-fee.txt": {
    escaped: "processing fee 1500 रुपये है।",
    byteLength: 45,
  },
};

describe("Prisma fixtures are byte-exact UTF-8", () => {
  for (const [name, exp] of Object.entries(EXPECTED)) {
    it(name, () => {
      const { text, bytes } = readFixture(name);
      expect(bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]))).toBe(false); // no BOM
      expect(bytes.includes(0x0d)).toBe(false); // no CR
      expect(bytes.includes(0x0a)).toBe(false); // no trailing newline
      expect(bytes.length).toBe(exp.byteLength);
      expect(text).toBe(exp.escaped);
      expect(Buffer.from(exp.escaped, "utf8").equals(bytes)).toBe(true);
    });
  }

  it("the section 6 fixture matches the literal string in CLAUDE.md", () => {
    expect(readFixture("playground-loan-emi-fee.txt").text).toBe("आपको 30,000 का loan मिलेगा। EMI 2666 और processing fee नहीं लगेगी।");
  });
});

describe("Prisma fixture 1 (CLAUDE.md section 6, playground)", () => {
  const { text } = readFixture("playground-loan-emi-fee.txt");

  it("extracts loan_amount=30000, installment=2666, processing_fee=0 (negated)", () => {
    const v = extractClaims(text);
    const byField = Object.fromEntries(v.map((x) => [x.field, x]));
    expect(v).toHaveLength(3);
    expect(byField.loan_amount).toMatchObject({ amount: 30000, unit: "INR", confidence: "high" });
    expect(byField.installment).toMatchObject({ amount: 2666, unit: "INR", confidence: "high" });
    expect(byField.processing_fee).toMatchObject({ amount: 0, negated: true });
    expect(byField.processing_fee.evidence).toBe("processing fee नहीं लगेगी");
  });

  it("parseAmounts finds 30000 and 2666", () => {
    expect(parseAmounts(text).map((a) => a.value)).toEqual([30000, 2666]);
  });
});

describe("Prisma fixture 2 (Timbre smoke sentence)", () => {
  const { text } = readFixture("smoke-timbre-loan-kisht.txt");

  it("parseAmounts gives 30000 and 2666", () => {
    expect(parseAmounts(text).map((a) => a.value)).toEqual([30000, 2666]);
  });

  it("लोन -> loan_amount, किस्त -> installment", () => {
    const v = extractClaims(text);
    expect(v.map((x) => [x.field, x.amount])).toEqual([
      ["loan_amount", 30000],
      ["installment", 2666],
    ]);
  });
});

describe("Prisma fixture 3 (laptop mic)", () => {
  it("processing fee 1500", () => {
    const v = extractClaims(readFixture("laptop-mic-processing-fee.txt").text, "processing_fee");
    expect(v).toEqual([
      expect.objectContaining({ field: "processing_fee", amount: 1500, unit: "INR", confidence: "high" }),
    ]);
  });
});
