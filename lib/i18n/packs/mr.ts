// Marathi (mr-IN). Prisma language_code mr-IN; Timbre v2.5 voices Zahira (female) / Ishaan (male), per docs.gnani.ai.
// The number words are the standard Marathi 0–99 forms; hundreds are built by rule (X + "शे"), never guessed.
// NOTE: wording and number spellings should still be reviewed by a native Marathi speaker before real use.
import type { Value } from "@/lib/engine/types";
import type { ReceiptStrings } from "@/lib/receipt/strings";
import { buildSay, type Phrases } from "../build";
import { applyLexicon, numberTable, wordsToDigits } from "../lexicon";
import type { LangPack } from "../types";

export const MR_0_99 = [
  "शून्य", "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ",
  "दहा", "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस",
  "वीस", "एकवीस", "बावीस", "तेवीस", "चोवीस", "पंचवीस", "सव्वीस", "सत्तावीस", "अठ्ठावीस", "एकोणतीस",
  "तीस", "एकतीस", "बत्तीस", "तेहेतीस", "चौतीस", "पस्तीस", "छत्तीस", "सदतीस", "अडतीस", "एकोणचाळीस",
  "चाळीस", "एक्केचाळीस", "बेचाळीस", "त्रेचाळीस", "चव्वेचाळीस", "पंचेचाळीस", "सेहेचाळीस", "सत्तेचाळीस", "अठ्ठेचाळीस", "एकोणपन्नास",
  "पन्नास", "एक्कावन्न", "बावन्न", "त्रेपन्न", "चोपन्न", "पंचावन्न", "छप्पन्न", "सत्तावन्न", "अठ्ठावन्न", "एकोणसाठ",
  "साठ", "एकसष्ट", "बासष्ट", "त्रेसष्ट", "चौसष्ट", "पासष्ट", "सहासष्ट", "सदुसष्ट", "अडुसष्ट", "एकोणसत्तर",
  "सत्तर", "एक्काहत्तर", "बाहत्तर", "त्र्याहत्तर", "चौऱ्याहत्तर", "पंच्याहत्तर", "शहात्तर", "सत्याहत्तर", "अठ्ठ्याहत्तर", "एकोणऐंशी",
  "ऐंशी", "एक्क्याऐंशी", "ब्याऐंशी", "त्र्याऐंशी", "चौऱ्याऐंशी", "पंच्याऐंशी", "शहाऐंशी", "सत्त्याऐंशी", "अठ्ठ्याऐंशी", "एकोणनव्वद",
  "नव्वद", "एक्क्याण्णव", "ब्याण्णव", "त्र्याण्णव", "चौऱ्याण्णव", "पंच्याण्णव", "शहाण्णव", "सत्त्याण्णव", "अठ्ठ्याण्णव", "नव्व्याण्णव",
] as const;

function under1000(n: number): string {
  if (n < 100) return MR_0_99[n];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const head = h === 1 && rest === 0 ? "शंभर" : `${MR_0_99[h]}शे`;
  return rest ? `${head} ${MR_0_99[rest]}` : head;
}

/** Non-negative integer -> Marathi words: 2666 -> "दोन हजार सहाशे सहासष्ट", 30000 -> "तीस हजार". */
export function marathiWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`marathiWords needs a non-negative integer, got ${n}`);
  if (n < 1000) return under1000(n);
  const parts: string[] = [];
  let rest = n;
  for (const [size, word] of [
    [10000000, "कोटी"],
    [100000, "लाख"],
    [1000, "हजार"],
  ] as const) {
    if (rest >= size) {
      parts.push(`${marathiWords(Math.floor(rest / size))} ${word}`);
      rest %= size;
    }
  }
  if (rest) parts.push(under1000(rest));
  return parts.join(" ");
}

function decimalWords(n: number): string {
  if (Number.isInteger(n)) return marathiWords(n);
  const [i, f] = String(n).split(".");
  return `${marathiWords(Number(i))} पूर्णांक ${[...f].map((d) => MR_0_99[Number(d)]).join(" ")}`;
}

