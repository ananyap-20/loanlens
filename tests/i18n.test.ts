// Language packs: visibility, Gnani config, Hindi unchanged, and per-pack deterministic number + keyword rules.
import { describe, expect, it } from "vitest";
import { isNavigationOnly } from "@/lib/engine";
import { answerGate, createGate, GATE_FIELDS } from "@/lib/engine/gate";
import { AGENT_FIELDS, checkAgentClip } from "@/lib/flow/agent";
import { explainPaper, FIELD_NAME_HI, SAY } from "@/lib/flow/scripts";
import { gatePrompt, lenderQuestions, resultSpeech } from "@/lib/flow/teachback";
import { getPack, PACKS, visiblePacks, voiceFor } from "@/lib/i18n";
import { englishWords } from "@/lib/i18n/packs/en";
import { marathiWords } from "@/lib/i18n/packs/mr";
import type { LangPack } from "@/lib/i18n/types";
import { buildSummary } from "@/lib/receipt/build";
import { HI_RECEIPT } from "@/lib/receipt/strings";
import { SAMPLE_PAPER } from "./fixtures/paper";

const DIGIT = /[0-9०-९]/;
const facts = { terms: SAMPLE_PAPER, missing: [], ambiguous: [] };
const en = PACKS.en;
const mr = PACKS.mr;
const agent = (p: LangPack, field: (typeof AGENT_FIELDS)[number], said: string) => checkAgentClip(field, p.normalize(said), SAMPLE_PAPER);

describe("packs and picker", () => {
  it("only hi, en and mr are in the picker; the other seven are unverified and hidden", () => {
    expect(visiblePacks().map((p) => p.code)).toEqual(["hi", "en", "mr"]);
    for (const c of ["bn", "gu", "kn", "ml", "pa", "ta", "te"] as const) {
      const p = PACKS[c];
      expect(p.verified).toBe(false);
      expect(p.numberToWords).toBeNull(); // never invented
      expect(p.say).toBeNull();
      expect(p.lexicon.numberWords).toEqual([]);
      expect(getPack(c).code).toBe("hi"); // an unverified pack can never be selected
    }
  });

  it("Prisma codes and Timbre v2.5 voices match docs.gnani.ai", () => {
    expect(Object.values(PACKS).map((p) => p.prisma.language_code.split(",")[0]).sort()).toEqual(
      ["bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN", "mr-IN", "pa-IN", "ta-IN", "te-IN"],
    );
    expect(PACKS.hi.timbre.voices).toEqual({ female: "Nalini", male: "Deepak" });
    expect(en.timbre).toEqual({ language: "en-IN", voices: { female: "Kaveri", male: "Pranav" } });
    expect(mr.timbre).toEqual({ language: "mr-IN", voices: { female: "Zahira", male: "Ishaan" } });
    expect(voiceFor(PACKS.ta, "male")).toEqual({ voice: "Asmita", gender: "female" }); // no male Tamil voice listed
  });

  it("Hindi pack is the existing Hindi, unchanged", () => {
    const hi = getPack("hi");
    expect(hi.normalize("processing fee नहीं लगेगी")).toBe("processing fee नहीं लगेगी");
    expect(hi.say.explainPaper(facts)).toBe(explainPaper(facts));
    expect(hi.say.who).toBe(SAY.who);
    expect(hi.say.lenderQuestions).toBe(lenderQuestions);
    expect(hi.say.resultSpeech).toBe(resultSpeech);
    expect(hi.say.gatePrompt).toBe(gatePrompt);
    expect(hi.ui.fieldName).toBe(FIELD_NAME_HI);
    expect(hi.receipt).toBe(HI_RECEIPT);
    expect(getPack(null).code).toBe("hi");
  });
});

