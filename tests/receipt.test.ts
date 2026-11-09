import { deflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { answerGate, createGate } from "@/lib/engine/gate";
import { checkAgentClip } from "@/lib/flow/agent";
import type { PaperInput, Recording } from "@/lib/flow/session";
import { A4, imagesToPdf } from "@/lib/receipt/assemble";
import { buildEvidence, buildSummary, RECEIPT_LABEL, receiptFilename, type ReceiptInput } from "@/lib/receipt/build";
import { sha256Hex } from "@/lib/receipt/hash";
import { shareOrDownload } from "@/lib/receipt/share";
import { paperWithout, SAMPLE_PAPER } from "./fixtures/paper";

const PRISMA = "आपको 30,000 का loan मिलेगा। EMI 2666 और processing fee नहीं लगेगी।";
const H = (c: string) => c.repeat(64);

function rec(id: number, over: Partial<Recording>): Recording & { sha256: string } {
  return {
    id,
    speaker: "agent",
    step: "agent",
    transcript: "x",
    blob: new Blob(["x"]),
    durationSec: 3.24,
    at: "2026-11-09T09:30:00.000Z",
    sha256: H(String(id % 10)),
    ...over,
  };
}

function input(over: Partial<ReceiptInput> = {}): ReceiptInput {
  const paper: PaperInput = {
    terms: SAMPLE_PAPER,
    missing: [],
    ambiguous: [],
    lender: "Sahyog Finance (fictional)",
    grievance: "Grievance Officer: Mr. A. Sample (fictional), grievance@sahyog.example",
    source: "sample",
  };
  let g = createGate(SAMPLE_PAPER, ["processing_fee", "installment", "amount_in_hand", "missed_payment"]);
  g = answerGate(g.state, "processing_fee", "fee 500");
  g = answerGate(g.state, "processing_fee", "processing fee 1500 rupaye");
  return {
    createdAt: new Date("2026-11-09T09:34:05.000Z"),
    presence: "with_agent",
    paper,
    documentSha256: "abcdef0123456789" + H("a").slice(16),
    recordings: [
      rec(1, { step: "consent", transcript: "मैं रमेश, रिकॉर्डिंग की अनुमति देता हूँ" }),
      rec(2, { field: "processing_fee", transcript: PRISMA }),
      rec(3, { field: "processing_fee", transcript: "processing fee 1500 rupaye" }),
      rec(4, { field: "navigation", transcript: "next" }),
      rec(5, { speaker: "borrower", step: "teachback", field: "processing_fee", transcript: "fee 500" }),
      rec(6, { speaker: "borrower", step: "teachback", field: "processing_fee", transcript: "processing fee 1500 rupaye" }),
    ],
    checks: [
      checkAgentClip("processing_fee", PRISMA, SAMPLE_PAPER), // first: conflict
      checkAgentClip("processing_fee", "processing fee 1500 rupaye", SAMPLE_PAPER), // later: match
      checkAgentClip("installment", "EMI 2666 har mahine", SAMPLE_PAPER),
      checkAgentClip("late_fee", "late fee 5000", SAMPLE_PAPER), // implausible
    ],
    gate: g.state,
    ...over,
  };
}

const row = (s: ReturnType<typeof buildSummary>, f: string) => s.rows.find((r) => r.field === f)!;

describe("page 1: summary", () => {
  it("header: IST time, lender, who was present, short document fingerprint (12 chars)", () => {
    const s = buildSummary(input());
    expect(s.createdIST).toContain("IST");
    expect(s.createdISO).toBe("2026-11-09T09:34:05.000Z");
    expect(s.lender).toBe("Sahyog Finance (fictional)");
    expect(s.presenceEn).toBe("borrower and agent");
    expect(s.documentShort).toBe("abcdef012345");
    expect(s.label).toBe(RECEIPT_LABEL);
    expect(RECEIPT_LABEL).toBe("Proof of understanding — not a signature, not a loan approval");
  });

  it("one row per field with Paper | Agent | Borrower cells", () => {
    const s = buildSummary(input());
    expect(s.rows.map((r) => r.field)).toEqual(["loan_amount", "net_disbursed", "installment", "processing_fee", "tenure", "interest_rate", "late_fee"]);
    expect(row(s, "installment").paper.en).toBe("₹2,666 per month");
    expect(row(s, "installment").agent.mark).toBe("match");
    expect(row(s, "installment").borrower.mark).toBe("unable"); // gate not finished in this fixture
    expect(row(s, "processing_fee").borrower.mark).toBe("match");
    expect(row(s, "tenure").borrower.hi).toBe("—"); // not a teach-back point
  });

  it("agent changed answers: ⚠️ even though the latest matches", () => {
    const r = row(buildSummary(input()), "processing_fee");
    expect(r.changed).toBe(true);
    expect(r.agent.mark).toBe("warn");
    expect(r.agent.hi).toContain("एजेंट ने पहले अलग बताया था");
  });

  it("an implausible agent number is 'couldn't check', never 'different', and makes no lender question", () => {
    const s = buildSummary(input());
    expect(row(s, "late_fee").agent.mark).toBe("unable");
    expect(s.questions.join(" ")).not.toContain("लेट फ़ीस");
  });

  it("missing on paper says so (never ₹0) and becomes a question", () => {
    const s = buildSummary(
      input({ paper: { terms: paperWithout("processing_fee"), missing: ["processing_fee"], ambiguous: [], source: "pdf" }, checks: [], gate: null }),
    );
    expect(row(s, "processing_fee").paper).toEqual({ mark: "unable", hi: "कागज़ पर नहीं लिखा", en: "not on the paper" });
    expect(s.questions).toContain("प्रोसेसिंग फ़ीस कितनी है? कागज़ पर लिखकर दीजिए।");
    expect(s.complaintHi[0]).toContain("शिकायत अधिकारी का नाम लिखकर माँगिए");
    expect(s.outcome).toBeNull();
  });

  it("borrower alone: agent column is a dash", () => {
    const s = buildSummary(input({ presence: "alone", checks: [] }));
    expect(s.rows.every((r) => r.agent.hi === "—")).toBe(true);
  });

  it("no verdict words anywhere", () => {
    const all = JSON.stringify([buildSummary(input()), buildEvidence(input())]);
    expect(all).not.toMatch(/\b(safe|approved|verified|fraud)\b/i);
  });
});

describe("page 2+: evidence log", () => {
  it("terms keep their printed paper line", () => {
    const e = buildEvidence(input());
    expect(e.terms.find((t) => t.en === "Processing fee")).toEqual({
      hi: "प्रोसेसिंग फ़ीस",
      en: "Processing fee",
      value: "₹१,५०० — पंद्रह सौ रुपये", // the receipt language's own digits, then the amount in words
      evidence: "Processing fee: ₹1,500 (deducted upfront)",
    });
  });

  it("comparisons carry both evidence snippets, the attempt count and the ⚠️ flag", () => {
    const c = buildEvidence(input()).comparisons.find((x) => x.en === "Processing fee")!;
    expect(c.paper).toBe("Processing fee: ₹1,500 (deducted upfront)");
    expect(c.agent).toContain("processing fee 1500 rupaye");
    expect(c.attempts).toBe(2);
    expect(c.changed).toBe(true);
  });

  it("every recording (original, re-recording, 'next') is listed with transcript and SHA-256 (16 + full)", () => {
    const i = input();
    const e = buildEvidence(i);
    expect(e.recordings).toHaveLength(i.recordings.length);
    for (const r of i.recordings) {
      const x = e.recordings.find((y) => y.id === r.id)!;
      expect(x.transcript).toBe(r.transcript);
      expect(x.sha16).toBe(r.sha256.slice(0, 16));
      expect(x.sha256).toBe(r.sha256);
    }
    expect(e.recordings.find((r) => r.id === 4)!.what).toContain("not an answer");
    expect(e.recordings[0].durationSec).toBe(3.2);
  });

  it("teach-back tries are kept next to the paper line", () => {
    const t = buildEvidence(input()).teachback.find((x) => x.en === "Processing fee")!;
    expect(t.answers).toEqual(["fee 500", "processing fee 1500 rupaye"]);
    expect(t.paper).toBe("Processing fee: ₹1,500 (deducted upfront)");
  });

  it("filename is a .pdf with local date and time", () => {
    expect(receiptFilename(new Date(2026, 10, 9, 15, 4))).toBe("loanlens-receipt-20261109-1504.pdf");
  });
});

// A tiny valid PNG, so the PDF assembly can be tested in Node (the browser uses JPEG pages).
function png(w: number, h: number): Uint8Array {
  const table = Array.from({ length: 256 }, (_, k) => {
    let c = k;
    for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b: Buffer) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (t: string, d: Buffer) => {
    const l = Buffer.alloc(4);
    l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 255);
  for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return new Uint8Array(
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]),
  );
}

