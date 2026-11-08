// CLAUDE.md section 5 sample KFS (fictional: Sahyog Finance, Sunita) as paper Values.
import type { Value } from "@/lib/engine/types";

export const SAMPLE_PAPER: Value[] = [
  { field: "loan_amount", amount: 30000, unit: "INR", frequency: "once", evidence: "Loan amount: ₹30,000", source: "paper", confidence: "high" },
  { field: "interest_rate", amount: 12, unit: "percent", evidence: "Interest rate: 12% per year (reducing balance)", source: "paper", confidence: "high" },
  { field: "tenure", amount: 12, unit: "months", evidence: "Tenure: 12 months", source: "paper", confidence: "high" },
  { field: "installment", amount: 2666, unit: "INR", frequency: "monthly", evidence: "Instalment: ₹2,666 per month", source: "paper", confidence: "high" },
  { field: "processing_fee", amount: 1500, unit: "INR", frequency: "once", evidence: "Processing fee: ₹1,500 (deducted upfront)", source: "paper", confidence: "high" },
  { field: "net_disbursed", amount: 28500, unit: "INR", frequency: "once", evidence: "Net amount disbursed: ₹28,500", source: "paper", confidence: "high" },
  { field: "late_fee", amount: 200, unit: "INR", evidence: "Late fee: ₹200 per missed instalment", source: "paper", confidence: "high" },
];

// CLAUDE.md section 5 QR payload; encodes exactly the same terms as SAMPLE_PAPER.
export const SAMPLE_QR_PAYLOAD =
  '{"v":1,"lender":"Sahyog Finance (fictional)","amt":30000,"rate":12,"n":12,"freq":"monthly","emi":2666,"fee":1500,"net":28500,"late":200}';

export const paperWithout =(...fields: Value["field"][]) => SAMPLE_PAPER.filter((v) => !fields.includes(v.field));
