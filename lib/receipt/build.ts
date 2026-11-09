// Receipt content (CLAUDE.md section 8) as plain data. Pure and tested; lib/receipt/pdf.ts only draws it.
// Page 1 "Summary": one table (Paper | Agent | Borrower) + questions + complaint path + label.
// Page 2+ "Evidence log": terms with paper lines, comparisons with both evidence snippets, all recordings
// (original + re-recordings) with SHA-256, full fingerprints. No verdict words.
import { GATE_FIELDS, type GateFieldId, type GateFieldStatus, type GateState } from "@/lib/engine/gate";
import type { Field, Status, Value } from "@/lib/engine/types";
import { AGENT_CHANGED_HI, agentChangedEarlier, type AgentCheck } from "@/lib/flow/agent";
import { formatINR } from "@/lib/flow/money";
import { FIELD_NAME_HI, REASON_HI } from "@/lib/flow/scripts";
import type { PaperInput, Presence, Recording } from "@/lib/flow/session";
import { lenderQuestions } from "@/lib/flow/teachback";

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
export type Cell = { mark: Mark; hi: string; en: string };
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
const FREQ_HI = { monthly: " हर महीने", weekly: " हर हफ़्ते", fortnightly: " हर 15 दिन", once: "" } as const;
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

/** Same in Hindi words around digits: "₹2,666 हर महीने", "12 महीने", "₹0 (नहीं लगेगी)". */
export function valueHiShort(v: Value): string {
  if (v.negated && v.amount === 0) return "₹0 (कहा: नहीं लगेगी)";
  if (v.amount === undefined) return "साफ़ रक़म नहीं";
  switch (v.unit) {
    case "INR":
      return formatINR(v.amount) + (v.frequency ? FREQ_HI[v.frequency] : "");
    case "percent":
      return `${v.amount}%`;
    case "months":
      return `${v.amount} महीने`;
    case "weeks":
      return `${v.amount} हफ़्ते`;
    default:
      return String(v.amount);
  }
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

const STATUS_CELL: Record<Status, (spoken?: string) => Cell> = {
  match: (s) => ({ mark: "match", hi: `मिलता है${s ? ` · ${s}` : ""}`, en: "matched" }),
  conflict: (s) => ({ mark: "conflict", hi: `अलग है${s ? ` · ${s}` : ""}`, en: "different" }),
  not_mentioned: () => ({ mark: "not_mentioned", hi: "नहीं बोला", en: "not mentioned" }),
  unable_to_verify: () => ({ mark: "unable", hi: "जाँच नहीं पाए", en: "couldn't check" }),
};

const GATE_CELL: Record<GateFieldStatus, Cell> = {
  passed: { mark: "match", hi: "अपने शब्दों में सही बताया", en: "matched" },
  failed: { mark: "conflict", hi: "3 बार अलग बताया", en: "different (3 tries)" },
  pending: { mark: "unable", hi: "जाँच नहीं हुई", en: "not checked (stopped earlier)" },
  not_on_paper: { mark: "unable", hi: "कागज़ पर नहीं", en: "not on the paper" },
};

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

export function buildSummary(input: ReceiptInput): Summary {
  const { paper, checks, gate } = input;
  const rows: Row[] = ROW_FIELDS.map((field) => {
    const pv = paper.terms.find((v) => v.field === field);
    const paperCell: Cell = paper.ambiguous.includes(field)
      ? { mark: "warn", hi: "कागज़ पर दो अलग बातें", en: "written twice, differently" }
      : pv
        ? { mark: "none", hi: valueHiShort(pv), en: valueEn(pv) }
        : { mark: "unable", hi: "कागज़ पर नहीं लिखा", en: "not on the paper" };

    let agentCell: Cell = DASH;
    const forField = checks.filter((c) => c.field === field);
    const changed = agentChangedEarlier(checks, field);
    if (input.presence === "with_agent" && forField.length) {
      const c = forField[forField.length - 1];
      const spoken = c.spoken[0] && c.status !== "unable_to_verify" ? valueHiShort(c.spoken[0]) : undefined;
      agentCell = STATUS_CELL[c.status](spoken);
      if (c.status === "unable_to_verify" && c.reason) agentCell = { ...agentCell, hi: REASON_HI[c.reason].split(" — ")[0] };
      if (changed) agentCell = { mark: "warn", hi: `${agentCell.hi} · ${AGENT_CHANGED_HI}`, en: `${agentCell.en}; earlier answer differed` };
    } else if (input.presence === "with_agent" && ["loan_amount", "installment", "processing_fee", "tenure", "late_fee"].includes(field)) {
      agentCell = { mark: "not_mentioned", hi: "नहीं पूछा गया", en: "not asked" };
    }

    const gid = gate ? gateFieldForRow(field, paper.terms) : null;
    const borrowerCell: Cell = gate && gid ? GATE_CELL[gate.fields[gid].status] : DASH;

    return { field, hi: FIELD_NAME_HI[field], en: FIELD_EN[field], paper: paperCell, agent: agentCell, borrower: borrowerCell, changed };
  });

  return {
    createdIST: formatIST(input.createdAt),
    createdISO: input.createdAt.toISOString(),
    lender: paper.lender,
    presenceHi: input.presence === "with_agent" ? "उधार लेने वाली और एजेंट" : "उधार लेने वाली",
    presenceEn: input.presence === "with_agent" ? "borrower and agent" : "borrower",
    outcome: gate ? (gate.result === "passed" ? "passed" : "stopped") : null,
    rows,
    questions: lenderQuestions(paper, checks, gate?.fields),
    complaintHi: [
      paper.grievance ? `1. लेंडर के शिकायत अधिकारी: ${paper.grievance}` : "1. लेंडर से शिकायत अधिकारी का नाम लिखकर माँगिए",
      "2. RBI शिकायत पोर्टल: cms.rbi.org.in",
    ],
    complaintEn: ["1. Lender's grievance officer (named on the KFS)", "2. RBI Complaint Management System: cms.rbi.org.in"],
    documentShort: input.documentSha256 ? input.documentSha256.slice(0, 12) : "—",
    label: RECEIPT_LABEL,
    labelHi: RECEIPT_LABEL_HI,
  };
}

const SPEAKER = { agent: ["एजेंट", "Agent"], borrower: ["उधार लेने वाली", "Borrower"], helper: ["मददगार", "Helper"] } as const;
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

export function buildEvidence(input: ReceiptInput): Evidence {
  const { paper, checks, gate } = input;
  const byField = new Map<string, AgentCheck[]>();
  for (const c of checks) byField.set(c.field, [...(byField.get(c.field) ?? []), c]);

  return {
    sourceEn: SOURCE_EN[paper.source],
    documentSha256: input.documentSha256,
    terms: paper.terms.map((v) => ({ hi: FIELD_NAME_HI[v.field], en: FIELD_EN[v.field], value: valueEn(v), evidence: v.evidence })),
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
            status: GATE_CELL[fs.status].en,
            paper: pv ? pv.evidence : "not on the paper",
            answers: fs.answers.map((a) => a.transcript),
          };
        })
      : [],
    recordings: input.recordings.map((r) => ({
      id: r.id,
      whoHi: SPEAKER[r.speaker][0],
      whoEn: SPEAKER[r.speaker][1],
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
