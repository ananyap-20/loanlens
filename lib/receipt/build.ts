// Receipt content (CLAUDE.md section 8) as plain data. Pure and tested; lib/receipt/pdf.ts only draws it.
// Page 1 "Summary": one table (Paper | Agent | Borrower) + questions + complaint path + label.
// Page 2+ "Evidence log": terms with paper lines, comparisons with both evidence snippets, all recordings
// (original + re-recordings) with SHA-256, full fingerprints. No verdict words.
import { GATE_FIELDS, type GateFieldId, type GateFieldStatus, type GateState } from "@/lib/engine/gate";
import type { Field, Status, Value } from "@/lib/engine/types";
import { agentChangedEarlier, type AgentCheck } from "@/lib/flow/agent";
import { formatINR } from "@/lib/flow/money";
import { FIELD_NAME_HI, REASON_HI } from "@/lib/flow/scripts";
import type { PaperInput, Presence, Recording } from "@/lib/flow/session";
import { lenderQuestions } from "@/lib/flow/teachback";
import type { VerifyReason } from "@/lib/engine";
import type { PaperFacts } from "@/lib/flow/scripts";
import { rupeesToHindi } from "@/lib/engine";
import { nativeINR, nativeNumber } from "@/lib/i18n/numerals";
import type { LangCode } from "@/lib/i18n/types";
import { HI_RECEIPT, type ReceiptStrings } from "./strings";

export const RECEIPT_LABEL = "Proof of understanding — not a signature, not a loan approval";
export const RECEIPT_LABEL_HI = "समझ का सबूत — यह साइन नहीं है, और लोन की मंज़ूरी भी नहीं";

export type ReceiptInput = {
  createdAt: Date;
  presence: Presence;
  paper: PaperInput;
  documentSha256: string | null;
  recordings: (Recording & { sha256: string })[];
  checks: AgentCheck[];
  gate: GateState | null;
};

export const FIELD_EN: Record<Field, string> = {
  loan_amount: "Loan amount",
  interest_rate: "Interest rate",
  tenure: "Tenure",
  installment: "Instalment (EMI)",
  processing_fee: "Processing fee",
  net_disbursed: "Amount in hand",
  late_fee: "Late fee",
};

const GATE_EN: Record<GateFieldId, string> = {
  amount_in_hand: "Amount in hand",
  installment: "Instalment",
  processing_fee: "Processing fee",
  missed_payment: "Missed instalment",
};

export type Mark = "match" | "conflict" | "unable" | "not_mentioned" | "warn" | "none";
export type Cell = { mark: Mark; hi: string; en: string; words?: string };
export type Row = { field: Field; hi: string; en: string; paper: Cell; agent: Cell; borrower: Cell; changed: boolean };

export type Summary = {
  createdIST: string;
  createdISO: string;
  lender?: string;
  presenceHi: string;
  presenceEn: string;
  outcome: "passed" | "stopped" | null;
  rows: Row[];
  questions: string[];
  complaintHi: string[];
  complaintEn: string[];
  documentShort: string; // first 12 hex chars
  label: string;
  labelHi: string;
  strings: ReceiptStrings;
};

export type EvidenceRecording = {
  id: number;
  whoHi: string;
  whoEn: string;
  what: string;
  time: string;
  durationSec: number;
  transcript: string;
  sha16: string;
  sha256: string;
};

export type Evidence = {
  sourceEn: string;
  documentSha256: string | null;
  terms: { hi: string; en: string; value: string; evidence: string }[];
  missing: string[];
  ambiguous: string[];
  comparisons: { en: string; status: string; paper: string; agent: string; changed: boolean; attempts: number }[];
  teachback: { en: string; status: string; paper: string; answers: string[] }[];
  recordings: EvidenceRecording[];
};

export const ROW_FIELDS: Field[] = ["loan_amount", "net_disbursed", "installment", "processing_fee", "tenure", "interest_rate", "late_fee"];

const FREQ_EN = { monthly: " per month", weekly: " per week", fortnightly: " every 15 days", once: "" } as const;
const SOURCE_EN = { pdf: "PDF shared or picked", qr: "QR code", sample: "sample KFS PDF (fictional)" } as const;

/** "₹2,666 per month", "12%", "12 months". */
export function valueEn(v: Value): string {
  if (v.negated && v.amount === 0) return "none (said not charged)";
  if (v.amount === undefined) return "no clear amount";
  switch (v.unit) {
    case "INR":
      return formatINR(v.amount) + (v.frequency ? FREQ_EN[v.frequency] : "");
    case "percent":
      return `${v.amount}%`;
    case "months":
      return `${v.amount} months`;
    case "weeks":
      return `${v.amount} weeks`;
    default:
      return String(v.amount);
  }
}

