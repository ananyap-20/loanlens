// Teach-back prompts and the result screen's spoken text. The DECISIONS are made by lib/engine/gate.ts;
// this file only turns its NextStep into spoken Hindi (numbers as words). Pure, no AI.
import type { AnswerOutcome, FollowUpKey, GateFieldId, GateFieldStatus, NextStep } from "@/lib/engine/gate";
import type { Field, Value } from "@/lib/engine/types";
import type { AgentCheck } from "./agent";
import { FIELD_NAME_HI, valueHi, type PaperFacts } from "./scripts";

export const TEACHBACK_INTRO = "अब आप अपने शब्दों में बताइए। हर सवाल के बाद माइक वाला बटन दबाकर बोलिए, फिर दोबारा दबाइए।";

export const GATE_FIELD_HI: Record<GateFieldId, string> = {
  amount_in_hand: "हाथ में आने वाली रक़म",
  installment: "किस्त",
  processing_fee: "प्रोसेसिंग फ़ीस",
  missed_payment: "किस्त छूटने पर क्या होगा",
};

/** Open questions, asked in the random order chosen by the gate. */
export const GATE_ASK_HI: Record<GateFieldId, string> = {
  amount_in_hand: "आपके हाथ में कितने रुपये आएँगे?",
  installment: "किस्त कितने रुपये की है, और कब-कब देनी है?",
  processing_fee: "प्रोसेसिंग फ़ीस कितनी है?",
  missed_payment: "अगर एक किस्त न दे पाएँ, तो क्या होगा?",
};

/** Spoken versions of the gate's FOLLOW_UP_QUESTIONS (same meaning, Devanagari for Timbre). */
export const FOLLOW_UP_HI: Record<FollowUpKey, string> = {
  amount_in_hand: "आपके हाथ में कितने रुपये आएँगे? रक़म बोलिए।",
  installment_amount: "किस्त कितने रुपये की है? रक़म बोलिए।",
  installment_frequency: "किस्त हर महीने देनी है या हर हफ़्ते?",
  processing_fee: "प्रोसेसिंग फ़ीस कितनी है? रक़म बोलिए।",
  missed_payment: "अगर एक किस्त न दे पाएँ, तो क्या होगा? क्या लगेगा?",
};

export const STOP_HI = "अभी साइन मत कीजिए। किसी भरोसे वाले को साथ लाइए।";
const MATCHED_HI = "ठीक है, यह कागज़ से मिलता है।";

const get = (paper: Value[], f: Field) => paper.find((v) => v.field === f && v.source === "paper" && v.amount !== undefined);

/** The paper's fact for one gate field, said again (slowly) after a wrong answer. */
export function reExplainHi(field: GateFieldId, paper: Value[]): string {
  switch (field) {
    case "amount_in_hand": {
      const net = get(paper, "net_disbursed");
      const loan = get(paper, "loan_amount");
      return net ? `आपके हाथ में ${valueHi(net)} आएँगे।` : `लोन ${valueHi(loan!)} का है।`;
    }
    case "installment":
      return `किस्त ${valueHi(get(paper, "installment")!)}।`;
    case "processing_fee":
      return `प्रोसेसिंग फ़ीस ${valueHi(get(paper, "processing_fee")!)} है।`;
    case "missed_payment": {
      const late = get(paper, "late_fee");
      return late
        ? `एक किस्त छूटने पर लेट फ़ीस ${valueHi(late)} लगेगी।`
        : "कागज़ पर लेट फ़ीस नहीं लिखी है। किस्त छूटने पर क्या होगा, यह लेंडर से पूछिए।";
    }
  }
}

