// English (en-IN). Prisma language_code en-IN; Timbre v2.5 voices Kaveri (female) / Pranav (male), per docs.gnani.ai.
// Numbers are spoken in the Indian system (lakh, crore). Spoken text never contains digits.
import type { Value } from "@/lib/engine/types";
import { buildSay, type Phrases } from "../build";
import { numberTable, wordsToDigits } from "../lexicon";
import type { LangPack } from "../types";
import type { ReceiptStrings } from "@/lib/receipt/strings";

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : "");
}

/** Non-negative integer -> English words, Indian system: 2666 -> "two thousand six hundred sixty-six". */
export function englishWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`englishWords needs a non-negative integer, got ${n}`);
  if (n < 100) return under100(n);
  const parts: string[] = [];
  let rest = n;
  for (const [size, word] of [
    [10000000, "crore"],
    [100000, "lakh"],
    [1000, "thousand"],
    [100, "hundred"],
  ] as const) {
    if (rest >= size) {
      parts.push(`${englishWords(Math.floor(rest / size))} ${word}`);
      rest %= size;
    }
  }
  if (rest) parts.push(under100(rest));
  return parts.join(" ");
}

function decimalWords(n: number): string {
  if (Number.isInteger(n)) return englishWords(n);
  const [i, f] = String(n).split(".");
  return `${englishWords(Number(i))} point ${[...f].map((d) => ONES[Number(d)]).join(" ")}`;
}

const NUMBER_WORDS: [string, number][] = [
  ...ONES.map((w, i) => [w, i] as [string, number]),
  ...TENS.slice(2).map((w, i) => [w, (i + 2) * 10] as [string, number]),
];
const TABLE = numberTable({
  units: NUMBER_WORDS,
  multipliers: [
    ["hundred", 100],
    ["thousand", 1000],
    ["lakh", 100000],
    ["lakhs", 100000],
    ["lac", 100000],
    ["crore", 10000000],
    ["crores", 10000000],
  ],
  joiners: ["and"],
});

const FREQ = { monthly: ", every month", weekly: ", every week", fortnightly: ", every fifteen days", once: "" } as const;

function value(v: Value): string {
  if (v.negated && v.amount === 0) return "nothing";
  if (v.amount === undefined) return "no clear amount";
  const a = v.amount;
  switch (v.unit) {
    case "percent":
      return `${decimalWords(a)} percent` + (/\b(?:year|annum|p\.?\s?a)\b/i.test(v.evidence) ? " a year" : "");
    case "months":
      return a === 1 ? "one month" : `${decimalWords(a)} months`;
    case "weeks":
      return a === 1 ? "one week" : `${decimalWords(a)} weeks`;
    case "INR":
      return `${decimalWords(a)} ${a === 1 ? "rupee" : "rupees"}${v.frequency ? FREQ[v.frequency] : ""}`;
    default:
      return decimalWords(a);
  }
}

const NAME = {
  loan_amount: "loan amount",
  interest_rate: "interest",
  tenure: "loan tenure",
  installment: "instalment",
  processing_fee: "processing fee",
  net_disbursed: "amount in hand",
  late_fee: "late fee",
} as const;

const REASON = {
  no_number: "No number was heard in the answer — please say it again",
  implausible: "This number does not fit this question — please say it again",
  uncertain: "The answer was not certain — please say it again",
  several_numbers: "Different numbers were said — say one number again",
  unit_or_frequency: "Month or week is unclear, or differs from the paper — please say it again",
  not_on_paper: "This is not written on the paper — ask the lender",
  rate_basis: "The interest may be calculated differently — ask the lender",
} as const;

const GATE_ASK = {
  amount_in_hand: "How many rupees will you get in hand?",
  installment: "How many rupees is the instalment, and how often do you pay it?",
  processing_fee: "How much is the processing fee?",
  missed_payment: "If you cannot pay one instalment, what will happen?",
} as const;

const FOLLOW_UP = {
  amount_in_hand: "How many rupees will you get in hand? Say the amount.",
  installment_amount: "How many rupees is the instalment? Say the amount.",
  installment_frequency: "Is the instalment paid every month or every week?",
  processing_fee: "How much is the processing fee? Say the amount.",
  missed_payment: "If you cannot pay one instalment, what will happen? What will be charged?",
} as const;

const GATE_NAME = {
  amount_in_hand: "amount in hand",
  installment: "instalment",
  processing_fee: "processing fee",
  missed_payment: "what happens if an instalment is missed",
} as const;

const RBI = "c m s dot r b i dot o r g dot i n";
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

