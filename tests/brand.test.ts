// The product's display name is Arth. Fails if the old working name "LoanLens" comes back in app code or text.
// Allowed: the internal storage/cache keys (renaming them would reset saved settings or break an in-flight shared
// file) and the unchanged Vercel URL. Git history, docs/ and the legacy PDF file names are outside app/ and lib/.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.join(__dirname, "..");
const DIRS = ["app", "lib"];
const EXTRA_FILES = ["public/sw.js"];
const ALLOWED = [/loanlens-shared/g, /loanlens\.lang/g, /loanlens-mauve\.vercel\.app/g];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(tsx?|jsx?|mjs|css|json)$/.test(name) ? [p] : [];
  });
}

describe("display name", () => {
  it('no "LoanLens" left in app/ or lib/ (apart from internal keys)', () => {
    const all = [...DIRS.flatMap((d) => files(path.join(ROOT, d))), ...EXTRA_FILES.map((f) => path.join(ROOT, f))];
    expect(all.length).toBeGreaterThan(50);
    const hits: string[] = [];
    for (const f of all) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((line, i) => {
          const rest = ALLOWED.reduce((l, re) => l.replace(re, ""), line);
          if (/loan[\s_-]?lens/i.test(rest)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`);
        });
    }
    expect(hits).toEqual([]);
  });

  it("the logo and the mark are cut from the same artwork, in the brand colours", () => {
    const read = (f: string) => readFileSync(path.join(ROOT, "public", f), "utf8");
    const logo = read("arth-logo.svg");
    const mark = read("arth-mark.svg");
    const navyPaths = (s: string) => [...s.matchAll(/<path fill="#1F2A44"[^>]*\/>/g)].map((m) => m[0]);
    expect(navyPaths(logo)).toHaveLength(3);
    expect(navyPaths(mark)).toEqual(navyPaths(logo)); // identical glyphs
    expect(mark).toContain("#E8890C"); // saffron line and dot
    expect(mark).not.toContain("#0F766E"); // no "ARTH" letters in the mark
    expect(logo).toContain("#0F766E"); // the logo has them
    for (const s of [logo, mark]) {
      expect(s).toMatch(/viewBox="\d+ \d+ \d+ \d+"/);
      expect(s).not.toContain("<rect"); // transparent background, so it sits on any screen colour
    }
  });

  it("the name is only ever the logo artwork: Welcome and Splash use Brand and never type it in a font", () => {
    const read = (f: string) => readFileSync(path.join(ROOT, "app/flow/screens", f), "utf8");
    expect(read("Welcome.tsx")).toContain('<Brand variant="mark"');
    expect(read("Splash.tsx")).toContain('<Brand variant="logo"');
    for (const f of ["Welcome.tsx", "Splash.tsx"]) {
      const src = read(f);
      expect(src).not.toMatch(/>\s*Arth\s*</); // no typed "Arth"
      expect(src).not.toMatch(/>\s*अर्थ\s*</); // no typed "अर्थ"
    }
  });
});
