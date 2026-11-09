// Call check (P1-b): the SAME engine as the in-person check, applied to a whole call transcript at once.
// Claims are extracted from the full transcript (numbers go to the nearest field word in the same clause;
// numbers with no field word are dropped, never guessed), then each field is compared with the paper.
// Verdict words are the app's usual ones: matched / different / not mentioned / couldn't check.
import { compareField, extractClaims, type VerifyReason } from "@/lib/engine";
import { ALL_FIELDS, type Field, type Status, type Value } from "@/lib/engine/types";
import { agentFlag, type AgentCheck } from "@/lib/flow/agent";

export type CallRow = { field: Field; status: Status; spoken: Value[]; paper?: Value; reason?: VerifyReason };

export type CallResult = {
  rows: CallRow[];
  counts: Record<Status, number>;
};

/**
 * @param transcript the whole call (all chunks joined, in order)
 * @param paper      the paper values
 * @param normalize  the language pack's normaliser (identity for Hindi)
 */
export function checkCall(transcript: string, paper: Value[], normalize: (t: string) => string = (t) => t): CallResult {
  const claims = transcript.trim() ? extractClaims(normalize(transcript), undefined, "agent") : [];
  const rows = ALL_FIELDS.map((field) => {
    const side = compareField(field, paper, claims);
    return { field, status: side.status, spoken: side.spoken, paper: paper.find((v) => v.field === field && v.source === "paper"), reason: side.reason };
  });
  const counts = { match: 0, conflict: 0, not_mentioned: 0, unable_to_verify: 0 } as Record<Status, number>;
  for (const r of rows) counts[r.status]++;
  return { rows, counts };
}

/** The call's rows in the shape the language packs already speak (flags) and turn into lender questions. */
export function rowsAsChecks(rows: CallRow[], transcript: string): AgentCheck[] {
  return rows.map((r) => ({
    field: r.field as AgentCheck["field"],
    status: r.status,
    spoken: r.spoken,
    paper: r.paper,
    transcript,
    reason: r.reason,
    flag: agentFlag(r.field, r.status, r.spoken, r.paper, r.reason), // Hindi; other packs build their own from these fields
  }));
}