describe("English", () => {
  it("number words, Indian system", () => {
    expect(englishWords(2666)).toBe("two thousand six hundred sixty-six");
    expect(englishWords(30000)).toBe("thirty thousand");
    expect(englishWords(28500)).toBe("twenty-eight thousand five hundred");
    expect(englishWords(150000)).toBe("one lakh fifty thousand");
  });

  it("words -> digits for the engine (and back again)", () => {
    expect(en.normalize("EMI is two thousand six hundred and sixty-six every month")).toBe("EMI is 2666 every month");
    expect(en.normalize("processing fee fifteen hundred rupees")).toBe("processing fee 1500 rupees");
    expect(en.normalize("one lakh twenty thousand")).toBe("120000");
    for (const n of [0, 7, 19, 66, 100, 200, 1500, 2666, 28500, 30000, 150000, 2500000]) expect(en.normalize(englishWords(n))).toBe(String(n));
  });

  it("same engine results as Hindi", () => {
    expect(agent(en, "processing_fee", "The processing fee is fifteen hundred rupees").status).toBe("match");
    expect(agent(en, "processing_fee", "There is no processing fee").status).toBe("conflict");
    expect(agent(en, "installment", "EMI is two thousand six hundred and sixty-six every month").status).toBe("match");
    expect(agent(en, "installment", "EMI 2666 every week").status).toBe("unable_to_verify");
    expect(agent(en, "loan_amount", "The loan is thirty thousand rupees").status).toBe("match");
  });

  it("an unknown word is never guessed as a number", () => {
    expect(agent(en, "processing_fee", "processing fee is umpteen").status).not.toBe("match");
    expect(agent(en, "processing_fee", "processing fee is umpteen").spoken.every((v) => v.amount === undefined || v.negated)).toBe(true);
  });

  it("teach-back and navigation", () => {
    const g = createGate(SAMPLE_PAPER, ["missed_payment"]).state;
    expect(answerGate(g, "missed_payment", en.normalize("there will be a penalty")).outcome).toBe("pass");
    expect(answerGate(createGate(SAMPLE_PAPER, ["amount_in_hand"]).state, "amount_in_hand", en.normalize("twenty-eight thousand five hundred rupees in hand")).outcome).toBe("pass");
    expect(isNavigationOnly(en.normalize("next please"))).toBe(true);
  });
});

describe("Marathi", () => {
  it("number words: standard 0–99 and hundreds by rule", () => {
    expect(marathiWords(2666)).toBe("दोन हजार सहाशे सहासष्ट");
    expect(marathiWords(30000)).toBe("तीस हजार");
    expect(marathiWords(28500)).toBe("अठ्ठावीस हजार पाचशे");
    expect(marathiWords(1500)).toBe("एक हजार पाचशे");
    expect(marathiWords(100)).toBe("शंभर");
    expect(marathiWords(150)).toBe("एकशे पन्नास");
  });

  it("words -> digits (round trip, fractions, Xशे hundreds)", () => {
    for (const n of [0, 6, 19, 66, 99, 100, 150, 200, 1500, 2666, 28500, 30000, 150000]) expect(mr.normalize(marathiWords(n))).toBe(String(n));
    expect(mr.normalize("पंधराशे")).toBe("1500");
    expect(mr.normalize("दीड हजार")).toBe("1500");
    expect(mr.normalize("साडे तीन हजार")).toBe("3500");
  });

  it("Marathi keywords reach the same engine", () => {
    expect(agent(mr, "processing_fee", "प्रक्रिया शुल्क पंधराशे रुपये आहे").status).toBe("match");
    expect(agent(mr, "processing_fee", "प्रक्रिया शुल्क नाही").status).toBe("conflict");
    expect(agent(mr, "installment", "हप्ता दोन हजार सहाशे सहासष्ट रुपये दर महिन्याला").status).toBe("match");
    expect(agent(mr, "installment", "हप्ता 2666 दर आठवड्याला").status).toBe("unable_to_verify");
    expect(agent(mr, "loan_amount", "कर्ज तीस हजार रुपयांचे आहे").status).toBe("match");
    expect(agent(mr, "processing_fee", "प्रक्रिया शुल्क माहीत नाही").status).toBe("unable_to_verify");
  });

  it("an unknown Marathi number word is not guessed", () => {
    const c = agent(mr, "processing_fee", "प्रक्रिया शुल्क खूप आहे");
    expect(c.status).not.toBe("match");
    expect(c.status).not.toBe("conflict");
  });

  it("teach-back keyword and navigation", () => {
    expect(answerGate(createGate(SAMPLE_PAPER, ["missed_payment"]).state, "missed_payment", mr.normalize("दंड लागेल")).outcome).toBe("pass");
    expect(isNavigationOnly(mr.normalize("पुढे"))).toBe(true);
  });
});

