// Receipt content (CLAUDE.md section 8) as plain styled lines. Pure and tested; the canvas renderer only draws them.
// Contains: terms, every comparison with BOTH evidence snippets, all transcripts (original + re-recordings),
// SHA-256 of the document and of each WAV clip, timestamp, and the required label. No verdict words.
import type { GateFieldId, GateFieldStatus, GateState } from "@/lib/engine/gate";
import { GATE_FIELDS } from "@/lib/engine/gate";
import type { Field, Status, Value } from "@/lib/engine/types";
import type { AgentCheck } from "@/lib/flow/agent";
import { formatINR } from "@/lib/flow/money";
import type { PaperInput, Presence, Recording } from "@/lib/flow/session";
import { lenderQuestions } from "@/lib/flow/teachback";

export const RECEIPT_LABEL = "Proof of understanding — not a signature, not a loan approval";

export type LineStyle = "title" | "label" | "h" | "body" | "muted" | "mono" | "match" | "conflict" | "neutral";
export type Line = { text: string; style: LineStyle };

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
  net_disbursed: "Amount in hand (net disbursed)",
  late_fee: "Late fee",
};

const GATE_EN: Record<GateFieldId, string> = {
  amount_in_hand: "Amount in hand",
  installment: "Instalment amount and how often",
  processing_fee: "Processing fee",
  missed_payment: "What happens if an instalment is missed",
};

// Which paper field is the evidence for each teach-back point.
const GATE_PAPER: Record<GateFieldId, Field[]> = {
  amount_in_hand: ["net_disbursed", "loan_amount"],
  installment: ["installment"],
  processing_fee: ["processing_fee"],
  missed_payment: ["late_fee"],
};

const STATUS_EN: Record<Status, { text: string; style: LineStyle }> = {
  match: { text: "✅ matched", style: "match" },
  conflict: { text: "❌ different", style: "conflict" },
  not_mentioned: { text: "❔ not mentioned", style: "neutral" },
  unable_to_verify: { text: "❔ couldn't check", style: "neutral" },
};

const GATE_STATUS_EN: Record<GateFieldStatus, { text: string; style: LineStyle }> = {
  passed: STATUS_EN.match,
  failed: { text: "❌ different (3 tries)", style: "conflict" },
  pending: { text: "❔ couldn't check (check stopped earlier)", style: "neutral" },
  not_on_paper: { text: "❔ not on the paper", style: "neutral" },
};

const FREQ_EN = { monthly: " per month", weekly: " per week", fortnightly: " every 15 days", once: "" } as const;
const SPEAKER_EN = { agent: "Agent", borrower: "Borrower", helper: "Helper" } as const;
const STEP_EN = { consent: "consent", agent: "agent check", teachback: "teach-back" } as const;
const SOURCE_EN = { pdf: "PDF shared or picked", qr: "QR code", sample: "sample KFS PDF (fictional)" } as const;

export function valueEn(v: Value): string {
  if (v.negated && v.amount === 0) return "none (said it is not charged)";
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

const q = (s: string) => `“${s}”`;
const fieldName = (f: string) => FIELD_EN[f as Field] ?? GATE_EN[f as GateFieldId] ?? f;

export function buildReceipt(input: ReceiptInput): Line[] {
  const { paper, recordings, checks, gate } = input;
  const L: Line[] = [];
  const add = (text: string, style: LineStyle = "body") => L.push({ text, style });
  const paperValue = (f: Field) => paper.terms.find((v) => v.field === f);

  add("LoanLens receipt", "title");
  add(RECEIPT_LABEL, "label");
  add(`Created: ${formatIST(input.createdAt)} (${input.createdAt.toISOString()})`);
  add(`Present: ${input.presence === "with_agent" ? "borrower and agent" : "borrower"}`);

  add("Paper", "h");
  if (paper.lender) add(`Lender: ${paper.lender}`);
  add(`Source: ${SOURCE_EN[paper.source]}`);
  add(`Document SHA-256: ${input.documentSha256 ?? "not available"}`, "mono");

  add("Terms on the paper", "h");
  for (const v of paper.terms) {
    add(`${FIELD_EN[v.field]}: ${valueEn(v)}`);
    add(`paper: ${q(v.evidence)}`, "muted");
  }
  for (const f of paper.missing) add(`${FIELD_EN[f]}: not on the paper`, "neutral");
  for (const f of paper.ambiguous) add(`${FIELD_EN[f]}: written twice with different values`, "neutral");

  if (checks.length) {
    add("Agent vs paper", "h");
    const byField = new Map<string, AgentCheck[]>();
    for (const c of checks) byField.set(c.field, [...(byField.get(c.field) ?? []), c]);
    for (const [field, all] of byField) {
      const c = all[all.length - 1]; // the latest recording counts
      const s = STATUS_EN[c.status];
      add(`${FIELD_EN[field as Field]}: ${s.text}`, s.style);
      add(`paper: ${c.paper ? q(c.paper.evidence) : "not on the paper"}`, "muted");
      add(`agent: ${c.spoken[0] ? q(c.spoken[0].evidence) : "—"} (said: ${q(c.transcript)})`, "muted");
      if (all.length > 1) add(`${all.length} recordings for this point; the latest counts`, "muted");
    }
  }

  if (gate) {
    add("Borrower's own words (number-and-keyword check)", "h");
    add(
      gate.result === "passed"
        ? "All required points matched the paper."
        : "Stopped: “Abhi sign mat kijiye. Kisi bharose wale ko saath laiye.”",
      gate.result === "passed" ? "match" : "conflict",
    );
    for (const id of GATE_FIELDS) {
      const fs = gate.fields[id];
      const s = GATE_STATUS_EN[fs.status];
      add(`${GATE_EN[id]}: ${s.text}`, s.style);
      const pv = GATE_PAPER[id].map(paperValue).find(Boolean);
      add(`paper: ${pv ? q(pv.evidence) : "not on the paper"}`, "muted");
      fs.answers.forEach((a, k) => add(`borrower, try ${k + 1}: ${q(a.transcript)}`, "muted"));
    }
  }

  add("Questions to ask the lender", "h");
  for (const question of lenderQuestions(paper, checks, gate?.fields)) add(`• ${question}`);

  add("Where to complain", "h");
  add(`1. ${paper.grievance ?? "Ask the lender for the grievance officer's name in writing."}`);
  add("2. RBI Complaint Management System: cms.rbi.org.in");

  add("Recordings (original and re-recordings)", "h");
  if (recordings.length === 0) add("No recordings.", "muted");
  for (const r of recordings) {
    const at = formatIST(new Date(r.at));
    add(`#${r.id} ${SPEAKER_EN[r.speaker]} · ${STEP_EN[r.step]}${r.field ? ` · ${fieldName(r.field)}` : ""} · ${at} · ${r.durationSec.toFixed(1)} s`);
    add(q(r.transcript), "muted");
    add(`SHA-256: ${r.sha256}`, "mono");
  }

  add("—", "muted");
  add(RECEIPT_LABEL, "label");
  add("Voice is not a legal signature: this is proof of understanding, alongside the signature.", "muted");
  return L;
}

export function receiptFilename(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `loanlens-receipt-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.png`;
}