const NUMBER_WORDS: [string, number][] = [...MR_0_99.map((w, i) => [w, i] as [string, number]), ["शंभर", 100]];
const TABLE = numberTable({
  units: NUMBER_WORDS,
  multipliers: [
    ["हजार", 1000],
    ["लाख", 100000],
    ["कोटी", 10000000],
  ],
  hundredSuffix: "शे",
  fractions: [
    ["दीड", 1.5, "absolute"],
    ["अडीच", 2.5, "absolute"],
    ["साडे", 0.5, "plus"],
    ["सव्वा", 0.25, "plus"],
    ["पावणे", 0.25, "minus"],
  ],
});

// Marathi word or phrase -> the engine's existing keyword (lib/engine/extractClaims.ts).
const NEGATION: [string, string][] = [
  ["नाही", "नहीं"],
  ["नाहीत", "नहीं"],
  ["नको", "नहीं"],
];
const CONSEQUENCE: [string, string][] = [
  ["विलंब शुल्क", "late fee"],
  ["दंड", "penalty"],
  ["जास्त", "extra"],
  ["उशीर", "late"],
  ["विलंब", "late"],
];
const NAVIGATION: [string, string][] = [
  ["पुढे", "next"],
  ["पुढचा", "next"],
  ["पुढील", "next"],
  ["वगळा", "skip"],
  ["कृपया", "please"],
];
const KEYWORDS: [string, string][] = [
  ["माहीत नाही", "पता नहीं"],
  ["माहित नाही", "पता नहीं"],
  ["कदाचित", "शायद"],
  ["मासिक हप्ता", "EMI"],
  ["हप्ता", "किस्त"],
  ["हप्ते", "किस्त"],
  ["हप्त्याला", "किस्त"],
  ["हप्त्याची", "किस्त"],
  ["कर्जाची रक्कम", "loan amount"],
  ["प्रक्रिया शुल्क", "processing fee"],
  ["प्रोसेसिंग फी", "processing fee"],
  ["शुल्क", "fee"],
  ["हातात", "हाथ में"],
  ["व्याज दर", "ब्याज दर"],
  ["व्याज", "ब्याज"],
  ["टक्के", "प्रतिशत"],
  ["महिना", "महीने"],
  ["महिने", "महीने"],
  ["महिन्यांचे", "महीने"],
  ["महिन्याला", "महीने"],
  ["महिन्यांनी", "महीने"],
  ["दरमहा", "monthly"],
  ["आठवडा", "हफ़्ते"],
  ["आठवडे", "हफ़्ते"],
  ["आठवड्याला", "हफ़्ते"],
  ["दर", "हर"],
  ["प्रत्येक", "हर"],
  ...NEGATION,
  ...CONSEQUENCE,
  ...NAVIGATION,
];

export function normalizeMarathi(t: string): string {
  return applyLexicon(wordsToDigits(t, TABLE), KEYWORDS);
}

const FREQ = { monthly: ", दर महिन्याला", weekly: ", दर आठवड्याला", fortnightly: ", दर पंधरा दिवसांनी", once: "" } as const;

function value(v: Value): string {
  if (v.negated && v.amount === 0) return "काहीच नाही";
  if (v.amount === undefined) return "स्पष्ट रक्कम नाही";
  const a = v.amount;
  switch (v.unit) {
    case "percent":
      return `${decimalWords(a)} टक्के` + (/\b(?:year|annum|p\.?\s?a)\b|वार्षिक|साल/i.test(v.evidence) ? " वार्षिक" : "");
    case "months":
      return a === 1 ? "एक महिना" : `${decimalWords(a)} महिने`;
    case "weeks":
      return a === 1 ? "एक आठवडा" : `${decimalWords(a)} आठवडे`;
    case "INR":
      return `${decimalWords(a)} रुपये${v.frequency ? FREQ[v.frequency] : ""}`;
    default:
      return decimalWords(a);
  }
}

const NAME = {
  loan_amount: "कर्जाची रक्कम",
  interest_rate: "व्याज",
  tenure: "कर्जाचा कालावधी",
  installment: "हप्ता",
  processing_fee: "प्रक्रिया शुल्क",
  net_disbursed: "हातात येणारी रक्कम",
  late_fee: "विलंब शुल्क",
} as const;