const phrases: Phrases = {
  value,
  fieldName: NAME,
  fixed: {
    splash: "Welcome to Arth.",
    chooseLang: "Choose your language. Press the button for your language.",
    who: "Who is here? If it is only you, press the first button. If you and the agent are both here, press the second button.",
    paper: "Now give the loan paper. If the paper has a QR code, press the camera button. If it is a PDF file, press the file button. To see a sample paper, press the third button.",
    micDenied: "Microphone permission was not given. Allow the microphone for this site in Chrome, then press the microphone button again.",
    noMic: "No microphone was found on this phone.",
    micUnsupported: "Recording is not possible here. Open this link in Chrome.",
    micError: "The microphone could not start. Press the microphone button again.",
    emptyTranscript: "I could not hear anything. Speak clearly near the microphone, and try again.",
    apiError: "There was a problem sending your voice. Check the internet and speak again.",
    cameraFail: "The camera did not open. Press the file button.",
    sharedFail: "The shared file did not arrive. Press the file button.",
    receipt:
      "This is your receipt. It has the terms of the paper, all the recordings and their fingerprints. Use the share button to send it to the agent and to someone you trust. This is not a signature, and not a loan approval. When you are done, press the clear everything button.",
    receiptShared: "Receipt sent.",
    receiptDownloaded: "Receipt saved on the phone.",
    receiptFail: "The receipt could not be made. Press again.",
    clearConfirm: "Clear everything? Press the same button again to confirm.",
    cleared: "Everything is cleared.",
    navOnly: "Please answer first, then we will move on.",
    consentSay: "Agent, press the microphone button. Say your name, and say: I agree to the recording of this conversation. Then press the button again.",
    consentDone: "Thank you. Now press the next button.",
    teachbackIntro: "Now explain in your own words. After each question, press the microphone button, speak, and press it again.",
  },
  paperFail: {
    no_text: "There is no written text in this PDF. Scan the QR code on the paper.",
    unreadable: "This file could not be opened. Try another file or the QR code.",
    no_terms: "The loan terms were not found on this paper. Try another file or the QR code.",
    bad_qr: "This QR code is not an Arth code. Try the PDF file.",
  },
  handover: {
    agent: "Now the agent will speak. Give the phone to the agent. Agent, when you are ready, press the big button.",
    borrower: "Now give the phone to the borrower. When you are ready, press the big button.",
  },
  agentAsk: {
    loan_amount: "Agent, press the microphone button and say: how many rupees is the loan? Then press the button again.",
    installment: "Agent, say: how many rupees is the instalment, and how often is it paid?",
    processing_fee: "Agent, say: how much is the processing fee?",
    tenure: "Agent, say: for how many months is the loan?",
    late_fee: "Agent, say: how much late fee is charged if an instalment is missed?",
  },
  explain: {
    intro: "Listen carefully. These are the points on your loan paper.",
    loan: (v) => `The loan is ${v}.`,
    net: (v) => `You will get ${v} in hand.`,
    notFullLoan: (loan) => `So you will not get the full ${loan} in hand.`,
    fee: (v) => `The processing fee is ${v}.`,
    feeZero: "The processing fee is written as zero.",
    installment: (v) => `The instalment is ${v}.`,
    tenure: (v) => `The total time is ${v}.`,
    rate: (v) => `The interest is ${v}.`,
    late: (v) => `If an instalment is missed, the late fee is ${v}.`,
    missing: (l) => `The ${l} is not written on this paper. Ask the lender.`,
    ambiguous: (n) => `The ${n} is written twice with different values. Ask the lender.`,
    outro: "If you understood, press the next button. To listen again, press the circular arrow button.",
    and: "and",
  },
  flag: {
    match: (n) => `${cap(n)}: this matches the paper.`,
    conflictNegated: (n, paper) => `Attention! The agent said there is no ${n}, but the paper says ${paper}. Ask the lender.`,
    conflict: (n, said, paper) => `Attention! The agent said the ${n} is ${said}, but the paper says ${paper}. Ask the lender.`,
    notMentioned: (n) => `The agent said nothing about the ${n}. You can ask again.`,
    reason: (n, r) => `${cap(n)}: ${r}.`,
    unableWithPaper: (n, paper) => `Could not check the ${n}. The paper says ${paper}. Ask clearly.`,
    notOnPaper: (n) => `The ${n} is not written on the paper, so it could not be checked. Ask the lender.`,
  },
  reason: REASON,
  gate: {
    ask: GATE_ASK,
    followUp: FOLLOW_UP,
    matched: "Good, this matches the paper.",
    stop: "Do not sign yet. Bring someone you trust.",
    notMatched: "This does not match the paper.",
    noProblem: "That is all right.",
    listen: "Listen carefully.",
    tellAgain: "Now tell me again:",
    implausible: "This number does not fit this question. Please say it again.",
    reExplain: {
      net: (v) => `You will get ${v} in hand.`,
      loan: (v) => `The loan is ${v}.`,
      installment: (v) => `The instalment is ${v}.`,
      fee: (v) => `The processing fee is ${v}.`,
      late: (v) => `If an instalment is missed, the late fee is ${v}.`,
      noLate: "The late fee is not written on the paper. Ask the lender what happens if an instalment is missed.",
    },
  },
  gateFieldName: GATE_NAME,
  lender: {
    conflict: (n, neg, said, paper) =>
      `${cap(n)}: the agent ${neg ? "said it will not be charged" : `said ${said}`}, but the paper says ${paper}. Which is correct? Please give it in writing.`,
    missing: (n) => `How much is the ${n}? Please write it on the paper.`,
    ambiguous: (n) => `The ${n} is written twice with different values. Which one is correct?`,
    gateFailed: (n) => `Please explain the ${n} to me again, slowly.`,
    none: "How much will I have to pay in total? Please give it in writing.",
  },
  result: {
    passed:
      "You explained the main points of the loan in your own words. This was a number-and-keyword check. It is proof of understanding, alongside the signature. It is not a signature, and not a loan approval.",
    stoppedExtra: "Some points did not match the paper.",
    ask: (q) => `Ask the lender: ${q}`,
    grievanceOnPaper: `If you have a complaint, first speak to the lender's grievance officer. Their name is written on the paper. If it is still not solved, complain on the RBI website, ${RBI}.`,
    grievanceNotOnPaper: `If you have a complaint, ask the lender for their grievance officer's name in writing. If it is still not solved, complain on the RBI website, ${RBI}.`,
  },
};

