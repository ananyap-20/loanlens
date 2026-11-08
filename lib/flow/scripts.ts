// Spoken Hindi for the in-person flow (Timbre input). Pure functions, no AI.
// Every sentence is Devanagari with numbers written as WORDS (Timbre mispronounces digits);
// tests check that no digit ever reaches the speaker. No verdict words ("safe", "approved", ...).
import { decimalToHindiWords, monthsToHindi, numberToHindiWords, percentToHindi, rupeesToHindi, weeksToHindi } from "@/lib/engine";
import type { Field, Frequency, Value } from "@/lib/engine/types";
import type { PaperFailure } from "@/lib/paper/terms";

export const FIELD_NAME_HI: Record<Field, string> = {
  loan_amount: "लोन की रक़म",
  interest_rate: "ब्याज",
  tenure: "लोन का समय",
  installment: "किस्त",
  processing_fee: "प्रोसेसिंग फ़ीस",
  net_disbursed: "हाथ में आने वाली रक़म",
  late_fee: "लेट फ़ीस",
};

const FREQ_HI: Record<Frequency, string> = {
  monthly: "हर महीने",
  weekly: "हर हफ़्ते",
  fortnightly: "हर पंद्रह दिन",
  once: "",
};

/** One value as spoken Hindi: "दो हज़ार छह सौ छियासठ रुपये, हर महीने", "बारह प्रतिशत सालाना", "बारह महीने". */
export function valueHi(v: Value): string {
  if (v.negated && v.amount === 0) return "कुछ नहीं";
  if (v.amount === undefined) return "साफ़ रक़म नहीं";
  const a = v.amount;
  switch (v.unit) {
    case "percent":
      return percentToHindi(a) + (/\b(?:year|annum|p\.?\s?a)\b|saal|साल/i.test(v.evidence) ? " सालाना" : "");
    case "months":
      return Number.isInteger(a) ? monthsToHindi(a) : `${decimalToHindiWords(a)} महीने`;
    case "weeks":
      return Number.isInteger(a) ? weeksToHindi(a) : `${decimalToHindiWords(a)} हफ़्ते`;
    case "INR": {
      const r = Number.isInteger(a) ? rupeesToHindi(a) : `${decimalToHindiWords(a)} रुपये`;
      const f = v.frequency ? FREQ_HI[v.frequency] : "";
      return f ? `${r}, ${f}` : r;
    }
    default:
      return Number.isInteger(a) ? numberToHindiWords(a) : decimalToHindiWords(a);
  }
}

export const SAY = {
  who: "कौन-कौन यहाँ है? सिर्फ़ आप हैं, तो पहला बटन दबाइए। आप और एजेंट दोनों हैं, तो दूसरा बटन दबाइए।",
  paper:
    "अब लोन का कागज़ दीजिए। कागज़ पर क्यू आर कोड है, तो कैमरा वाला बटन दबाइए। पी डी एफ़ फ़ाइल है, तो फ़ाइल वाला बटन। नमूने का कागज़ देखना हो, तो तीसरा बटन।",
  micDenied: "माइक की अनुमति नहीं मिली। क्रोम में इस साइट को माइक की अनुमति दीजिए, फिर माइक वाला बटन दोबारा दबाइए।",
  noMic: "इस फ़ोन में माइक नहीं मिला।",
  micUnsupported: "यहाँ रिकॉर्डिंग नहीं हो सकती। क्रोम में यह लिंक खोलिए।",
  micError: "माइक शुरू नहीं हो पाया। माइक वाला बटन फिर से दबाइए।",
  emptyTranscript: "कुछ सुनाई नहीं दिया। माइक के पास साफ़ बोलिए, फिर से।",
  apiError: "आवाज़ भेजने में दिक्कत आई। इंटरनेट देखिए और फिर से बोलिए।",
  cameraFail: "कैमरा नहीं खुल पाया। फ़ाइल वाला बटन दबाइए।",
  sharedFail: "शेयर की गई फ़ाइल नहीं आई। फ़ाइल वाला बटन दबाइए।",
  noQrInPhoto: "इस तस्वीर में क्यू आर कोड नहीं मिला। फिर से कोशिश कीजिए।",
} as const;

export const PAPER_FAIL_HI: Record<PaperFailure, string> = {
  no_text: "इस पी डी एफ़ में लिखा हुआ टेक्स्ट नहीं मिला। कागज़ का क्यू आर कोड स्कैन कीजिए।",
  unreadable: "यह फ़ाइल खुल नहीं पाई। दूसरी फ़ाइल या क्यू आर कोड आज़माइए।",
  no_terms: "इस कागज़ पर लोन की शर्तें नहीं मिलीं। दूसरी फ़ाइल या क्यू आर कोड आज़माइए।",
  bad_qr: "यह क्यू आर कोड लोनलेंस का नहीं है। पी डी एफ़ फ़ाइल आज़माइए।",
};

const listHi = (names: string[]) => (names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} और ${names.at(-1)}`);

export type PaperFacts = { terms: Value[]; missing: Field[]; ambiguous: Field[] };

const find = (terms: Value[], f: Field) => terms.find((v) => v.field === f && v.amount !== undefined);

/** The whole paper read aloud, in a fixed order, then what is missing or unclear. */
export function explainPaper(p: PaperFacts): string {
  const s: string[] = ["ध्यान से सुनिए। यह आपके लोन के कागज़ की बातें हैं।"];
  const loan = find(p.terms, "loan_amount");
  const net = find(p.terms, "net_disbursed");
  const fee = find(p.terms, "processing_fee");
  const inst = find(p.terms, "installment");
  const tenure = find(p.terms, "tenure");
  const rate = find(p.terms, "interest_rate");
  const late = find(p.terms, "late_fee");

  if (loan) s.push(`लोन ${valueHi(loan)} का है।`);
  if (net) {
    s.push(`आपके हाथ में ${valueHi(net)} आएँगे।`);
    if (loan && net.unit === "INR" && loan.unit === "INR" && (net.amount as number) < (loan.amount as number)) {
      s.push(`यानी पूरे ${valueHi(loan)} हाथ में नहीं आएँगे।`);
    }
  }
  if (fee) s.push(fee.amount === 0 ? "प्रोसेसिंग फ़ीस शून्य लिखी है।" : `प्रोसेसिंग फ़ीस ${valueHi(fee)} है।`);
  if (inst) s.push(`किस्त ${valueHi(inst)}।`);
  if (tenure) s.push(`कुल समय ${valueHi(tenure)}।`);
  if (rate) s.push(`ब्याज ${valueHi(rate)}।`);
  if (late) s.push(`किस्त छूटने पर लेट फ़ीस ${valueHi(late)}।`);

  if (p.missing.length) s.push(`इस कागज़ पर ${listHi(p.missing.map((f) => FIELD_NAME_HI[f]))} नहीं लिखी है। लेंडर से पूछिए।`);
  for (const f of p.ambiguous) s.push(`कागज़ पर ${FIELD_NAME_HI[f]} दो अलग-अलग लिखी है। लेंडर से पूछिए।`);
  s.push("समझ आया हो तो आगे वाला बटन दबाइए। दोबारा सुनना हो तो घूमते तीर वाला बटन।");
  return s.join(" ");
}
