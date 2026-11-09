// Evaluation core (pure, unit-tested): read eval/expected.json, judge one transcript with the SAME engine the
// app uses (checkAgentClip for agent clips, answerGate for teach-back clips), and tally the results.
import { answerGate, createGate, GATE_FIELDS, type AnswerOutcome, type GateFieldId } from "@/lib/engine/gate";
import type { Status, Value } from "@/lib/engine/types";
import { AGENT_FIELDS, checkAgentClip, type AgentField } from "@/lib/flow/agent";

export const STATUSES: Status[] = ["match", "conflict", "not_mentioned", "unable_to_verify"];
export const OUTCOMES: AnswerOutcome[] = ["pass", "wrong", "uncertain", "not_mentioned", "implausible"];

/**
 * One clip in eval/expected.json.
 * - agent clips:     { "file", "speaker": "agent", "field": <agent field>, "expect": { "status", "amount"? } }
 * - teach-back clips: { "file", "speaker": "borrower", "field": <gate field>, "expect": { "outcome" } }
 * "tag" groups clips for the totals (e.g. "fee_conflict"); "note" is free text.
 */
export type ClipSpec = {
  file: string;
  speaker: "agent" | "borrower";
  field: string;
  tag?: string;
  note?: string;
  expect: { status?: Status; amount?: number; outcome?: AnswerOutcome };
};

export type ExpectedFile = {
  paper?: string; // path to a KFS PDF (default: public/sample/kfs-sahyog.pdf)
  clips: ClipSpec[];
};

/** Validates expected.json; returns readable problems instead of guessing. */
export function validateExpected(raw: unknown): { ok: true; value: ExpectedFile } | { ok: false; problems: string[] } {
  const problems: string[] = [];
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as ExpectedFile).clips)) {
    return { ok: false, problems: ['expected.json must be an object with a "clips" array'] };
  }
  const f = raw as ExpectedFile;
  const seen = new Set<string>();
  f.clips.forEach((c, i) => {
    const at = `clips[${i}]${c && typeof c.file === "string" ? ` (${c.file})` : ""}`;
    if (!c || typeof c.file !== "string" || !c.file) return problems.push(`${at}: "file" is required`);
    if (seen.has(c.file)) problems.push(`${at}: listed twice`);
    seen.add(c.file);
    if (!/\.(wav|mp3|ogg|flac|aac|m4a)$/i.test(c.file)) problems.push(`${at}: Prisma needs wav/mp3/ogg/flac/aac/m4a`);
    if (c.speaker === "agent") {
      if (!(AGENT_FIELDS as readonly string[]).includes(c.field)) problems.push(`${at}: agent field must be one of ${AGENT_FIELDS.join(", ")}`);
      if (!c.expect || !STATUSES.includes(c.expect.status as Status)) problems.push(`${at}: expect.status must be one of ${STATUSES.join(", ")}`);
      if (c.expect?.amount !== undefined && typeof c.expect.amount !== "number") problems.push(`${at}: expect.amount must be a number`);
    } else if (c.speaker === "borrower") {
      if (!(GATE_FIELDS as readonly string[]).includes(c.field)) problems.push(`${at}: teach-back field must be one of ${GATE_FIELDS.join(", ")}`);
      if (!c.expect || !OUTCOMES.includes(c.expect.outcome as AnswerOutcome)) problems.push(`${at}: expect.outcome must be one of ${OUTCOMES.join(", ")}`);
    } else problems.push(`${at}: "speaker" must be "agent" or "borrower"`);
  });
  return problems.length ? { ok: false, problems } : { ok: true, value: f };
}

export type Judged = {
  file: string;
  tag: string;
  expected: string;
  extracted: string;
  pass: boolean;
  transcript: string;
};

const amountText = (v?: Value) => (v ? (v.negated && v.amount === 0 ? "0 (negated)" : v.amount === undefined ? "no number" : String(v.amount)) : "—");

/** Judge one transcript with the app's engine. Empty transcript = whatever the engine says (usually not mentioned). */
export function judge(spec: ClipSpec, transcript: string, paper: Value[]): Judged {
  const tag = spec.tag ?? `${spec.speaker}:${spec.field}`;
  if (spec.speaker === "agent") {
    const c = checkAgentClip(spec.field as AgentField, transcript, paper);
    const spoken = c.spoken[0];
    const statusOk = c.status === spec.expect.status;
    const amountOk = spec.expect.amount === undefined || spoken?.amount === spec.expect.amount;
    return {
      file: spec.file,
      tag,
      expected: `${spec.expect.status}${spec.expect.amount !== undefined ? ` · ${spec.expect.amount}` : ""}`,
      extracted: `${c.status} · ${amountText(spoken)}${c.reason ? ` (${c.reason})` : ""}`,
      pass: statusOk && amountOk,
      transcript,
    };
  }
  const { state } = createGate(paper, [spec.field as GateFieldId]);
  const r = answerGate(state, spec.field as GateFieldId, transcript);
  return { file: spec.file, tag, expected: String(spec.expect.outcome), extracted: r.outcome, pass: r.outcome === spec.expect.outcome, transcript };
}

export type Totals = { tag: string; passed: number; total: number }[];

export function tally(rows: Judged[]): { byTag: Totals; passed: number; total: number } {
  const map = new Map<string, { passed: number; total: number }>();
  for (const r of rows) {
    const t = map.get(r.tag) ?? { passed: 0, total: 0 };
    t.total++;
    if (r.pass) t.passed++;
    map.set(r.tag, t);
  }
  const byTag = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([tag, t]) => ({ tag, ...t }));
  return { byTag, passed: rows.filter((r) => r.pass).length, total: rows.length };
}

/** Plain-text table (fixed-width columns) for the terminal and eval/out/report.md. */
export function formatTable(rows: Judged[], errors: { file: string; error: string }[] = []): string {
  const head = ["clip", "expected", "extracted", "status"];
  const body = rows.map((r) => [r.file, r.expected, r.extracted, r.pass ? "✅ ok" : "❌ miss"]);
  const errBody = errors.map((e) => [e.file, "—", `ERROR ${e.error}`, "⚠️ error"]);
  const all = [head, ...body, ...errBody];
  const w = head.map((_, i) => Math.min(48, Math.max(...all.map((r) => [...r[i]].length))));
  const cut = (s: string, n: number) => ([...s].length > n ? [...s].slice(0, n - 1).join("") + "…" : s);
  const line = (r: string[]) => "| " + r.map((c, i) => cut(c, w[i]).padEnd(w[i])).join(" | ") + " |";
  const sep = "|-" + w.map((n) => "-".repeat(n)).join("-|-") + "-|";
  const { byTag, passed, total } = tally(rows);
  const totals = byTag.map((t) => `${t.tag}: ${t.passed}/${t.total}`);
  return [
    line(head),
    sep,
    ...[...body, ...errBody].map(line),
    "",
    "Totals",
    ...totals.map((t) => `- ${t}`),
    `- all clips judged: ${passed}/${total}${errors.length ? ` (+ ${errors.length} clip(s) not transcribed)` : ""}`,
  ].join("\n");
}