const receipt: ReceiptStrings = {
  title: "Arth receipt",
  present: "Present",
  presence: { with_agent: "borrower and agent", alone: "borrower" },
  docFingerprint: "Document fingerprint",
  outcomePassed: "✅ Proof of understanding, alongside the signature",
  outcomeStopped: "✋ Do not sign yet — bring someone you trust",
  cols: { item: "Item", paper: "📄 Paper", agent: "🧑‍💼 Agent", borrower: "🧑 Borrower" },
  cell: {
    match: "Matches",
    conflict: "Different",
    notMentioned: "Not said",
    unable: "Couldn't check",
    notOnPaper: "Not on the paper",
    writtenTwice: "Written twice, differently",
    notAsked: "Not asked",
    saidNotCharged: "₹0 (said: not charged)",
    noClearAmount: "No clear amount",
    gatePassed: "Explained correctly in their own words",
    gateFailed: "Different 3 times",
    gatePending: "Not checked",
    gateNotOnPaper: "Not on the paper",
  },
  freq: { monthly: " per month", weekly: " per week", fortnightly: " every 15 days", once: "" },
  months: "months",
  weeks: "weeks",
  questionsTitle: "❓ Ask the lender before signing",
  complaintTitle: "📢 Where to complain",
  grievanceOfficer: "1. Lender's grievance officer: ",
  grievanceAsk: "1. Ask the lender for the grievance officer's name in writing",
  rbi: "2. RBI Complaint Management System: cms.rbi.org.in",
  label: "Proof of understanding — not a signature, not a loan approval",
  evidenceTitle: "Evidence",
  termsTitle: "Terms on the paper",
  agentVsPaperTitle: "Agent vs paper",
  ownWordsTitle: "Borrower's own words",
  recordingsTitle: "All recordings (original and re-recordings)",
  fullFingerprintsTitle: "Full fingerprints",
  recCols: { who: "Who", what: "What", time: "Time", transcript: "Transcript" },
  speaker: { agent: "Agent", borrower: "Borrower", helper: "Helper" },
  agentChanged: "The agent said something different earlier",
  disclaimer:
    "Languages marked Beta are still being tested, and their wording has not been reviewed by a native speaker. Arth gives proof of understanding alongside the signature. It is not a signature and not a loan approval.",
};

