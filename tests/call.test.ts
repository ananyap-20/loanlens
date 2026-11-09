// Call check (P1-b): chunking, whole-transcript claim extraction, comparison with the paper.
import { describe, expect, it } from "vitest";
import { checkCall, rowsAsChecks } from "@/lib/call/check";
import { CALL_CHUNK_SECONDS, planChunks, toMono } from "@/lib/call/chunks";
import { lenderQuestions } from "@/lib/flow/teachback";
import { PACKS } from "@/lib/i18n";
import { SAMPLE_CALL_TURNS } from "../scripts/sample-call";
import { SAMPLE_PAPER } from "./fixtures/paper";

const RATE = 16000;
const facts = { terms: SAMPLE_PAPER, missing: [], ambiguous: [] };
const status = (r: ReturnType<typeof checkCall>, f: string) => r.rows.find((x) => x.field === f)!.status;

describe("planChunks", () => {
  it("a short call is one piece", () => {
    expect(planChunks(new Float32Array(10 * RATE), RATE)).toEqual([[0, 10 * RATE]]);
  });

  it("every piece is at most 28 s, pieces are contiguous and cover the whole call", () => {
    const n = 95 * RATE + 123;
    const s = new Float32Array(n).map((_, i) => Math.sin(i / 7) * 0.5); // loud everywhere
    const plan = planChunks(s, RATE);
    expect(plan[0][0]).toBe(0);
    expect(plan.at(-1)![1]).toBe(n);
    for (let i = 0; i < plan.length; i++) {
      expect(plan[i][1] - plan[i][0]).toBeLessThanOrEqual(CALL_CHUNK_SECONDS * RATE);
      expect(plan[i][1]).toBeGreaterThan(plan[i][0]);
      if (i) expect(plan[i][0]).toBe(plan[i - 1][1]);
    }
    expect(plan.length).toBe(4);
  });

  it("cuts at a quiet moment near the limit instead of mid-word", () => {
    const s = new Float32Array(40 * RATE).fill(0.5);
    s.fill(0, 26 * RATE, 26.3 * RATE); // a pause at 26.0–26.3 s
    const [[, end]] = planChunks(s, RATE);
    expect(end / RATE).toBeGreaterThanOrEqual(26);
    expect(end / RATE).toBeLessThanOrEqual(26.3);
  });

  it("toMono averages channels", () => {
    expect([...toMono([new Float32Array([1, 0]), new Float32Array([0, 1])])]).toEqual([0.5, 0.5]);
  });
});

describe("checkCall — the whole transcript, the same engine", () => {
  const callText = SAMPLE_CALL_TURNS.map((t) => t.text).join(" ");

  it("the sample call: fee, amount in hand and late fee differ; EMI, tenure and loan match", () => {
    const r = checkCall(callText, SAMPLE_PAPER);
    expect(status(r, "processing_fee")).toBe("conflict"); // "koi processing fee nahi" vs ₹1,500
    expect(status(r, "net_disbursed")).toBe("conflict"); // "poore tees hazaar haath mein" vs ₹28,500
    expect(status(r, "late_fee")).toBe("conflict"); // "koi jurmana nahi" vs ₹200
    expect(status(r, "installment")).toBe("match");
    expect(status(r, "tenure")).toBe("match");
    expect(status(r, "loan_amount")).toBe("match");
    expect(status(r, "interest_rate")).toBe("not_mentioned");
  });

  it("the same call as Prisma digits (format=transcribe) gives the same result", () => {
    const digits =
      "नमस्ते, मैं सहयोग फ़ाइनेंस से बोल रहा हूँ। आपका 30,000 रुपये का लोन तैयार है। किस्त कितनी होगी? किस्त 2666 रुपये हर महीने, 12 महीने तक। कोई processing fee है? नहीं जी, कोई processing fee नहीं लगेगी। पूरे 30,000 रुपये आपके हाथ में आएँगे। और देर होने पर? देर होने पर कोई जुर्माना नहीं है।";
    const a = checkCall(callText, SAMPLE_PAPER).rows.map((x) => x.status);
    expect(checkCall(digits, SAMPLE_PAPER).rows.map((x) => x.status)).toEqual(a);
  });

  it("questions for the lender come from the differences", () => {
    const r = checkCall(callText, SAMPLE_PAPER);
    const q = lenderQuestions(facts, rowsAsChecks(r.rows, callText));
    expect(q.some((x) => x.startsWith("प्रोसेसिंग फ़ीस: एजेंट ने कहा यह नहीं लगेगी"))).toBe(true);
    expect(q.length).toBe(3);
  });

  it("numbers with no field word are dropped, never guessed; empty call = nothing mentioned", () => {
    expect(checkCall("हाँ जी 1500 ठीक है", SAMPLE_PAPER).rows.every((x) => x.status === "not_mentioned")).toBe(true);
    expect(checkCall("", SAMPLE_PAPER).counts.not_mentioned).toBe(7);
  });

  it("works in English through the pack's normaliser", () => {
    const en = PACKS.en;
    const r = checkCall("The loan is thirty thousand rupees. There is no processing fee. The EMI is two thousand six hundred sixty-six every month.", SAMPLE_PAPER, en.normalize);
    expect(status(r, "processing_fee")).toBe("conflict");
    expect(status(r, "installment")).toBe("match");
    expect(status(r, "loan_amount")).toBe("match");
  });

  it("no verdict words in what the call check says", () => {
    const r = checkCall(callText, SAMPLE_PAPER);
    const spoken = rowsAsChecks(r.rows, callText).map((c) => PACKS.en.say!.agentFlag(c)).join(" ");
    expect(spoken).not.toMatch(/\b(safe|approved|verified|fraud)\b/i);
  });
});