const REASON = {
  no_number: "उत्तरात आकडा सापडला नाही — पुन्हा बोला",
  implausible: "हा आकडा या प्रश्नाचा वाटत नाही — पुन्हा बोला",
  uncertain: "खात्रीने सांगितले नाही — पुन्हा बोला",
  several_numbers: "वेगवेगळे आकडे सांगितले — एकच आकडा पुन्हा बोला",
  unit_or_frequency: "महिना की आठवडा स्पष्ट नाही, किंवा कागदापेक्षा वेगळे — पुन्हा बोला",
  not_on_paper: "हे कागदावर लिहिलेले नाही — कर्ज देणाऱ्यांना विचारा",
  rate_basis: "व्याजाचा हिशोब वेगळ्या पद्धतीने असू शकतो — कर्ज देणाऱ्यांना विचारा",
} as const;

const GATE_ASK = {
  amount_in_hand: "तुमच्या हातात किती रुपये येतील?",
  installment: "हप्ता किती रुपयांचा आहे, आणि किती दिवसांनी भरायचा?",
  processing_fee: "प्रक्रिया शुल्क किती आहे?",
  missed_payment: "एक हप्ता भरता आला नाही, तर काय होईल?",
} as const;

const FOLLOW_UP = {
  amount_in_hand: "तुमच्या हातात किती रुपये येतील? रक्कम सांगा.",
  installment_amount: "हप्ता किती रुपयांचा आहे? रक्कम सांगा.",
  installment_frequency: "हप्ता दर महिन्याला भरायचा की दर आठवड्याला?",
  processing_fee: "प्रक्रिया शुल्क किती आहे? रक्कम सांगा.",
  missed_payment: "एक हप्ता भरता आला नाही, तर काय होईल? काय लागेल?",
} as const;

const GATE_NAME = {
  amount_in_hand: "हातात येणारी रक्कम",
  installment: "हप्ता",
  processing_fee: "प्रक्रिया शुल्क",
  missed_payment: "हप्ता चुकला तर काय होईल",
} as const;

const LENDER = "कर्ज देणाऱ्यांना";
const RBI = "सी एम एस डॉट आर बी आय डॉट ओ आर जी डॉट इन";

