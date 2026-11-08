import { describe, expect, it } from "vitest";
import { AGENT_ASK, AGENT_FIELDS, checkAgentClip, CONSENT_DONE, CONSENT_SAY } from "@/lib/flow/agent";
import { paperWithout, SAMPLE_PAPER } from "./fixtures/paper";

const DIGIT = /[0-9०-९]/;
// Real Prisma v3.0 output from the Gnani playground (CLAUDE.md section 6).
const PRISMA = "आपको 30,000 का loan मिलेगा। EMI 2666 और processing fee नहीं लगेगी।";

describe("agent check, one field per clip", () => {
  it("fee: 'processing fee नहीं लगेगी' vs ₹1,500 on paper is a difference, with a spoken flag", () => {
    const c = checkAgentClip("processing_fee", PRISMA, SAMPLE_PAPER);
    expect(c.status).toBe("conflict");
    expect(c.flag).toContain("एजेंट ने कहा प्रोसेसिंग फ़ीस नहीं लगेगी");
    expect(c.flag).toContain("पंद्रह सौ रुपये");
    expect(c.flag).not.toMatch(DIGIT);
  });

  it("EMI 2666 matches the paper", () => {
    expect(checkAgentClip("installment", PRISMA, SAMPLE_PAPER).status).toBe("match");
  });

  it("loan amount 30,000 matches", () => {
    expect(checkAgentClip("loan_amount", PRISMA, SAMPLE_PAPER).status).toBe("match");
  });

  it("a different EMI is a difference and says both numbers in words", () => {
    const c = checkAgentClip("installment", "किस्त 2500 रुपये हर महीने", SAMPLE_PAPER);
    expect(c.status).toBe("conflict");
    expect(c.flag).toContain("दो हज़ार पाँच सौ रुपये");
    expect(c.flag).toContain("दो हज़ार छह सौ छियासठ रुपये");
  });

  it("Hinglish words: 'processing fee pandrah sau hai' matches", () => {
    expect(checkAgentClip("processing_fee", "processing fee pandrah sau hai", SAMPLE_PAPER).status).toBe("match");
  });

  it("talking about something else -> not mentioned (never 0)", () => {
    const c = checkAgentClip("late_fee", "loan 30000 ka hai", SAMPLE_PAPER);
    expect(c.status).toBe("not_mentioned");
    expect(c.spoken).toEqual([]);
  });

  it("'pata nahi' -> couldn't check", () => {
    expect(checkAgentClip("processing_fee", "processing fee pata nahi, shayad 1500", SAMPLE_PAPER).status).toBe("unable_to_verify");
  });

  it("weekly EMI vs a monthly paper -> couldn't check, not a difference", () => {
    expect(checkAgentClip("installment", "EMI 2666 har hafte", SAMPLE_PAPER).status).toBe("unable_to_verify");
  });

  it("field missing on the paper -> couldn't check, says it is not on the paper", () => {
    const c = checkAgentClip("processing_fee", "processing fee 1500", paperWithout("processing_fee"));
    expect(c.status).toBe("unable_to_verify");
    expect(c.flag).toContain("कागज़ पर नहीं लिखी है");
  });

  it("all agent prompts are digit-free and cover the five fields", () => {
    expect(Object.keys(AGENT_ASK).sort()).toEqual([...AGENT_FIELDS].sort());
    for (const s of [...Object.values(AGENT_ASK), CONSENT_SAY, CONSENT_DONE]) expect(s).not.toMatch(DIGIT);
  });

  it("no flag uses verdict words", () => {
    const texts = AGENT_FIELDS.flatMap((f) =>
      ["", "30000", "nahi", "pata nahi", "EMI 2666"].map((t) => checkAgentClip(f, t || "kuch aur", SAMPLE_PAPER).flag),
    );
    for (const t of texts) expect(t).not.toMatch(/safe|approved|verified|fraud|सुरक्षित|मंज़ूर|धोखा/i);
  });
});