/** The receipt's words in one language (Hindi by default). */
export type ReceiptLang = {
  /** Selects the digit script (Intl numbering system) for amounts. */
  code: LangCode;
  /** Whole rupees -> words in this language, or null when it has no verified number words (digits only). */
  rupeesToWords: ((n: number) => string) | null;
  strings: ReceiptStrings;
  fieldName: Record<Field, string>;
  reason: Record<VerifyReason, string>;
  lenderQuestions: (paper: PaperFacts, checks?: AgentCheck[], gateFields?: Record<GateFieldId, { status: GateFieldStatus }>) => string[];
};
export const HI_RECEIPT_LANG: ReceiptLang = { code: "hi", rupeesToWords: (n) => rupeesToHindi(n), strings: HI_RECEIPT, fieldName: FIELD_NAME_HI, reason: REASON_HI, lenderQuestions };

/** A value in the language's own digits and words: "₹२,६६६ हर महीने", "१२ महीने", "₹0 (कहा: नहीं लगेगी)". */
export function valueShort(v: Value, t: ReceiptStrings = HI_RECEIPT, code: LangCode = "hi"): string {
  if (v.negated && v.amount === 0) return t.cell.saidNotCharged;
  if (v.amount === undefined) return t.cell.noClearAmount;
  switch (v.unit) {
    case "INR":
      return nativeINR(v.amount, code) + (v.frequency ? t.freq[v.frequency] : "");
    case "percent":
      return `${nativeNumber(v.amount, code)}%`;
    case "months":
      return `${nativeNumber(v.amount, code)} ${t.months}`;
    case "weeks":
      return `${nativeNumber(v.amount, code)} ${t.weeks}`;
    default:
      return nativeNumber(v.amount, code);
  }
}
export const valueHiShort = (v: Value) => valueShort(v, HI_RECEIPT, "hi");

/** The rupee amount in words, only for whole-rupee amounts in a language that has verified number words. */
export function amountWords(v: Value, lang: ReceiptLang): string | undefined {
  if (v.unit !== "INR" || v.amount === undefined || (v.negated && v.amount === 0) || !Number.isInteger(v.amount)) return undefined;
  return lang.rupeesToWords ? lang.rupeesToWords(v.amount) : undefined;
}

export function formatIST(d: Date): string {
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }) + " IST"
  );
}

function statusCell(t: ReceiptStrings, status: Status, spoken?: string): Cell {
  const sp = spoken ? ` · ${spoken}` : "";
  switch (status) {
    case "match":
      return { mark: "match", hi: `${t.cell.match}${sp}`, en: "matched" };
    case "conflict":
      return { mark: "conflict", hi: `${t.cell.conflict}${sp}`, en: "different" };
    case "not_mentioned":
      return { mark: "not_mentioned", hi: t.cell.notMentioned, en: "not mentioned" };
    case "unable_to_verify":
      return { mark: "unable", hi: t.cell.unable, en: "couldn't check" };
  }
}

function gateCell(t: ReceiptStrings, s: GateFieldStatus): Cell {
  switch (s) {
    case "passed":
      return { mark: "match", hi: t.cell.gatePassed, en: "matched" };
    case "failed":
      return { mark: "conflict", hi: t.cell.gateFailed, en: "different (3 tries)" };
    case "pending":
      return { mark: "unable", hi: t.cell.gatePending, en: "not checked (stopped earlier)" };
    case "not_on_paper":
      return { mark: "unable", hi: t.cell.gateNotOnPaper, en: "not on the paper" };
  }
}

// Which summary row shows each teach-back point.
function gateFieldForRow(field: Field, paper: Value[]): GateFieldId | null {
  const hasNet = paper.some((v) => v.field === "net_disbursed" && v.amount !== undefined);
  if (field === "net_disbursed") return hasNet ? "amount_in_hand" : null;
  if (field === "loan_amount") return hasNet ? null : "amount_in_hand";
  if (field === "installment") return "installment";
  if (field === "processing_fee") return "processing_fee";
  if (field === "late_fee") return "missed_payment";
  return null;
}

const DASH: Cell = { mark: "none", hi: "—", en: "" };