const phrases: Phrases = {
  value,
  fieldName: NAME,
  fixed: {
    who: "इथे कोण कोण आहे? फक्त तुम्ही असाल, तर पहिले बटण दाबा. तुम्ही आणि एजंट दोघे असाल, तर दुसरे बटण दाबा.",
    paper: "आता कर्जाचा कागद द्या. कागदावर क्यू आर कोड असेल, तर कॅमेरा बटण दाबा. पी डी एफ फाइल असेल, तर फाइल बटण दाबा. नमुना कागद पाहायचा असेल, तर तिसरे बटण दाबा.",
    micDenied: "मायक्रोफोनची परवानगी मिळाली नाही. क्रोममध्ये या साइटला मायक्रोफोनची परवानगी द्या, आणि मायक्रोफोन बटण पुन्हा दाबा.",
    noMic: "या फोनमध्ये मायक्रोफोन सापडला नाही.",
    micUnsupported: "इथे रेकॉर्डिंग होऊ शकत नाही. ही लिंक क्रोममध्ये उघडा.",
    micError: "मायक्रोफोन सुरू झाला नाही. मायक्रोफोन बटण पुन्हा दाबा.",
    emptyTranscript: "काहीच ऐकू आले नाही. मायक्रोफोनजवळ स्पष्ट बोला, पुन्हा.",
    apiError: "आवाज पाठवताना अडचण आली. इंटरनेट तपासा आणि पुन्हा बोला.",
    cameraFail: "कॅमेरा उघडला नाही. फाइल बटण दाबा.",
    sharedFail: "शेअर केलेली फाइल आली नाही. फाइल बटण दाबा.",
    receipt: `ही तुमची पावती आहे. यात कागदातील अटी, सर्व रेकॉर्डिंग आणि त्यांचे फिंगरप्रिंट आहेत. शेअर बटणाने ती एजंटला आणि तुमच्या विश्वासातील व्यक्तीला पाठवा. ही सही नाही, आणि कर्जाची मंजुरीही नाही. काम झाल्यावर सगळे पुसा हे बटण दाबा.`,
    receiptShared: "पावती पाठवली.",
    receiptDownloaded: "पावती फोनमध्ये सेव्ह झाली.",
    receiptFail: "पावती तयार झाली नाही. पुन्हा दाबा.",
    clearConfirm: "सगळे पुसायचे आहे का? खात्रीसाठी हेच बटण पुन्हा दाबा.",
    cleared: "सगळे पुसले.",
    navOnly: "आधी उत्तर द्या, मग पुढे जाऊ.",
    consentSay: "एजंट, मायक्रोफोन बटण दाबा. तुमचे नाव सांगा आणि म्हणा: मी या संभाषणाच्या रेकॉर्डिंगला परवानगी देतो. मग बटण पुन्हा दाबा.",
    consentDone: "धन्यवाद. आता पुढे बटण दाबा.",
    teachbackIntro: "आता तुमच्या शब्दांत सांगा. प्रत्येक प्रश्नानंतर मायक्रोफोन बटण दाबून बोला, आणि पुन्हा दाबा.",
  },
  paperFail: {
    no_text: "या पी डी एफ मध्ये लिहिलेला मजकूर सापडला नाही. कागदावरचा क्यू आर कोड स्कॅन करा.",
    unreadable: "ही फाइल उघडली नाही. दुसरी फाइल किंवा क्यू आर कोड वापरून पहा.",
    no_terms: "या कागदावर कर्जाच्या अटी सापडल्या नाहीत. दुसरी फाइल किंवा क्यू आर कोड वापरून पहा.",
    bad_qr: "हा क्यू आर कोड लोनलेन्सचा नाही. पी डी एफ फाइल वापरून पहा.",
  },
  handover: {
    agent: "आता एजंट बोलतील. फोन एजंटला द्या. एजंट, तयार असाल तर मोठे बटण दाबा.",
    borrower: "आता फोन कर्ज घेणाऱ्या व्यक्तीला द्या. तयार असाल तर मोठे बटण दाबा.",
  },
  agentAsk: {
    loan_amount: "एजंट, मायक्रोफोन बटण दाबून सांगा: कर्ज किती रुपयांचे आहे? मग बटण पुन्हा दाबा.",
    installment: "एजंट, सांगा: हप्ता किती रुपयांचा आहे, आणि किती दिवसांनी भरायचा?",
    processing_fee: "एजंट, सांगा: प्रक्रिया शुल्क किती आहे?",
    tenure: "एजंट, सांगा: कर्ज किती महिन्यांचे आहे?",
    late_fee: "एजंट, सांगा: हप्ता चुकला तर किती विलंब शुल्क लागेल?",
  },
  explain: {
    intro: "नीट ऐका. या तुमच्या कर्जाच्या कागदातील गोष्टी आहेत.",
    loan: (v) => `कर्जाची रक्कम ${v} आहे.`,
    net: (v) => `तुमच्या हातात ${v} येतील.`,
    notFullLoan: (loan) => `म्हणजे पूर्ण ${loan} हातात येणार नाहीत.`,
    fee: (v) => `प्रक्रिया शुल्क ${v} आहे.`,
    feeZero: "प्रक्रिया शुल्क शून्य लिहिले आहे.",
    installment: (v) => `हप्ता ${v}.`,
    tenure: (v) => `एकूण कालावधी ${v}.`,
    rate: (v) => `व्याज ${v}.`,
    late: (v) => `हप्ता चुकला तर विलंब शुल्क ${v}.`,
    missing: (l) => `या कागदावर ${l} लिहिलेले नाही. ${LENDER} विचारा.`,
    ambiguous: (n) => `कागदावर ${n} दोन वेगवेगळ्या प्रकारे लिहिले आहे. ${LENDER} विचारा.`,
    outro: "समजले असेल तर पुढे बटण दाबा. पुन्हा ऐकायचे असेल तर फिरणाऱ्या बाणाचे बटण दाबा.",
    and: "आणि",
  },
  flag: {
    match: (n) => `${n}: हे कागदाशी जुळते.`,
    conflictNegated: (n, paper) => `लक्ष द्या! एजंट म्हणाले ${n} लागणार नाही, पण कागदावर ${paper} लिहिले आहे. ${LENDER} विचारा.`,
    conflict: (n, said, paper) => `लक्ष द्या! एजंटने ${n} ${said} सांगितले, पण कागदावर ${paper} लिहिले आहे. ${LENDER} विचारा.`,
    notMentioned: (n) => `एजंट ${n} बद्दल काहीच बोलले नाहीत. पुन्हा विचारू शकता.`,
    reason: (n, r) => `${n}: ${r}.`,
    unableWithPaper: (n, paper) => `${n} तपासता आले नाही. कागदावर ${paper} लिहिले आहे. स्पष्ट विचारा.`,
    notOnPaper: (n) => `${n} कागदावर लिहिलेले नाही, म्हणून तपासता आले नाही. ${LENDER} विचारा.`,
  },
  reason: REASON,
  gate: {
    ask: GATE_ASK,
    followUp: FOLLOW_UP,
    matched: "ठीक आहे, हे कागदाशी जुळते.",
    stop: "आत्ता सही करू नका. विश्वासातील कोणाला तरी सोबत आणा.",
    notMatched: "हे कागदाशी जुळत नाही.",
    noProblem: "काही हरकत नाही.",
    listen: "नीट ऐका.",
    tellAgain: "आता पुन्हा सांगा:",
    implausible: "हा आकडा या प्रश्नाचा वाटत नाही. पुन्हा बोला.",
    reExplain: {
      net: (v) => `तुमच्या हातात ${v} येतील.`,
      loan: (v) => `कर्जाची रक्कम ${v} आहे.`,
      installment: (v) => `हप्ता ${v}.`,
      fee: (v) => `प्रक्रिया शुल्क ${v} आहे.`,
      late: (v) => `एक हप्ता चुकला तर विलंब शुल्क ${v} लागेल.`,
      noLate: `कागदावर विलंब शुल्क लिहिलेले नाही. हप्ता चुकला तर काय होईल, हे ${LENDER} विचारा.`,
    },
  },
  gateFieldName: GATE_NAME,
  lender: {
    conflict: (n, neg, said, paper) =>
      `${n}: एजंटने ${neg ? "हे लागणार नाही असे सांगितले" : `${said} सांगितले`}, पण कागदावर ${paper} आहे. कोणते बरोबर? लेखी द्या.`,
    missing: (n) => `${n} किती आहे? कागदावर लेखी द्या.`,
    ambiguous: (n) => `${n} कागदावर दोन वेगवेगळ्या प्रकारे लिहिले आहे. कोणते बरोबर?`,
    gateFailed: (n) => `${n}, मला पुन्हा, हळू समजावून सांगा.`,
    none: "एकूण मला किती भरावे लागेल? लेखी द्या.",
  },
  result: {
    passed:
      "तुम्ही कर्जाच्या मुख्य गोष्टी तुमच्या शब्दांत सांगितल्या. ही आकडे आणि शब्दांची तपासणी होती. हा समजल्याचा पुरावा आहे, सहीसोबत. ही सही नाही, आणि कर्जाची मंजुरीही नाही.",
    stoppedExtra: "काही गोष्टी कागदाशी जुळल्या नाहीत.",
    ask: (q) => `${LENDER} हे विचारा: ${q}`,
    grievanceOnPaper: `तक्रार असेल, तर आधी कर्ज देणाऱ्या संस्थेच्या तक्रार अधिकाऱ्याशी बोला. त्यांचे नाव कागदावर लिहिलेले आहे. तरीही प्रश्न सुटला नाही, तर आर बी आय च्या वेबसाइटवर, ${RBI} वर तक्रार करा.`,
    grievanceNotOnPaper: `तक्रार असेल, तर कर्ज देणाऱ्यांकडून त्यांच्या तक्रार अधिकाऱ्याचे नाव लेखी मागा. तरीही प्रश्न सुटला नाही, तर आर बी आय च्या वेबसाइटवर, ${RBI} वर तक्रार करा.`,
  },
};

