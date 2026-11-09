// Evaluation runner: eval/clips/* + eval/expected.json -> /api/transcribe (one at a time, through the app's
// own Gnani queue with 429 backoff) -> the app's engine -> table + totals in the terminal and eval/out/.
//
//   npm run eval -- --server http://localhost:3000            (spends one Prisma call per NEW clip)
//   npm run eval -- --dry-run                                  (checks files + expected.json, no API calls)
//   npm run eval -- --server ... --fresh                       (ignore cached transcripts)
//
// Transcripts are cached in eval/out/transcripts.json by the clip's SHA-256, so a re-run does not spend credits
// again for unchanged clips. The API key stays on the server; this script only talks to our own /api route.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createGnaniClient, GnaniClientError } from "@/lib/gnani/queue";
import { readPdfTerms } from "@/lib/paper/pdf";
import { formatTable, judge, validateExpected, type Judged } from "./core";

const ROOT = process.cwd();
const EVAL = path.join(ROOT, "eval");
const OUT = path.join(EVAL, "out");
const MIME: Record<string, string> = { wav: "audio/wav", mp3: "audio/mpeg", ogg: "audio/ogg", flac: "audio/flac", aac: "audio/aac", m4a: "audio/mp4" };

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string) => process.argv.includes(name);

export async function main(): Promise<number> {
  const expectedPath = path.join(EVAL, "expected.json");
  if (!existsSync(expectedPath)) {
    console.error(`Missing ${expectedPath}. Copy eval/expected.example.json to eval/expected.json and list your clips.`);
    return 2;
  }
  const checked = validateExpected(JSON.parse(readFileSync(expectedPath, "utf8")));
  if (!checked.ok) {
    console.error("expected.json problems:\n- " + checked.problems.join("\n- "));
    return 2;
  }
  const spec = checked.value;
  const missing = spec.clips.filter((c) => !existsSync(path.join(EVAL, "clips", c.file)));
  if (missing.length) {
    console.error("Missing clips in eval/clips:\n- " + missing.map((c) => c.file).join("\n- "));
    return 2;
  }

  const paperPath = path.resolve(ROOT, spec.paper ?? "public/sample/kfs-sahyog.pdf");
  const paperResult = await readPdfTerms(readFileSync(paperPath));
  if (!paperResult.ok) {
    console.error(`Paper ${paperPath}: ${paperResult.message}`);
    return 2;
  }
  const paper = paperResult.terms;
  console.log(`Paper: ${path.relative(ROOT, paperPath)} (${paper.length} terms). Clips: ${spec.clips.length}.`);

  if (flag("--dry-run")) {
    console.log("Dry run: expected.json and all clips are present and valid. No API calls made.");
    return 0;
  }
  const server = arg("--server");
  if (!server) {
    console.error("Pass --server <url>, e.g. --server http://localhost:3000 (runs Prisma: one call per new clip).");
    return 2;
  }

  mkdirSync(OUT, { recursive: true });
  const cachePath = path.join(OUT, "transcripts.json");
  const cache: Record<string, string> = !flag("--fresh") && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};

  // The app's own queue: one request at a time, exponential backoff on 429, 30 s timeout.
  const base = server.replace(/\/$/, "");
  const gnani = createGnaniClient({ fetchImpl: (url, init) => fetch(base + String(url), init) });

  const rows: Judged[] = [];
  const errors: { file: string; error: string }[] = [];
  let calls = 0;
  for (const c of spec.clips) {
    const bytes = readFileSync(path.join(EVAL, "clips", c.file));
    const key = createHash("sha256").update(bytes).digest("hex");
    let transcript = cache[key];
    if (transcript === undefined) {
      try {
        const ext = c.file.split(".").pop()!.toLowerCase();
        const r = await gnani.transcribe(new Blob([bytes], { type: MIME[ext] ?? "application/octet-stream" }), `clip.${ext}`);
        calls++;
        transcript = r.transcript.trim();
        cache[key] = transcript;
        writeFileSync(cachePath, JSON.stringify(cache, null, 2));
      } catch (e) {
        errors.push({ file: c.file, error: e instanceof GnaniClientError ? `${e.code} (HTTP ${e.status})` : String(e) });
        continue;
      }
    }
    rows.push(judge(c, transcript, paper));
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  const table = formatTable(rows, errors);
  console.log(table);
  console.log(`Prisma calls this run: ${calls} (cached: ${rows.length - calls}).`);
  writeFileSync(path.join(OUT, "report.md"), `# LoanLens eval\n\nServer: ${base}\nRun: ${new Date().toISOString()}\n\n${table}\n`);
  writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ rows, errors }, null, 2));
  return errors.length ? 1 : 0;
}