export const en: LangPack = {
  code: "en",
  name: "English",
  verified: true,
  prisma: { language_code: "en-IN" },
  timbre: { language: "en-IN", voices: { female: "Kaveri", male: "Pranav" } },
  greeting: "Hello. I will speak in English.",
  normalize: (t) => wordsToDigits(t, TABLE),
  numberToWords: englishWords,
  rupeesToWords: (n) => (n === 1 ? "one rupee" : `${englishWords(n)} rupees`),
  lexicon: {
    numberWords: NUMBER_WORDS,
    // The engine already knows these English words (lib/engine/extractClaims.ts); listed here for review.
    negation: ["no", "not", "free", "nil", "waived"],
    consequence: ["late fee", "penalty", "fine", "charge", "extra"],
    navigation: ["next", "skip", "please"],
  },
  say: buildSay(phrases),
  ui: {
    start: "▶️ Start",
    replay: "Replay",
    slow: "Slower",
    betaTag: "Beta",
    reviewTag: "Wording under review",
    notReady: "not available yet",
    disclaimer:
      "Languages marked Beta are still being tested, and their wording has not been reviewed by a native speaker. Arth gives proof of understanding alongside the signature. It is not a signature and not a loan approval.",
    chooseLanguage: "Language",    female: "🔊 Voice 1",
    male: "🔊 Voice 2",
    alone: "1 · Only me",
    withAgent: "2 · Me + agent",
    aloneAria: "Only me",
    withAgentAria: "Me and the agent",
    sample: "3 · Sample",
    cameraOn: "📷 Camera on (not recording)",
    cameraOff: "⏹️ Camera off",
    readingPaper: "⏳ Reading the paper…",
    next: "Next",
    ready: "I am ready ▶️",
    handoverTitle: { agent: "The agent speaks now", borrower: "Now give the phone to the borrower" },
    role: { agent: "Agent", borrower: "Borrower", helper: "Helper" },
    speakingNow: "🎤 Speaking now:",
    appSpeaking: "The app is speaking… listen",
    audioFailed: "🔇 Audio did not play ({error}). Press 🔁.",
    status: { match: "Matches", conflict: "Different", not_mentioned: "Not said", unable_to_verify: "Couldn't check" },
    legend: "✅ Matches · ❌ Different · ❔ Couldn't check",
    recording: "Recording",
    micPermission: "🎤❔ Microphone permission…",
    appUnderstanding: "📱 The app is understanding you…",
    appSpeakingListen: "📱 The app is speaking — listen, then speak",
    yourTurn: "🎤 Your turn — press the mic",
    agentCol: "🧑‍💼 Agent",
    paperCol: "📄 Paper",
    numberKeywordCheck: "🔢 Number-and-keyword check",
    tries: "Try",
    proofTitle: "Proof of understanding, alongside the signature",
    dontSign: "Do not sign yet",
    bringTrusted: "Bring someone you trust 🤝",
    ownWords: "🧑 In your own words",
    agentVsPaper: "🧑‍💼 Agent vs 📄 paper",
    askLender: "❓ Ask the lender",
    complaint: "📢 Complaint",
    grievanceMissing: "The grievance officer's name is not on the paper — ask the lender in writing.",
    receiptBtn: "Receipt",
    clear: "Clear everything",
    clearSure: "Sure? ✔️",
    pages: "pages",
    receiptFingerprint: "🔏 Receipt fingerprint",
    fingerprintHelp: "Same number on both phones = identical copies.",
    share: "Share",
    consentLine: "I, (your name), agree to the recording of this conversation.",
    agentChanged: "The agent said something different earlier",
    freq: { monthly: "every month", weekly: "every week", fortnightly: "every 15 days", once: "" },
    months: "months",
    weeks: "weeks",
    fieldName: {
      loan_amount: "Loan amount",
      interest_rate: "Interest",
      tenure: "Loan tenure",
      installment: "Instalment",
      processing_fee: "Processing fee",
      net_disbursed: "Amount in hand",
      late_fee: "Late fee",
    },
    fieldShort: {
      loan_amount: "Amount",
      net_disbursed: "In hand",
      installment: "EMI",
      processing_fee: "Fee",
      tenure: "Tenure",
      late_fee: "Late fee",
      interest_rate: "Interest",
    },
    agentQuestion: {
      loan_amount: "💰 How many rupees is the loan?",
      installment: "🗓️ How much is the instalment, and how often?",
      processing_fee: "🧾 How much is the processing fee?",
      tenure: "⏳ For how many months is the loan?",
      late_fee: "⏰ How much late fee if an instalment is missed?",
    },
    gateAsk: GATE_ASK,
    followUp: FOLLOW_UP,
    gateFieldName: {
      amount_in_hand: "Amount in hand",
      installment: "Instalment",
      processing_fee: "Processing fee",
      missed_payment: "If an instalment is missed",
    },
    reason: REASON,
  },
  receipt,
};