const receipt: ReceiptStrings = {
  title: "LoanLens पावती",
  present: "उपस्थित",
  presence: { with_agent: "कर्ज घेणारी व्यक्ती आणि एजंट", alone: "कर्ज घेणारी व्यक्ती" },
  docFingerprint: "दस्तऐवज फिंगरप्रिंट",
  outcomePassed: "✅ समजल्याचा पुरावा, सहीसोबत",
  outcomeStopped: "✋ आत्ता सही करू नका — विश्वासातील कोणाला तरी सोबत आणा",
  cols: { item: "गोष्ट", paper: "📄 कागद", agent: "🧑‍💼 एजंट", borrower: "👩 कर्ज घेणारी" },
  cell: {
    match: "जुळते",
    conflict: "वेगळे आहे",
    notMentioned: "बोलले नाही",
    unable: "तपासता आले नाही",
    notOnPaper: "कागदावर लिहिलेले नाही",
    writtenTwice: "कागदावर दोन वेगळ्या गोष्टी",
    notAsked: "विचारले नाही",
    saidNotCharged: "₹0 (म्हणाले: लागणार नाही)",
    noClearAmount: "स्पष्ट रक्कम नाही",
    gatePassed: "स्वतःच्या शब्दांत बरोबर सांगितले",
    gateFailed: "3 वेळा वेगळे सांगितले",
    gatePending: "तपासणी झाली नाही",
    gateNotOnPaper: "कागदावर नाही",
  },
  freq: { monthly: " दर महिन्याला", weekly: " दर आठवड्याला", fortnightly: " दर 15 दिवसांनी", once: "" },
  months: "महिने",
  weeks: "आठवडे",
  questionsTitle: "❓ सही करण्यापूर्वी कर्ज देणाऱ्यांना विचारा",
  complaintTitle: "📢 तक्रार कुठे करायची",
  grievanceOfficer: "1. कर्ज देणाऱ्यांचे तक्रार अधिकारी: ",
  grievanceAsk: "1. कर्ज देणाऱ्यांकडून तक्रार अधिकाऱ्याचे नाव लेखी मागा",
  rbi: "2. RBI तक्रार पोर्टल: cms.rbi.org.in",
  label: "समजल्याचा पुरावा — ही सही नाही, आणि कर्जाची मंजुरीही नाही",
  evidenceTitle: "पुरावा",
  termsTitle: "कागदातील अटी",
  agentVsPaperTitle: "एजंट विरुद्ध कागद",
  ownWordsTitle: "कर्ज घेणाऱ्या व्यक्तीचे स्वतःचे शब्द",
  recordingsTitle: "सर्व रेकॉर्डिंग (पहिल्या आणि पुन्हा केलेल्या)",
  fullFingerprintsTitle: "पूर्ण फिंगरप्रिंट",
  recCols: { who: "कोण", what: "काय", time: "वेळ", transcript: "काय बोलले" },
  speaker: { agent: "एजंट", borrower: "कर्ज घेणारी", helper: "मदतनीस" },
  agentChanged: "एजंटने आधी वेगळे सांगितले होते",
};