export function buildSummary(input: ReceiptInput, lang: ReceiptLang = HI_RECEIPT_LANG): Summary {
  const { paper, checks, gate } = input;
  const t = lang.strings;
  const rows: Row[] = ROW_FIELDS.map((field) => {
    const pv = paper.terms.find((v) => v.field === field);
    const paperCell: Cell = paper.ambiguous.includes(field)
      ? { mark: "warn", hi: t.cell.writtenTwice, en: "written twice, differently" }
      : pv
        ? { mark: "none", hi: valueShort(pv, t, lang.code), en: valueEn(pv), words: amountWords(pv, lang) }
        : { mark: "unable", hi: t.cell.notOnPaper, en: "not on the paper" };

    let agentCell: Cell = DASH;
    const forField = checks.filter((c) => c.field === field);
    const changed = agentChangedEarlier(checks, field);
    if (input.presence === "with_agent" && forField.length) {
      const c = forField[forField.length - 1];
      const spoken = c.spoken[0] && c.status !== "unable_to_verify" ? valueShort(c.spoken[0], t, lang.code) : undefined;
      agentCell = statusCell(t, c.status, spoken);
      if (spoken && c.spoken[0]) agentCell.words = amountWords(c.spoken[0], lang);
      if (c.status === "unable_to_verify" && c.reason) agentCell = { ...agentCell, hi: lang.reason[c.reason].split(" — ")[0] };
      if (changed) agentCell = { mark: "warn", hi: `${agentCell.hi} · ${t.agentChanged}`, en: `${agentCell.en}; earlier answer differed` };
    } else if (input.presence === "with_agent" && ["loan_amount", "installment", "processing_fee", "tenure", "late_fee"].includes(field)) {
      agentCell = { mark: "not_mentioned", hi: t.cell.notAsked, en: "not asked" };
    }

    const gid = gate ? gateFieldForRow(field, paper.terms) : null;
    const borrowerCell: Cell = gate && gid ? gateCell(t, gate.fields[gid].status) : DASH;

    return { field, hi: lang.fieldName[field], en: FIELD_EN[field], paper: paperCell, agent: agentCell, borrower: borrowerCell, changed };
  });

  return {
    createdIST: formatIST(input.createdAt),
    createdISO: input.createdAt.toISOString(),
    lender: paper.lender,
    presenceHi: t.presence[input.presence],
    presenceEn: input.presence === "with_agent" ? "borrower and agent" : "borrower",
    outcome: gate ? (gate.result === "passed" ? "passed" : "stopped") : null,
    rows,
    questions: lang.lenderQuestions(paper, checks, gate?.fields),
    complaintHi: [paper.grievance ? `${t.grievanceOfficer}${paper.grievance}` : t.grievanceAsk, t.rbi],
    complaintEn: ["1. Lender's grievance officer (named on the KFS)", "2. RBI Complaint Management System: cms.rbi.org.in"],
    documentShort: input.documentSha256 ? input.documentSha256.slice(0, 12) : "—",
    label: RECEIPT_LABEL,
    labelHi: t.label,
    strings: t,
  };
}

const SPEAKER_EN = { agent: "Agent", borrower: "Borrower", helper: "Helper" } as const;
const STEP_EN = { consent: "consent", agent: "agent check", teachback: "teach-back" } as const;

function whatEn(r: Recording): string {
  if (r.field === "navigation") return `${STEP_EN[r.step]} · not an answer ("next"/"skip")`;
  const f = r.field ? (FIELD_EN[r.field as Field] ?? GATE_EN[r.field as GateFieldId] ?? r.field) : "";
  return f ? `${STEP_EN[r.step]} · ${f}` : STEP_EN[r.step];
}

const STATUS_EN: Record<Status, string> = {
  match: "✅ matched",
  conflict: "❌ different",
  not_mentioned: "❔ not mentioned",
  unable_to_verify: "❔ couldn't check",
};

export function buildEvidence(input: ReceiptInput, lang: ReceiptLang = HI_RECEIPT_LANG): Evidence {
  const { paper, checks, gate } = input;
  const byField = new Map<string, AgentCheck[]>();
  for (const c of checks) byField.set(c.field, [...(byField.get(c.field) ?? []), c]);

  return {
    sourceEn: SOURCE_EN[paper.source],
    documentSha256: input.documentSha256,
    terms: paper.terms.map((v) => {
      const words = amountWords(v, lang);
      const digits = valueShort(v, lang.strings, lang.code);
      return { hi: lang.fieldName[v.field], en: FIELD_EN[v.field], value: words ? `${digits} — ${words}` : digits, evidence: v.evidence };
    }),
    missing: paper.missing.map((f) => FIELD_EN[f]),
    ambiguous: paper.ambiguous.map((f) => FIELD_EN[f]),
    comparisons: [...byField.entries()].map(([field, all]) => {
      const c = all[all.length - 1]; // the latest recording counts; earlier ones stay in the log
      return {
        en: FIELD_EN[field as Field],
        status: STATUS_EN[c.status],
        paper: c.paper ? c.paper.evidence : "not on the paper",
        agent: c.spoken[0] ? `${c.spoken[0].evidence} (said: ${c.transcript})` : c.transcript,
        changed: agentChangedEarlier(checks, field),
        attempts: all.length,
      };
    }),
    teachback: gate
      ? GATE_FIELDS.map((id) => {
          const fs = gate.fields[id];
          const pf = ({ amount_in_hand: ["net_disbursed", "loan_amount"], installment: ["installment"], processing_fee: ["processing_fee"], missed_payment: ["late_fee"] } as Record<GateFieldId, Field[]>)[id];
          const pv = pf.map((f) => paper.terms.find((v) => v.field === f)).find(Boolean);
          return {
            en: GATE_EN[id],
            status: gateCell(lang.strings, fs.status).en,
            paper: pv ? pv.evidence : "not on the paper",
            answers: fs.answers.map((a) => a.transcript),
          };
        })
      : [],
    recordings: input.recordings.map((r) => ({
      id: r.id,
      whoHi: lang.strings.speaker[r.speaker],
      whoEn: SPEAKER_EN[r.speaker],
      what: whatEn(r),
      time: formatIST(new Date(r.at)).replace(/^.*?, /, ""),
      durationSec: Math.round(r.durationSec * 10) / 10,
      transcript: r.transcript,
      sha16: r.sha256.slice(0, 16),
      sha256: r.sha256,
    })),
  };
}

export function receiptFilename(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `loanlens-receipt-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.pdf`;
}
