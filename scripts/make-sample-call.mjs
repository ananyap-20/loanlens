// Generates public/sample/call-sahyog.mp3: a SYNTHETIC two-person call made with Gnani Timbre v2.5
// (agent = Deepak, borrower = Nalini) through the app's own /api/speak route. The API key stays on the server.
// Run with the dev server up:  node scripts/make-sample-call.mjs http://localhost:3000
// One Timbre call per turn (8 turns), one at a time. The mp3 clips are joined in order.
import { createJiti } from "jiti";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const { SAMPLE_CALL_TURNS, SAMPLE_CALL_VOICES } = await jiti.import("./sample-call.ts");

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const parts = [];
for (const [i, turn] of SAMPLE_CALL_TURNS.entries()) {
  const res = await fetch(`${base}/api/speak`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: turn.text, voice: SAMPLE_CALL_VOICES[turn.speaker], model: "timbre-v2.5", language: "hi-IN" }),
  });
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("audio")) {
    console.error(`Turn ${i + 1} failed: HTTP ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  parts.push(buf);
  console.log(`turn ${i + 1}/${SAMPLE_CALL_TURNS.length} (${turn.speaker}): ${buf.length} bytes`);
}
const out = path.join(root, "public", "sample", "call-sahyog.mp3");
writeFileSync(out, Buffer.concat(parts));
console.log(`wrote ${path.relative(root, out)} (${Buffer.concat(parts).length} bytes)`);