export const mr: LangPack = {
  code: "mr",
  name: "मराठी",
  verified: true,
  prisma: { language_code: "mr-IN" },
  timbre: { language: "mr-IN", voices: { female: "Zahira", male: "Ishaan" } },
  greeting: "नमस्कार. मी मराठीत बोलेन.",
  normalize: normalizeMarathi,
  numberToWords: marathiWords,
  lexicon: {
    numberWords: NUMBER_WORDS,
    negation: NEGATION.map(([w]) => w),
    consequence: CONSEQUENCE.map(([w]) => w),
    navigation: NAVIGATION.map(([w]) => w),
  },
  say: buildSay(phrases),
  ui: {
    start: "▶️ सुरू करा",
    chooseLanguage: "भाषा",
    female: "👩 स्त्री आवाज",
    male: "👨 पुरुष आवाज",
    alone: "1 · फक्त मी",
    withAgent: "2 · मी + एजंट",
    aloneAria: "फक्त मी — just me",
    withAgentAria: "मी आणि एजंट — me and the agent",
    sample: "3 · नमुना",
    cameraOn: "📷 कॅमेरा सुरू (रेकॉर्डिंग होत नाही)",
    cameraOff: "⏹️ कॅमेरा बंद",
    readingPaper: "⏳ कागद वाचत आहे…",
    next: "पुढे",
    ready: "मी तयार आहे ▶️",
    handoverTitle: { agent: "आता एजंट बोलतील", borrower: "आता फोन कर्ज घेणाऱ्या व्यक्तीला द्या" },
    role: { agent: "एजंट", borrower: "कर्ज घेणारी", helper: "मदतनीस" },
    speakingNow: "🎤 आत्ता बोलत आहेत:",
    appSpeaking: "ॲप बोलत आहे… ऐका",
    audioFailed: "🔇 आवाज वाजला नाही ({error}). 🔁 दाबा.",
    status: { match: "जुळते", conflict: "वेगळे आहे", not_mentioned: "बोलले नाही", unable_to_verify: "तपासता आले नाही" },
    legend: "✅ जुळते · ❌ वेगळे आहे · ❔ तपासता आले नाही",
    recording: "रेकॉर्डिंग",
    micPermission: "🎤❔ मायक्रोफोनची परवानगी…",
    appUnderstanding: "📱 ॲप तुमचे बोलणे समजून घेत आहे…",
    appSpeakingListen: "📱 ॲप बोलत आहे — ऐका, मग बोला",
    yourTurn: "🎤 तुमची पाळी — मायक्रोफोन दाबा",
    agentCol: "🧑‍💼 एजंट",
    paperCol: "📄 कागद",
    numberKeywordCheck: "🔢 आकडे आणि शब्दांची तपासणी",
    tries: "प्रयत्न",
    proofTitle: "समजल्याचा पुरावा, सहीसोबत",
    dontSign: "आत्ता सही करू नका",
    bringTrusted: "विश्वासातील कोणाला तरी सोबत आणा 🤝",
    ownWords: "👩 तुमच्या शब्दांत",
    agentVsPaper: "🧑‍💼 एजंट विरुद्ध 📄 कागद",
    askLender: "❓ कर्ज देणाऱ्यांना विचारा",
    complaint: "📢 तक्रार",
    grievanceMissing: "तक्रार अधिकाऱ्याचे नाव कागदावर सापडले नाही — कर्ज देणाऱ्यांकडून लेखी मागा.",
    receiptBtn: "पावती",
    clear: "सगळे पुसा",
    clearSure: "नक्की? ✔️",
    pages: "पाने",
    receiptFingerprint: "🔏 पावती फिंगरप्रिंट · Receipt fingerprint",
    fingerprintHelp: "दोन्ही फोनवर हा आकडा सारखा असेल, तर पावती एकच आहे. · Same number on both phones = identical copies.",
    share: "शेअर",
    consentLine: "मी (तुमचे नाव), या संभाषणाच्या रेकॉर्डिंगला परवानगी देतो / देते.",
    agentChanged: "एजंटने आधी वेगळे सांगितले होते",
    freq: { monthly: "दर महिन्याला", weekly: "दर आठवड्याला", fortnightly: "दर 15 दिवसांनी", once: "" },
    months: "महिने",
    weeks: "आठवडे",
    fieldName: NAME,
    fieldShort: {
      loan_amount: "रक्कम",
      net_disbursed: "हातात",
      installment: "हप्ता",
      processing_fee: "शुल्क",
      tenure: "कालावधी",
      late_fee: "विलंब शुल्क",
      interest_rate: "व्याज",
    },
    agentQuestion: {
      loan_amount: "💰 कर्ज किती रुपयांचे आहे?",
      installment: "🗓️ हप्ता किती आहे आणि किती दिवसांनी?",
      processing_fee: "🧾 प्रक्रिया शुल्क किती आहे?",
      tenure: "⏳ कर्ज किती महिन्यांचे आहे?",
      late_fee: "⏰ हप्ता चुकला तर किती विलंब शुल्क लागेल?",
    },
    gateAsk: GATE_ASK,
    followUp: FOLLOW_UP,
    gateFieldName: GATE_NAME,
    reason: REASON,
  },
  receipt,
};
