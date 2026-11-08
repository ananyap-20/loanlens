import { describe, expect, it } from "vitest";
import { answerGate, createGate, GATE_FIELDS, type GateFieldId } from "@/lib/engine/gate";
import { checkAgentClip } from "@/lib/flow/agent";
import {
  FOLLOW_UP_HI,
  GATE_ASK_HI,
  gatePrompt,
  lenderQuestions,
  reExplainHi,
  resultSpeech,
  STOP_HI,
  TEACHBACK_INTRO,
} from "@/lib/flow/teachback";
import { paperWithout, SAMPLE_PAPER } from "./fixtures/paper";

const DIGIT = /[0-9०-९]/;
const facts = { terms: SAMPLE_PAPER, missing: [], ambiguous: [] };

describe("teach-back prompts", () => {
  it("the first question starts with the intro; the missed-instalment question is asked as written", () => {
    expect(gatePrompt({ kind: "ask", field: "missed_payment" }, SAMPLE_PAPER, undefined, true).text).toBe(
      `${TEACHBACK_INTRO} अगर एक किस्त न दे पाएँ, तो क्या होगा?`,
    );
  });

  it("a wrong answer re-explains that field slowly with the paper value, then asks again", () => {
    const p = gatePrompt({ kind: "re_explain_and_ask", field: "processing_fee", speed: 0.85 }, SAMPLE_PAPER, "wrong");
    expect(p.slow).toBe(true);
    expect(p.text).toContain("प्रोसेसिंग फ़ीस पंद्रह सौ रुपये है");
    expect(p.text).toContain(GATE_ASK_HI.processing_fee);
  });

  it("re-explaining the amount in hand uses net disbursed, else the loan amount", () => {
    expect(reExplainHi("amount_in_hand", SAMPLE_PAPER)).toContain("अट्ठाईस हज़ार पाँच सौ");
    expect(reExplainHi("amount_in_hand", paperWithout("net_disbursed"))).toContain("तीस हज़ार");
  });

  it("no late fee on paper: re-explain says so instead of inventing an amount", () => {
    expect(reExplainHi("missed_payment", paperWithout("late_fee"))).toContain("कागज़ पर लेट फ़ीस नहीं लिखी है");
  });

  it("every prompt, for every gate step, is digit-free", () => {
    const texts = [
      ...Object.values(GATE_ASK_HI),
      ...Object.values(FOLLOW_UP_HI),
      ...GATE_FIELDS.map((f) => gatePrompt({ kind: "re_explain_and_ask", field: f, speed: 0.85 }, SAMPLE_PAPER, "wrong").text),
      ...GATE_FIELDS.map((f) => reExplainHi(f, paperWithout("late_fee", "net_disbursed"))),
      STOP_HI,
    ];
    for (const t of texts) expect(t).not.toMatch(DIGIT);
  });
});

describe("a full gate run, driven like the screen drives it", () => {
  const ANSWERS: Record<GateFieldId, string> = {
    amount_in_hand: "मेरे हाथ में 28,500 रुपये आएँगे",
    installment: "किस्त 2666 रुपये हर महीने",
    processing_fee: "processing fee 1500 rupaye",
    missed_payment: "किस्त छूटी तो 200 रुपये late fee लगेगी",
  };

  it("correct answers in random order -> passed", () => {
    let { state, next } = createGate(SAMPLE_PAPER, ["missed_payment", "processing_fee", "installment", "amount_in_hand"]);
    const spoken: string[] = [];
    while (next.kind === "ask") {
      spoken.push(gatePrompt(next, SAMPLE_PAPER).text);
      ({ state, next } = answerGate(state, next.field, ANSWERS[next.field]));
    }
    expect(next.kind).toBe("passed");
    expect(spoken[0]).toBe(GATE_ASK_HI.missed_payment);
    expect(state.result).toBe("passed");
  });

  it("three wrong fee answers -> stop, and the result names what to ask", () => {
    let { state, next } = createGate(SAMPLE_PAPER, ["processing_fee", "installment", "amount_in_hand", "missed_payment"]);
    for (let i = 0; i < 3; i++) ({ state, next } = answerGate(state, "processing_fee", "processing fee 500"));
    expect(next.kind).toBe("stop");
    expect(gatePrompt(next, SAMPLE_PAPER).text).toBe(STOP_HI);
    const q = lenderQuestions(facts, [], state.fields);
    expect(q).toContain("प्रोसेसिंग फ़ीस, मुझे फिर से, धीरे-धीरे समझाइए।");
  });
});

describe("result screen", () => {
  it("an agent fee difference becomes a question for the lender", () => {
    const c = checkAgentClip("processing_fee", "processing fee नहीं लगेगी", SAMPLE_PAPER);
    const q = lenderQuestions(facts, [c]);
    expect(q[0]).toBe("प्रोसेसिंग फ़ीस: एजेंट ने कहा यह नहीं लगेगी, पर कागज़ पर पंद्रह सौ रुपये है। कौन-सा सही है? लिखकर दीजिए।");
  });

  it("only the latest attempt per field counts (a re-record that matches clears the question)", () => {
    const wrong = checkAgentClip("processing_fee", "processing fee नहीं लगेगी", SAMPLE_PAPER);
    const right = checkAgentClip("processing_fee", "processing fee 1500", SAMPLE_PAPER);
    expect(lenderQuestions(facts, [wrong, right])).toEqual(["कुल मिलाकर मुझे कितना चुकाना होगा? लिखकर दीजिए।"]);
  });

  it("missing paper fields become questions", () => {
    expect(lenderQuestions({ terms: paperWithout("processing_fee"), missing: ["processing_fee"], ambiguous: [] })).toEqual([
      "प्रोसेसिंग फ़ीस कितनी है? कागज़ पर लिखकर दीजिए।",
    ]);
  });

  it("speech: outcome + questions + grievance path, digit-free and under the Timbre limit", () => {
    const c = checkAgentClip("processing_fee", "processing fee नहीं लगेगी", SAMPLE_PAPER);
    for (const kind of ["passed", "stopped"] as const) {
      for (const g of [true, false]) {
        const t = resultSpeech(kind, lenderQuestions(facts, [c]), g);
        expect(t).not.toMatch(DIGIT);
        expect(t.length).toBeLessThan(1000);
        expect(t).toContain("सी एम एस डॉट आर बी आई डॉट ओ आर जी डॉट इन");
        expect(t).not.toMatch(/safe|approved|verified|fraud|सुरक्षित|धोखा/i);
      }
    }
    expect(resultSpeech("passed", ["x"], true)).toContain("समझ का सबूत है, साइन के साथ");
    expect(resultSpeech("stopped", ["x"], true)).toContain(STOP_HI);
  });
});
