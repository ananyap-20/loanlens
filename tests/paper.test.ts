import { readFileSync } from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { compare } from "@/lib/engine";
import type { Value } from "@/lib/engine/types";
import { paperResultFromLines, readPdfTerms, termsFromLines } from "@/lib/paper/pdf";
import { decodeQrFromImageData, termsFromQrPayload } from "@/lib/paper/qr";
import { NO_TEXT_MESSAGE, type PaperResult } from "@/lib/paper/terms";
import { SAMPLE_PAPER, SAMPLE_QR_PAYLOAD } from "./fixtures/paper";

// The text printed on public/sample/kfs-sahyog.pdf (see scripts/make-sample.mjs).
const SAMPLE_LINES = [
  "SAMPLE - FICTIONAL",
  "Key Fact Statement (sample)",
  "Sahyog Finance (fictional) - Borrower: Sunita (sample)",
  "Loan amount: Rs. 30,000",
  "Interest rate: 12% per year (reducing balance)",
  "Tenure: 12 months",
  "Instalment: Rs. 2,666 per month",
  "Processing fee: Rs. 1,500 (deducted upfront)",
  "Net amount disbursed: Rs. 28,500",
  "Late fee: Rs. 200 per missed instalment",
  "Sum of instalments on this paper: Rs. 31,992",
  "Grievance Officer: Mr. A. Sample (fictional), grievance@sahyog.example",
];

// Evidence text differs per source (a PDF line vs a QR key); every other property must be identical.
const core = (terms: Value[]) => terms.map((v) => ({ ...v, evidence: undefined }));
const okTerms = (r: PaperResult) => {
  if (!r.ok) throw new Error("expected ok, got " + r.reason);
  return r.terms;
};

describe("PDF text -> paper Values", () => {
  it("extracts exactly the sample paper from the sample text", () => {
    const r = paperResultFromLines(SAMPLE_LINES);
    expect(r.ok && r.missing).toEqual([]);
    expect(core(okTerms(r))).toEqual(core(SAMPLE_PAPER));
    expect(okTerms(r).every((v) => v.source === "paper")).toBe(true);
  });

  it("keeps the printed line as evidence", () => {
    const fee = okTerms(paperResultFromLines(SAMPLE_LINES)).find((v) => v.field === "processing_fee");
    expect(fee?.evidence).toBe("Processing fee: Rs. 1,500 (deducted upfront)");
  });

  it("does not mistake 'Sum of instalments' (31,992) for the instalment", () => {
    const inst = okTerms(paperResultFromLines(SAMPLE_LINES)).find((v) => v.field === "installment");
    expect(inst?.amount).toBe(2666);
  });

  it("leaves a field out when the paper does not state it (missing is never 0)", () => {
    const lines = SAMPLE_LINES.filter((l) => !l.startsWith("Processing fee"));
    const r = paperResultFromLines(lines);
    expect(r.ok && r.missing).toEqual(["processing_fee"]);
    expect(okTerms(r).some((v) => v.field === "processing_fee")).toBe(false);
  });

  it("handles ₹ and Devanagari digits", () => {
    const { values } = termsFromLines(["Processing fee: ₹१,५००"]);
    expect(values[0]).toMatchObject({ field: "processing_fee", amount: 1500, unit: "INR" });
  });

  it("weekly instalment keeps its frequency; no frequency stays unknown", () => {
    expect(termsFromLines(["EMI: Rs. 700 per week"]).values[0].frequency).toBe("weekly");
    expect(termsFromLines(["EMI: Rs. 700"]).values[0].frequency).toBeUndefined();
  });

  it("does not guess when two lines disagree about a field", () => {
    const { values, ambiguous } = termsFromLines(["Processing fee: Rs. 1,500", "Processing fee: Rs. 500"]);
    expect(values).toEqual([]);
    expect(ambiguous).toEqual(["processing_fee"]);
  });

  it("an interest rate without % is not read as a rate", () => {
    expect(termsFromLines(["Interest rate: 12"]).values).toEqual([]);
  });

  it("says so when there is no text", () => {
    expect(paperResultFromLines([])).toEqual({ ok: false, reason: "no_text", message: NO_TEXT_MESSAGE });
    expect(paperResultFromLines(["   ", ""])).toMatchObject({ ok: false, reason: "no_text" });
    expect(NO_TEXT_MESSAGE).toBe("is PDF mein likha hua text nahi mila");
  });

  it("text with no loan terms is a clear failure, not zeros", () => {
    expect(paperResultFromLines(["Hello world", "Page 1"])).toMatchObject({ ok: false, reason: "no_terms" });
  });
});

describe("real sample PDF (public/sample/kfs-sahyog.pdf)", () => {
  const bytes = readFileSync(path.join(__dirname, "..", "public", "sample", "kfs-sahyog.pdf"));

  it("pdfjs reads it and gives the sample paper", async () => {
    const r = await readPdfTerms(bytes);
    expect(r.ok && r.missing).toEqual([]);
    expect(core(okTerms(r))).toEqual(core(SAMPLE_PAPER));
  });

  it("garbage bytes are 'unreadable', not a crash", async () => {
    expect(await readPdfTerms(new Uint8Array([1, 2, 3, 4]))).toMatchObject({ ok: false, reason: "unreadable" });
  });
});

