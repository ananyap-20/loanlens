import { afterEach, describe, expect, it, vi } from "vitest";
import { answerGate, createGate } from "@/lib/engine/gate";
import { checkAgentClip } from "@/lib/flow/agent";
import type { PaperInput, Recording } from "@/lib/flow/session";
import { buildReceipt, RECEIPT_LABEL, receiptFilename, type ReceiptInput } from "@/lib/receipt/build";
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
    durationSec: 3.2,
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
  const wrong = checkAgentClip("processing_fee", PRISMA, SAMPLE_PAPER);
  const again = checkAgentClip("processing_fee", "processing fee nahi hai", SAMPLE_PAPER);
  let g = createGate(SAMPLE_PAPER, ["processing_fee", "installment", "amount_in_hand", "missed_payment"]);
  g = answerGate(g.state, "processing_fee", "fee 500");
  g = answerGate(g.state, "processing_fee", "processing fee 1500 rupaye");
  return {
    createdAt: new Date("2026-11-09T09:34:05.000Z"),
    presence: "with_agent",
    paper,
    documentSha256: H("a"),
    recordings: [
      rec(1, { step: "consent", transcript: "मैं रमेश, रिकॉर्डिंग की अनुमति देता हूँ" }),
      rec(2, { field: "processing_fee", transcript: PRISMA }),
      rec(3, { field: "processing_fee", transcript: "processing fee nahi hai" }),
      rec(4, { speaker: "borrower", step: "teachback", field: "processing_fee", transcript: "fee 500" }),
      rec(5, { speaker: "borrower", step: "teachback", field: "processing_fee", transcript: "processing fee 1500 rupaye" }),
    ],
    checks: [wrong, again],
    gate: g.state,
    ...over,
  };
}

const text = (i: ReceiptInput) => buildReceipt(i).map((l) => l.text).join("\n");

describe("receipt content (CLAUDE.md section 8)", () => {
  it("carries the required label at the top and bottom", () => {
    const lines = buildReceipt(input());
    expect(lines[1]).toEqual({ text: RECEIPT_LABEL, style: "label" });
    expect(lines.filter((l) => l.text === RECEIPT_LABEL)).toHaveLength(2);
    expect(RECEIPT_LABEL).toBe("Proof of understanding — not a signature, not a loan approval");
  });

  it("has the timestamp (IST and ISO) and the document fingerprint", () => {
    const t = text(input());
    expect(t).toContain("2026-11-09T09:34:05.000Z");
    expect(t).toContain("IST");
    expect(t).toContain(`Document SHA-256: ${H("a")}`);
  });

  it("lists every term with its paper evidence", () => {
    const t = text(input());
    expect(t).toContain("Processing fee: ₹1,500");
    expect(t).toContain("Instalment (EMI): ₹2,666 per month");
    expect(t).toContain("paper: “Processing fee: ₹1,500 (deducted upfront)”");
  });

  it("shows each agent comparison with BOTH evidence snippets; the latest re-recording counts", () => {
    const t = text(input());
    expect(t).toContain("Processing fee: ❌ different");
    expect(t).toContain("paper: “Processing fee: ₹1,500 (deducted upfront)”");
    expect(t).toMatch(/agent: “[^”]*नहीं[^”]*”|agent: “[^”]*nahi[^”]*”/);
    expect(t).toContain("2 recordings for this point; the latest counts");
  });

  it("lists all transcripts (original and re-recordings) with each clip's SHA-256", () => {
    const i = input();
    const t = text(i);
    for (const r of i.recordings) {
      expect(t).toContain(`“${r.transcript}”`);
      expect(t).toContain(`SHA-256: ${r.sha256}`);
    }
    expect(t).toContain("#3 Agent · agent check · Processing fee");
    expect(t).toContain("#4 Borrower · teach-back · Processing fee");
  });

  it("teach-back: every try is listed next to the paper evidence", () => {
    const t = text(input());
    expect(t).toContain("borrower, try 1: “fee 500”");
    expect(t).toContain("borrower, try 2: “processing fee 1500 rupaye”");
    expect(t).toContain("Processing fee: ✅ matched");
  });

  it("missing fields say 'not on the paper' (never ₹0) and questions + grievance path are included", () => {
    const i = input({
      paper: { terms: paperWithout("processing_fee"), missing: ["processing_fee"], ambiguous: [], source: "pdf" },
      checks: [],
      gate: null,
    });
    const t = text(i);
    expect(t).toContain("Processing fee: not on the paper");
    expect(t).not.toContain("Processing fee: ₹0");
    expect(t).toContain("प्रोसेसिंग फ़ीस कितनी है? कागज़ पर लिखकर दीजिए।");
    expect(t).toContain("Ask the lender for the grievance officer's name in writing.");
    expect(t).toContain("cms.rbi.org.in");
  });

  it("uses no verdict words", () => {
    expect(text(input())).not.toMatch(/\b(safe|approved|verified|fraud)\b/i);
  });

  it("filename uses the local date and time", () => {
    expect(receiptFilename(new Date(2026, 10, 9, 15, 4))).toBe("loanlens-receipt-20261109-1504.png");
  });
});

describe("SHA-256", () => {
  it("matches the standard test vector, for bytes and Blobs", async () => {
    const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe(abc);
    expect(await sha256Hex(new Blob(["abc"]))).toBe(abc);
  });
  it("does not consume the caller's bytes", async () => {
    const b = new TextEncoder().encode("abc");
    await sha256Hex(b);
    expect(b.byteLength).toBe(3);
  });
});

describe("share with download fallback", () => {
  afterEach(() => vi.unstubAllGlobals());
  const png = new Blob(["png"], { type: "image/png" });

  it("uses the Web Share API when files can be shared", async () => {
    const share = vi.fn(async () => undefined);
    const nav = { canShare: () => true, share } as unknown as Navigator;
    expect(await shareOrDownload(png, "r.png", nav)).toBe("shared");
    expect((share.mock.calls[0] as unknown as [ShareData])[0].files?.[0].name).toBe("r.png");
  });

  it("closing the share sheet is 'cancelled', not a download", async () => {
    const nav = { canShare: () => true, share: async () => Promise.reject(new DOMException("x", "AbortError")) } as unknown as Navigator;
    expect(await shareOrDownload(png, "r.png", nav)).toBe("cancelled");
  });

  it("falls back to a download when sharing files is not supported (desktop)", async () => {
    const click = vi.fn();
    const a = { href: "", download: "", click, remove: vi.fn() };
    vi.stubGlobal("document", { createElement: () => a, body: { appendChild: vi.fn() } });
    expect(await shareOrDownload(png, "r.png", {} as Navigator)).toBe("downloaded");
    expect(a.download).toBe("r.png");
    expect(a.href).toMatch(/^blob:/);
    expect(click).toHaveBeenCalledOnce();
  });
});
