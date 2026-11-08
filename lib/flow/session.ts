// In-memory session data for one in-person check. Nothing is stored on a server or on disk.
import type { Field, Value } from "@/lib/engine/types";

export type Speaker = "agent" | "borrower" | "helper";
export type Presence = "alone" | "with_agent";

export type PaperInput = {
  terms: Value[];
  missing: Field[];
  ambiguous: Field[];
  lender?: string;
  grievance?: string; // grievance-officer line printed on the KFS, if found
  source: "pdf" | "qr" | "sample";
  bytes?: Uint8Array; // the document as given (kept in memory for the Phase 6 fingerprint)
};

export type Recording = {
  id: number;
  speaker: Speaker;
  step: "consent" | "agent" | "teachback";
  field?: string;
  transcript: string;
  blob: Blob; // 16 kHz mono WAV, memory only
  durationSec: number;
  at: string; // ISO timestamp
};