describe("spoken text in each verified pack", () => {
  for (const p of [en, mr]) {
    it(`${p.code}: never contains digits, never uses verdict words, stays under the Timbre limit`, () => {
      const s = p.say!;
      const texts = [
        ...Object.values(s).filter((v): v is string => typeof v === "string"),
        ...Object.values(s.paperFail),
        ...Object.values(s.agentAsk),
        s.handover.agent,
        s.handover.borrower,
        s.explainPaper(facts),
        s.explainPaper({ terms: [], missing: ["processing_fee", "late_fee"], ambiguous: ["installment"] }),
        ...AGENT_FIELDS.flatMap((f) =>
          ["fee nahi", "30000", "pata nahi", "EMI 2500 har mahine", "5", "x"].map((t) => s.agentFlag(checkAgentClip(f, t, SAMPLE_PAPER))),
        ),
        ...GATE_FIELDS.map((f) => s.gatePrompt({ kind: "re_explain_and_ask", field: f, speed: 0.85 }, SAMPLE_PAPER, "wrong").text),
        s.gatePrompt({ kind: "ask", field: "missed_payment" }, SAMPLE_PAPER, undefined, true).text,
        ...(["passed", "stopped"] as const).map((k) =>
          s.resultSpeech(k, s.lenderQuestions(facts, [checkAgentClip("processing_fee", "fee nahi", SAMPLE_PAPER)]), true),
        ),
      ];
      for (const t of texts) {
        expect(t).not.toMatch(DIGIT);
        expect(t).not.toMatch(/\b(safe|approved|verified|fraud)\b/i);
        expect(t.length).toBeLessThan(1000);
      }
    });
  }

  it("the missed-instalment question exists in every verified pack", () => {
    expect(en.ui!.gateAsk.missed_payment).toBe("If you cannot pay one instalment, what will happen?");
    expect(mr.ui!.gateAsk.missed_payment).toBe("एक हप्ता भरता आला नाही, तर काय होईल?");
  });
});

describe("receipt in the selected language", () => {
  const input = {
    createdAt: new Date("2026-11-09T09:34:05.000Z"),
    presence: "alone" as const,
    paper: { terms: SAMPLE_PAPER, missing: [], ambiguous: [], source: "sample" as const },
    documentSha256: null,
    recordings: [],
    checks: [],
    gate: null,
  };
  it("Marathi labels on the summary; Hindi by default", () => {
    const lang = { strings: mr.receipt!, fieldName: mr.ui!.fieldName, reason: mr.ui!.reason, lenderQuestions: mr.say!.lenderQuestions };
    const s = buildSummary(input, lang);
    expect(s.rows[0].hi).toBe("कर्जाची रक्कम");
    expect(s.labelHi).toBe(mr.receipt!.label);
    expect(s.rows.find((r) => r.field === "installment")!.paper.hi).toBe("₹2,666 दर महिन्याला");
    expect(buildSummary(input).rows[0].hi).toBe(FIELD_NAME_HI.loan_amount);
    expect(s.label).toBe("Proof of understanding — not a signature, not a loan approval"); // the English label is always there
  });
});
