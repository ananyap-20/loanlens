// scripts/eval: pure judging/tally logic, and one end-to-end run against a local STUB server (no Gnani calls).
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { formatTable, judge, tally, validateExpected, type ClipSpec } from "../scripts/eval/core";
import { SAMPLE_PAPER } from "./fixtures/paper";

const PRISMA = "आपको 30,000 का loan मिलेगा। EMI 2666 और processing fee नहीं लगेगी।";
const fee: ClipSpec = { file: "a.wav", speaker: "agent", field: "processing_fee", tag: "fee_conflict", expect: { status: "conflict", amount: 0 } };

describe("validateExpected", () => {
  it("accepts the example file", () => {
    const raw = JSON.parse(readFileSync(path.join(__dirname, "..", "eval", "expected.example.json"), "utf8"));
    expect(validateExpected(raw).ok).toBe(true);
  });
  it("reports every problem instead of guessing", () => {
    const r = validateExpected({
      clips: [
        { file: "x.webm", speaker: "agent", field: "processing_fee", expect: { status: "conflict" } },
        { file: "y.wav", speaker: "agent", field: "net_disbursed", expect: { status: "maybe" } },
        { file: "y.wav", speaker: "borrower", field: "processing_fee", expect: { outcome: "pass" } },
        { file: "z.wav", speaker: "lender", field: "x", expect: {} },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.problems.join("\n")).toMatch(/wav\/mp3/);
      expect(r.problems.join("\n")).toMatch(/agent field must be one of/);
      expect(r.problems.join("\n")).toMatch(/expect.status must be one of/);
      expect(r.problems.join("\n")).toMatch(/listed twice/);
      expect(r.problems.join("\n")).toMatch(/"speaker" must be/);
    }
    expect(validateExpected({}).ok).toBe(false);
  });
});

describe("judge (same engine as the app)", () => {
  it("fee conflict from the real Prisma playground transcript", () => {
    const j = judge(fee, PRISMA, SAMPLE_PAPER);
    expect(j.pass).toBe(true);
    expect(j.extracted).toBe("conflict · 0 (negated)");
  });
  it("a missed conflict is a miss, with the reason shown", () => {
    const j = judge(fee, "processing fee 5 rupaye", SAMPLE_PAPER);
    expect(j.pass).toBe(false);
    expect(j.extracted).toBe("unable_to_verify · 5 (implausible)");
  });
  it("amount must match when given", () => {
    const emi: ClipSpec = { file: "b.wav", speaker: "agent", field: "installment", expect: { status: "match", amount: 2666 } };
    expect(judge(emi, "EMI 2666 har mahine", SAMPLE_PAPER).pass).toBe(true);
  });
  it("empty transcript is judged, not skipped", () => {
    expect(judge(fee, "", SAMPLE_PAPER).extracted).toBe("not_mentioned · —");
  });
  it("teach-back clips use the gate", () => {
    const tb: ClipSpec = { file: "c.wav", speaker: "borrower", field: "processing_fee", expect: { outcome: "pass" } };
    expect(judge(tb, "processing fee pandrah sau", SAMPLE_PAPER).pass).toBe(true);
    expect(judge(tb, "processing fee 1000", SAMPLE_PAPER).extracted).toBe("wrong");
  });
});

describe("tally + table", () => {
  it("counts per tag, e.g. 'fee_conflict: 1/2'", () => {
    const rows = [judge(fee, PRISMA, SAMPLE_PAPER), judge({ ...fee, file: "b.wav" }, "processing fee 1500", SAMPLE_PAPER)];
    const t = tally(rows);
    expect(t.byTag).toEqual([{ tag: "fee_conflict", passed: 1, total: 2 }]);
    const table = formatTable(rows, [{ file: "c.wav", error: "RATE_LIMITED (HTTP 429)" }]);
    expect(table).toContain("| clip");
    expect(table).toContain("fee_conflict: 1/2");
    expect(table).toContain("ERROR RATE_LIMITED (HTTP 429)");
    expect(table).toContain("all clips judged: 1/2 (+ 1 clip(s) not transcribed)");
  });
});

describe("end-to-end against a stub /api/transcribe (no Gnani, no credits)", () => {
  // The stub returns the clip's own bytes as the transcript, so each "clip" file simply contains its text.
  let server: Server;
  let base = "";
  const seen: string[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let first429 = true;

  beforeAll(async () => {
    server = createServer(async (req, res) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const body = Buffer.concat(chunks).toString("utf8");
      const name = /filename="([^"]+)"/.exec(body)?.[1] ?? "";
      const text = body.split("\r\n\r\n")[1]?.split("\r\n--")[0] ?? "";
      seen.push(name);
      await new Promise((r) => setTimeout(r, 20));
      inFlight--;
      if (text.includes("RATE") && first429) {
        first429 = false;
        res.writeHead(429, { "Content-Type": "application/json" }).end(JSON.stringify({ success: false, error: { type: "RATE_LIMITED", message: "busy" } }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ success: true, transcript: text.replace("RATE ", "") }));
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("runs all clips sequentially, retries a 429, prints the table and caches transcripts", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "arth-eval-"));
    mkdirSync(path.join(dir, "eval", "clips"), { recursive: true });
    const clips: [string, string][] = [
      ["fee1.wav", PRISMA],
      ["fee2.wav", "RATE processing fee nahi hai"],
      ["fee3.wav", "processing fee 1500 rupaye"],
      ["emi1.mp3", "EMI 2666 har mahine"],
    ];
    for (const [f, t] of clips) writeFileSync(path.join(dir, "eval", "clips", f), t);
    writeFileSync(
      path.join(dir, "eval", "expected.json"),
      JSON.stringify({
        paper: path.join(__dirname, "..", "public", "sample", "kfs-sahyog.pdf"),
        clips: [
          { file: "fee1.wav", speaker: "agent", field: "processing_fee", tag: "fee_conflict", expect: { status: "conflict" } },
          { file: "fee2.wav", speaker: "agent", field: "processing_fee", tag: "fee_conflict", expect: { status: "conflict" } },
          { file: "fee3.wav", speaker: "agent", field: "processing_fee", tag: "fee_conflict", expect: { status: "conflict" } },
          { file: "emi1.mp3", speaker: "agent", field: "installment", tag: "emi_match", expect: { status: "match", amount: 2666 } },
        ],
      }),
    );
    const cwd = process.cwd();
    const argv = process.argv;
    const out: string[] = [];
    const log = vi.spyOn(console, "log").mockImplementation((...a) => void out.push(a.join(" ")));
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      process.chdir(dir);
      process.argv = ["node", "run", "--server", base];
      const { main } = await import("../scripts/eval/eval");
      expect(await main()).toBe(0);
      const report = readFileSync(path.join(dir, "eval", "out", "report.md"), "utf8");
      expect(report).toContain("fee_conflict: 2/3");
      expect(report).toContain("emi_match: 1/1");
      expect(maxInFlight).toBe(1); // sequential
      expect(seen).toEqual(["clip.wav", "clip.wav", "clip.wav", "clip.wav", "clip.mp3"]); // one 429 retried
      // second run: everything from the cache, no new calls
      const before = seen.length;
      expect(await main()).toBe(0);
      expect(seen.length).toBe(before);
      expect(out.join("\n")).toContain("Prisma calls this run: 0 (cached: 4)");
    } finally {
      process.chdir(cwd);
      process.argv = argv;
      log.mockRestore();
      write.mockRestore();
    }
  }, 30_000);
});