describe("QR payload -> paper Values", () => {
  it("gives the sample paper and the lender name", () => {
    const r = termsFromQrPayload(SAMPLE_QR_PAYLOAD);
    expect(core(okTerms(r))).toEqual(core(SAMPLE_PAPER));
    expect(r.ok && r.lender).toBe("Sahyog Finance (fictional)");
  });

  it("PDF path and QR path give the same terms", async () => {
    const pdf = await readPdfTerms(readFileSync(path.join(__dirname, "..", "public", "sample", "kfs-sahyog.pdf")));
    expect(core(okTerms(termsFromQrPayload(SAMPLE_QR_PAYLOAD)))).toEqual(core(okTerms(pdf)));
  });

  it("works with the engine: paper from QR vs agent saying 'no fee' is a conflict", () => {
    const paper = okTerms(termsFromQrPayload(SAMPLE_QR_PAYLOAD));
    const agent: Value[] = [
      { field: "processing_fee", amount: 0, unit: "INR", negated: true, evidence: "processing fee nahi", source: "agent", confidence: "high" },
    ];
    const fee = compare(paper, agent, []).find((c) => c.field === "processing_fee");
    expect(fee?.agent.status).toBe("conflict");
  });

  it("a missing key means no Value (fee omitted is not ₹0)", () => {
    const payload = JSON.stringify({ v: 1, amt: 30000, freq: "monthly", n: 12, emi: 2666 });
    const r = termsFromQrPayload(payload);
    expect(okTerms(r).some((v) => v.field === "processing_fee")).toBe(false);
    expect(r.ok && r.missing).toContain("processing_fee");
  });

  it("an explicit fee of 0 is kept as 0", () => {
    const r = termsFromQrPayload(JSON.stringify({ v: 1, fee: 0 }));
    expect(okTerms(r)[0]).toMatchObject({ field: "processing_fee", amount: 0 });
  });

  it("tenure unit follows the frequency; unknown frequency = unknown tenure", () => {
    const t = (o: object) => okTerms(termsFromQrPayload(JSON.stringify({ v: 1, emi: 700, n: 10, ...o })));
    expect(t({ freq: "weekly" }).find((v) => v.field === "tenure")).toMatchObject({ amount: 10, unit: "weeks" });
    expect(t({ freq: "weekly" }).find((v) => v.field === "installment")?.frequency).toBe("weekly");
    expect(t({ freq: "fortnightly" }).find((v) => v.field === "tenure")).toMatchObject({ amount: 20, unit: "weeks" });
    expect(t({}).some((v) => v.field === "tenure")).toBe(false);
    expect(t({}).find((v) => v.field === "installment")?.frequency).toBeUndefined();
  });

  it.each([
    ["not JSON", "hello"],
    ["empty", ""],
    ["array", "[1,2]"],
    ["wrong version", '{"v":2,"amt":30000}'],
    ["no version", '{"amt":30000}'],
    ["only version", '{"v":1}'],
    ["numbers as strings", '{"v":1,"amt":"30000"}'],
    ["negative", '{"v":1,"amt":-5}'],
    ["fee negative", '{"v":1,"fee":-1}'],
    ["rate over 100", '{"v":1,"rate":120}'],
    ["fractional n", '{"v":1,"n":12.5}'],
    ["bad frequency", '{"v":1,"amt":100,"freq":"daily"}'],
    ["lender not text", '{"v":1,"amt":100,"lender":5}'],
    ["too long", '{"v":1,"lender":"' + "a".repeat(2100) + '"}'],
  ])("rejects a bad QR: %s", (_n, payload) => {
    expect(termsFromQrPayload(payload)).toMatchObject({ ok: false, reason: "bad_qr" });
  });
});

describe("QR image decoding (jsQR)", () => {
  it("decodes a QR drawn into pixels", () => {
    const qr = QRCode.create(SAMPLE_QR_PAYLOAD, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const cell = 6;
    const quiet = 4;
    const side = (n + quiet * 2) * cell;
    const px = new Uint8ClampedArray(side * side * 4).fill(255);
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        if (!qr.modules.get(r, c)) continue;
        for (let y = 0; y < cell; y++)
          for (let x = 0; x < cell; x++) {
            const i = (((r + quiet) * cell + y) * side + (c + quiet) * cell + x) * 4;
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
      }
    const text = decodeQrFromImageData(px, side, side);
    expect(text).toBe(SAMPLE_QR_PAYLOAD);
    expect(core(okTerms(termsFromQrPayload(text!)))).toEqual(core(SAMPLE_PAPER));
  });

  it("returns null when there is no QR", () => {
    expect(decodeQrFromImageData(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100)).toBeNull();
  });
});