/** Gate NextStep -> what to say. `last` = outcome of the previous answer, `first` = very first question. */
export function gatePrompt(next: NextStep, paper: Value[], last?: AnswerOutcome, first = false): { text: string; slow: boolean } {
  switch (next.kind) {
    case "ask":
      return { text: (first ? `${TEACHBACK_INTRO} ` : last === "pass" ? `${MATCHED_HI} ` : "") + GATE_ASK_HI[next.field], slow: false };
    case "follow_up":
      return { text: FOLLOW_UP_HI[next.key], slow: false };
    case "re_explain_and_ask":
      return {
        text: `${last === "uncertain" ? "कोई बात नहीं।" : "यह कागज़ से नहीं मिला।"} ध्यान से सुनिए। ${reExplainHi(next.field, paper)} अब फिर से बताइए: ${GATE_ASK_HI[next.field]}`,
        slow: true,
      };
    case "passed":
      return { text: MATCHED_HI, slow: false };
    case "stop":
      return { text: STOP_HI, slow: true };
  }
}

const IMPORTANT: Field[] = ["loan_amount", "net_disbursed", "installment", "processing_fee", "late_fee"];

/** Questions the borrower should ask the lender, from differences and gaps. Never empty. */
export function lenderQuestions(
  paper: PaperFacts,
  agentChecks: AgentCheck[] = [],
  gateFields?: Record<GateFieldId, { status: GateFieldStatus }>,
): string[] {
  const q: string[] = [];
  const latest = new Map<string, AgentCheck>();
  for (const c of agentChecks) latest.set(c.field, c);
  for (const c of latest.values()) {
    if (c.status !== "conflict" || !c.paper) continue;
    const s = c.spoken[0];
    const said = s.negated ? "कहा यह नहीं लगेगी" : `${valueHi(s)} बताई`;
    q.push(`${FIELD_NAME_HI[c.field]}: एजेंट ने ${said}, पर कागज़ पर ${valueHi(c.paper)} है। कौन-सा सही है? लिखकर दीजिए।`);
  }
  for (const f of paper.missing) if (IMPORTANT.includes(f)) q.push(`${FIELD_NAME_HI[f]} कितनी है? कागज़ पर लिखकर दीजिए।`);
  for (const f of paper.ambiguous) q.push(`${FIELD_NAME_HI[f]} कागज़ पर दो अलग-अलग लिखी है। कौन-सी सही है?`);
  if (gateFields) {
    for (const [id, fs] of Object.entries(gateFields) as [GateFieldId, { status: GateFieldStatus }][]) {
      if (fs.status === "failed") q.push(`${GATE_FIELD_HI[id]}, मुझे फिर से, धीरे-धीरे समझाइए।`);
    }
  }
  if (q.length === 0) q.push("कुल मिलाकर मुझे कितना चुकाना होगा? लिखकर दीजिए।");
  return q;
}

export const GRIEVANCE_ON_PAPER_HI =
  "शिकायत हो, तो पहले लेंडर के शिकायत अधिकारी से बात कीजिए। उनका नाम कागज़ पर लिखा है। फिर भी हल न हो, तो आर बी आई की वेबसाइट, सी एम एस डॉट आर बी आई डॉट ओ आर जी डॉट इन पर शिकायत कीजिए।";
export const GRIEVANCE_NOT_ON_PAPER_HI =
  "शिकायत हो, तो लेंडर से उनके शिकायत अधिकारी का नाम लिखकर माँगिए। फिर भी हल न हो, तो आर बी आई की वेबसाइट, सी एम एस डॉट आर बी आई डॉट ओ आर जी डॉट इन पर शिकायत कीजिए।";

const PASSED_HI =
  "आपने लोन की मुख्य बातें अपने शब्दों में बताईं। यह नंबर और शब्दों की जाँच थी। यह समझ का सबूत है, साइन के साथ। यह साइन नहीं है, और लोन की मंज़ूरी भी नहीं।";

/** Everything the result screen says: outcome, up to three questions for the lender, where to complain. */
export function resultSpeech(kind: "passed" | "stopped", questions: string[], grievanceOnPaper: boolean): string {
  const parts = [kind === "passed" ? PASSED_HI : `${STOP_HI} कुछ बातें कागज़ से नहीं मिलीं।`];
  parts.push(`लेंडर से यह पूछिए: ${questions.slice(0, 3).join(" ")}`);
  parts.push(grievanceOnPaper ? GRIEVANCE_ON_PAPER_HI : GRIEVANCE_NOT_ON_PAPER_HI);
  return parts.join(" ");
}
