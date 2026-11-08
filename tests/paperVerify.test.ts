// Phase 4 verification: generated PDFs (Devanagari digits, missing fee) and a degraded QR rendering.
import { PDFDocument, PDFHexString, PDFName, PDFOperator, PDFOperatorNames as Ops, PDFNumber, StandardFonts } from "pdf-lib";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { readPdfTerms } from "@/lib/paper/pdf";
import { decodeQrFromImageData, termsFromQrPayload } from "@/lib/paper/qr";
import { SAMPLE_PAPER, SAMPLE_QR_PAYLOAD } from "./fixtures/paper";

const lineText = (label: string, rest: string) => `${label}: ${rest}`;

/** PDF whose text layer contains Devanagari digits. Digits are drawn with a Helvetica font whose encoding maps
 *  codes 1-10 to the glyph names uni0966..uni096F, so pdf.js extracts real Devanagari (no embedded font needed). */
async function devanagariPdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const ctx = pdf.context;
  const glyphs = Array.from({ length: 10 }, (_, i) => PDFName.of(`uni0${(0x966 + i).toString(16).toUpperCase()}`)); // U+0966..U+096F
  const diffs = ctx.obj([PDFNumber.of(1), ...glyphs]);
  const enc = ctx.obj({ Type: "Encoding", BaseEncoding: "WinAnsiEncoding", Differences: diffs });
  const font = ctx.register(ctx.obj({ Type: "Font", Subtype: "Type1", BaseFont: "Helvetica", Encoding: enc, FirstChar: 0, LastChar: 255, Widths: Array.from({ length: 256 }, () => 556) }));
  page.node.setFontDictionary(PDFName.of("F9"), font);
  const DEV = "०१२३४५६७८९";
  const hex = (s: string) =>
    PDFHexString.of(
      [...s].map((ch) => (DEV.includes(ch) ? DEV.indexOf(ch) + 1 : ch.charCodeAt(0)).toString(16).padStart(2, "0")).join(""),
    );
  lines.forEach((t, i) => {
    page.pushOperators(
      PDFOperator.of(Ops.BeginText),
      PDFOperator.of(Ops.SetFontAndSize, [PDFName.of("F9"), PDFNumber.of(14)]),
      PDFOperator.of(Ops.MoveText, [PDFNumber.of(50), PDFNumber.of(780 - i * 28)]),
      PDFOperator.of(Ops.ShowText, [hex(t)]),
      PDFOperator.of(Ops.EndText),
    );
  });
  return pdf.save();
}

async function plainPdf(lines: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  lines.forEach((t, i) => page.drawText(t, { x: 50, y: 780 - i * 28, size: 14, font }));
  return pdf.save();
}

describe("generated PDFs", () => {
  it("reads Devanagari digits from a real PDF text layer", async () => {
    const bytes = await devanagariPdf([
      lineText("Loan amount", "Rs. ३०,०००"),
      lineText("Processing fee", "Rs. १,५००"),
      lineText("Instalment", "Rs. २,६६६ per month"),
    ]);
    const r = await readPdfTerms(bytes);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const by = (f: string) => r.terms.find((v) => v.field === f);
    expect(by("loan_amount")).toMatchObject({ amount: 30000, unit: "INR", source: "paper" });
    expect(by("processing_fee")).toMatchObject({ amount: 1500, unit: "INR" });
    expect(by("installment")).toMatchObject({ amount: 2666, frequency: "monthly" });
    expect(by("processing_fee")?.evidence).toContain("१,५००"); // the evidence is the Devanagari line itself
  });

  it("a PDF with no processing-fee line leaves the fee unknown (not 0)", async () => {
    const lines = ["Loan amount: Rs. 30,000", "Tenure: 12 months", "Instalment: Rs. 2,666 per month", "Net amount disbursed: Rs. 28,500"];
    const r = await readPdfTerms(await plainPdf(lines));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.terms.some((v) => v.field === "processing_fee")).toBe(false);
    expect(r.missing).toContain("processing_fee");
    expect(r.terms.find((v) => v.field === "loan_amount")?.amount).toBe(30000);
  });

  it("a PDF with a page but no text says there is no text", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([595, 842]);
    expect(await readPdfTerms(await pdf.save())).toMatchObject({ ok: false, reason: "no_text" });
  });
});

describe("QR from a degraded rendering", () => {
  /** Renders the QR at a non-integer scale, rotated by `deg`, with low contrast, a grey background and light noise. */
  function render(payload: string, opts: { modulepx: number; deg: number; dark: number; light: number; noise: number }) {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const quiet = 4;
    const side = Math.ceil((n + quiet * 2) * opts.modulepx * 1.25);
    const px = new Uint8ClampedArray(side * side * 4);
    const rad = (opts.deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
    const dark = (r: number, c: number) => (r >= 0 && c >= 0 && r < n && c < n && qr.modules.get(r, c) ? 1 : 0);
    for (let y = 0; y < side; y++)
      for (let x = 0; x < side; x++) {
        // inverse-rotate around the centre, then 3x3 supersample (also softens edges like a camera)
        let acc = 0;
        for (let sy = 0; sy < 3; sy++)
          for (let sx = 0; sx < 3; sx++) {
            const dx = x + (sx + 0.5) / 3 - side / 2, dy = y + (sy + 0.5) / 3 - side / 2;
            const u = (dx * cos + dy * sin) / opts.modulepx + (n + quiet * 2) / 2 - quiet;
            const v = (-dx * sin + dy * cos) / opts.modulepx + (n + quiet * 2) / 2 - quiet;
            acc += dark(Math.floor(v), Math.floor(u));
          }
        const t = acc / 9;
        const g = Math.max(0, Math.min(255, opts.light * (1 - t) + opts.dark * t + rnd() * opts.noise));
        const i = (y * side + x) * 4;
        px[i] = px[i + 1] = px[i + 2] = g;
        px[i + 3] = 255;
      }
    return { px, side };
  }

  it("decodes at a fractional scale, 5 degrees rotated, low contrast, with noise", () => {
    const { px, side } = render(SAMPLE_QR_PAYLOAD, { modulepx: 3.7, deg: 5, dark: 95, light: 185, noise: 30 });
    const text = decodeQrFromImageData(px, side, side);
    expect(text).toBe(SAMPLE_QR_PAYLOAD);
    const r = termsFromQrPayload(text!);
    expect(r.ok && r.terms.map(({ field, amount }) => ({ field, amount }))).toEqual(
      SAMPLE_PAPER.map(({ field, amount }) => ({ field, amount })),
    );
  });

  it("decodes small modules (2.6 px) rotated -7 degrees", () => {
    const { px, side } = render(SAMPLE_QR_PAYLOAD, { modulepx: 2.6, deg: -7, dark: 80, light: 200, noise: 20 });
    expect(decodeQrFromImageData(px, side, side)).toBe(SAMPLE_QR_PAYLOAD);
  });
});