describe("PDF assembly", () => {
  it("one A4 portrait page per image, with title metadata", async () => {
    const bytes = await imagesToPdf(
      [
        { bytes: png(124, 175), kind: "png" },
        { bytes: png(124, 175), kind: "png" },
      ],
      { title: "LoanLens receipt", createdAt: new Date("2026-11-09T09:34:05.000Z") },
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([Math.round(A4.width), Math.round(A4.height)]);
    expect(doc.getTitle()).toBe("LoanLens receipt");
  });

  it("same input -> identical bytes (so both parties' fingerprints match)", async () => {
    const make = () => imagesToPdf([{ bytes: png(40, 56), kind: "png" }], { title: "t", createdAt: new Date("2026-11-09T09:34:05.000Z") });
    expect(await sha256Hex(await make())).toBe(await sha256Hex(await make()));
  });
});

describe("SHA-256", () => {
  it("matches the standard test vector, for bytes and Blobs", async () => {
    const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(abc);
    expect(await sha256Hex(new Blob(["abc"]))).toBe(abc);
  });
});

describe("share with download fallback", () => {
  afterEach(() => vi.unstubAllGlobals());
  const pdf = new Blob(["%PDF-1.7"], { type: "application/pdf" });

  it("shares the PDF as application/pdf when files can be shared", async () => {
    const share = vi.fn(async () => undefined);
    const nav = { canShare: () => true, share } as unknown as Navigator;
    expect(await shareOrDownload(pdf, "r.pdf", nav)).toBe("shared");
    const f = (share.mock.calls[0] as unknown as [ShareData])[0].files![0];
    expect([f.name, f.type]).toEqual(["r.pdf", "application/pdf"]);
  });

  it("closing the share sheet is 'cancelled', not a download", async () => {
    const nav = { canShare: () => true, share: async () => Promise.reject(new DOMException("x", "AbortError")) } as unknown as Navigator;
    expect(await shareOrDownload(pdf, "r.pdf", nav)).toBe("cancelled");
  });

  it("falls back to a download when sharing files is not supported (desktop)", async () => {
    const click = vi.fn();
    const a = { href: "", download: "", click, remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => a, body: { appendChild: vi.fn() } });
    expect(await shareOrDownload(pdf, "r.pdf", {} as Navigator)).toBe("downloaded");
    expect(a.download).toBe("r.pdf");
    expect(click).toHaveBeenCalledOnce();
  });
});
