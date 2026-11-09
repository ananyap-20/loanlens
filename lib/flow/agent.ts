// Agent check: the agent answers ONE field per clip; the clip is compared with the paper. Pure, no AI.
import { compareField, extractClaims } from "@/lib/engine";
import type { Field, Status, Value } from "@/lib/engine/types";
import type { VerifyReason } from "@/lib/engine";
import { FIELD_NAME_HI, REASON_HI, valueHi } from "./scripts";

export const AGENT_FIELDS = ["loan_amount", "installment", "processing_fee", "tenure", "late_fee"] as const;
export type AgentField = (typeof AGENT_FIELDS)[number];

export const AGENT_ASK: Record<AgentField, string> = {
  loan_amount: "एजेंट जी, माइक वाला बटन दबाकर बोलिए: लोन कितने रुपये का है? फिर बटन दोबारा दबाइए।",
  installment: "एजेंट जी, बोलिए: किस्त कितने रुपये की है, और कब-कब देनी है?",
  processing_fee: "एजेंट जी, बोलिए: प्रोसेसिंग फ़ीस कितनी है?",
  tenure: "एजेंट जी, बोलिए: लोन कितने महीने का है?",
  late_fee: "एजेंट जी, बोलिए: किस्त छूटने पर कितनी लेट फ़ीस लगेगी?",
};

/** The same questions as a full sentence on screen (with icon), instead of a bare "icon ?". */
export const AGENT_QUESTION_TEXT: Record<AgentField, string> = {
  loan_amount: "💰 लोन कितने रुपये का है?",
  installment: "🗓️ किस्त कितनी है और कितने दिन में?",
  processing_fee: "🧾 प्रोसेसिंग फ़ीस कितनी है?",
  tenure: "⏳ लोन कितने महीने का है?",
  late_fee: "⏰ किस्त छूटने पर कितनी लेट फ़ीस लगेगी?",
};

export const AGENT_CHANGED_HI = "एजेंट ने पहले अलग बताया था";

/** ⚠️ if ANY earlier agent recording for this field differed from the paper, even if the latest matches. */
export function agentChangedEarlier(checks: AgentCheck[], field: string): boolean {
  const all = checks.filter((c) => c.field === field);
  return all.slice(0, -1).some((c) => c.status === "conflict");
}

export const CONSENT_SAY =
  "एजेंट जी, माइक वाला बटन दबाइए। अपना नाम बताइए और बोलिए: मैं इस बातचीत की रिकॉर्डिंग की अनुमति देता हूँ। फिर बटन दोबारा दबाइए।";
/** Shown on screen for the agent to read aloud (the agent can read; the borrower may not). */
export const CONSENT_LINE = "मैं (अपना नाम), इस बातचीत की रिकॉर्डिंग की अनुमति देता / देती हूँ।";
export const CONSENT_DONE = "धन्यवाद। अब आगे वाला बटन दबाइए।";

export type AgentCheck = {
  field: AgentField;
  status: Status;
  spoken: Value[];
  paper?: Value;
  transcript: string;
  reason?: VerifyReason; // why "couldn't check"
  flag: string; // spoken Hindi, numbers in words
};

/** Spoken flag after one agent clip. Never uses verdict words; a difference says what to ask. */
export function agentFlag(field: Field, status: Status, spoken: Value[], paper?: Value, reason?: VerifyReason): string {
  const name = FIELD_NAME_HI[field];
  const paperHi = paper && paper.amount !== undefined ? valueHi(paper) : undefined;
  switch (status) {
    case "match":
      return `${name}: यह कागज़ से मिलता है।`;
    case "conflict": {
      const s = spoken[0];
      const said = s.negated ? `एजेंट ने कहा ${name} नहीं लगेगी` : `एजेंट ने ${name} ${valueHi(s)} बताई`;
      return `ध्यान दीजिए! ${said}, पर कागज़ पर ${paperHi} लिखा है। लेंडर से पूछिए।`;
    }
    case "not_mentioned":
      return `एजेंट ने ${name} के बारे में कुछ नहीं बोला। फिर से पूछ सकते हैं।`;
    case "unable_to_verify":
      if (reason && reason !== "not_on_paper" && reason !== "rate_basis" && reason !== "unit_or_frequency") {
        return `${name}: ${REASON_HI[reason].replace(" — ", "। ")}।`;
      }
      return paperHi
        ? `${name} जाँच नहीं पाए। कागज़ पर ${paperHi} लिखा है। साफ़-साफ़ पूछिए।`
        : `${name} कागज़ पर नहीं लिखी है, इसलिए जाँच नहीं पाए। लेंडर से पूछिए।`;
  }
}

/** One agent clip about `field` -> status vs the paper (engine extractClaims + compareField). */
export function checkAgentClip(field: AgentField, transcript: string, paper: Value[]): AgentCheck {
  const spoken = extractClaims(transcript, field, "agent").filter((v) => v.field === field);
  const side = compareField(field, paper, spoken);
  const p = paper.find((v) => v.field === field && v.source === "paper");
  return {
    field,
    status: side.status,
    spoken: side.spoken,
    paper: p,
    transcript,
    reason: side.reason,
    flag: agentFlag(field, side.status, side.spoken, p, side.reason),
  };
}
