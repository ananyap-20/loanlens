// Generates the fixed spoken prompts as mp3 files in public/audio, once, with REAL Gnani Timbre v2.5 through the
// app's own /api/speak route (the API key stays on the server). A file that already exists is skipped, so re-running
// costs nothing; changing a sentence generates just that sentence again.
//   npm run dev        (in another terminal)
//   node scripts/make-static-audio.mjs http://localhost:3000
import { createJiti } from "jiti";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": root } });
const { PACKS } = await jiti.import("../lib/i18n/index.ts");
const { staticPrompts, staticVoices } = await jiti.import("../lib/i18n/staticPrompts.ts");
const { staticFile } = await jiti.import("../lib/audio/staticAudio.ts");

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const dir = path.join(root, "public", "audio");
mkdirSync(dir, { recursive: true });

const wanted = new Map(); // file -> { text, voice, language }
for (const code of ["hi", "en", "mr"]) {
  const pack = PACKS[code];
  for (const v of staticVoices(pack)) {
    for (const p of staticPrompts(pack)) wanted.set(staticFile(v.key, p.text), { text: p.text, voice: v.voice, language: v.language, label: `${v.key} ${p.id}` });
  }
}

let calls = 0;
for (const [file, w] of wanted) {
  const out = path.join(dir, file);
  if (existsSync(out)) continue;
  let res;
  for (let attempt = 0; attempt < 5; attempt++) {
    res = await fetch(`${base}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: w.text, voice: w.voice, model: "timbre-v2.5", language: w.language }),
    });
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("audio")) {
    console.error(`FAILED ${w.label}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(out, buf);
  calls++;
  console.log(`${w.label}: ${buf.length} bytes`);
}

// Drop clips whose sentence has since changed, then write the manifest the player reads.
for (const f of readdirSync(dir)) if (f.endsWith(".mp3") && !wanted.has(f)) unlinkSync(path.join(dir, f));
writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ files: [...wanted.keys()].sort() }, null, 1) + "\n");
console.log(`done: ${wanted.size} clips in public/audio (${calls} Timbre calls this run)`);
