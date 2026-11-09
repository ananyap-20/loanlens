// A language pack: everything the app says or shows in one language, plus how that language's speech is
// turned into the engine's vocabulary. The engine itself stays one deterministic Hindi/Hinglish/English engine:
// a pack's `normalize` maps its own number words to digits and its keywords to engine keywords first.
// Missing entries are never guessed: an unknown number word stays a word, so the engine finds no number
// and the field becomes "couldn't check" / "not mentioned" — never a made-up value.
import type { AnswerOutcome, FollowUpKey, GateFieldId, GateFieldStatus, NextStep } from "@/lib/engine/gate";
import type { VerifyReason } from "@/lib/engine";
import type { Field, Status, Value } from "@/lib/engine/types";
import type { AgentCheck, AgentField } from "@/lib/flow/agent";
import type { PaperFacts } from "@/lib/flow/scripts";
import type { PaperFailure } from "@/lib/paper/terms";
import type { ReceiptStrings } from "@/lib/receipt/strings";

export type LangCode = "hi" | "en" | "mr" | "bn" | "gu" | "kn" | "ml" | "pa" | "ta" | "te";
export type VoiceGender = "female" | "male";

export type SpokenTemplates = {
  who: string;
  paper: string;
  micDenied: string;
  noMic: string;
  micUnsupported: string;
  micError: string;
  emptyTranscript: string;
  apiError: string;
  cameraFail: string;
  sharedFail: string;
  receipt: string;
  receiptShared: string;
  receiptDownloaded: string;
  receiptFail: string;
  clearConfirm: string;
  cleared: string;
  navOnly: string;
  paperFail: Record<PaperFailure, string>;
  explainPaper: (p: PaperFacts) => string;
  handover: { agent: string; borrower: string };
  consentSay: string;
  consentDone: string;
  agentAsk: Record<AgentField, string>;
  agentFlag: (c: AgentCheck) => string;
  gatePrompt: (next: NextStep, paper: Value[], last?: AnswerOutcome, first?: boolean) => { text: string; slow: boolean };
  teachbackIntro: string;
  lenderQuestions: (paper: PaperFacts, checks?: AgentCheck[], gateFields?: Record<GateFieldId, { status: GateFieldStatus }>) => string[];
  resultSpeech: (kind: "passed" | "stopped", questions: string[], grievanceOnPaper: boolean) => string;
};

/** On-screen words (the app is voice-first; these are short labels next to icons). */
export type UiStrings = {
  start: string;
  replay: string;
  slow: string;
  chooseLanguage: string;
  female: string;
  male: string;
  alone: string;
  withAgent: string;
  aloneAria: string;
  withAgentAria: string;
  sample: string;
  cameraOn: string;
  cameraOff: string;
  readingPaper: string;
  next: string;
  ready: string;
  handoverTitle: { agent: string; borrower: string };
  role: { agent: string; borrower: string; helper: string };
  speakingNow: string;
  appSpeaking: string;
  audioFailed: string;
  status: Record<Status, string>;
  legend: string;
  recording: string;
  micPermission: string;
  appUnderstanding: string;
  appSpeakingListen: string;
  yourTurn: string;
  agentCol: string;
  paperCol: string;
  numberKeywordCheck: string;
  tries: string;
  proofTitle: string;
  dontSign: string;
  bringTrusted: string;
  ownWords: string;
  agentVsPaper: string;
  askLender: string;
  complaint: string;
  grievanceMissing: string;
  receiptBtn: string;
  clear: string;
  clearSure: string;
  pages: string;
  receiptFingerprint: string;
  fingerprintHelp: string;
  share: string;
  consentLine: string;
  agentChanged: string;
  freq: { monthly: string; weekly: string; fortnightly: string; once: string };
  months: string;
  weeks: string;
  fieldName: Record<Field, string>;
  fieldShort: Record<Field, string>;
  agentQuestion: Record<AgentField, string>;
  gateAsk: Record<GateFieldId, string>;
  followUp: Record<FollowUpKey, string>;
  gateFieldName: Record<GateFieldId, string>;
  reason: Record<VerifyReason, string>;
};

export type LangPack = {
  code: LangCode;
  /** Name in its own script, for the picker. */
  name: string;
  /** false = hidden from the picker until a native speaker signs off. */
  verified: boolean;
  prisma: { language_code: string };
  timbre: { language: string; voices: Partial<Record<VoiceGender, string>> };
  /** Short spoken line when the language is tapped in the picker. */
  greeting: string;
  /** Transcript -> engine vocabulary (identity for Hindi). Deterministic, tested per pack. */
  normalize: (transcript: string) => string;
  /** Integer -> spoken words, or null when this pack has no number words yet (callers then show digits only). */
  numberToWords: ((n: number) => string) | null;
  /** Whole rupees -> spoken words incl. the currency word, or null when this pack has no verified number words. */
  rupeesToWords: ((n: number) => string) | null;
  /** Raw lexicon data, kept for review by a native speaker and for the tests. */
  lexicon: {
    numberWords: ReadonlyArray<readonly [string, number]>;
    negation: readonly string[];
    consequence: readonly string[];
    navigation: readonly string[];
  };
  say: SpokenTemplates | null; // null for unverified packs
  ui: UiStrings | null;
  receipt: ReceiptStrings | null;
};
