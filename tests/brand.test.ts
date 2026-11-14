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

  it("the Welcome script row has the exact code points (no look-alike characters)", () => {
    const welcome = readFileSync(path.join(ROOT, "app/flow/screens/Welcome.tsx"), "utf8");
    const row = welcome.split("\n").find((l) => l.includes('lang="gu"'))!;
    const words = Object.fromEntries([...row.matchAll(/<span lang="(\w+)">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]]));
    const cps = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")).join(" ");
    expect(Object.keys(words)).toEqual(["hi", "sa", "bn", "gu"]);
    expect(cps(words.hi)).toBe("0905 0930 094D 0925"); // अर्थ
    expect(cps(words.sa)).toBe("0905 0930 094D 0925 092E 094D"); // अर्थम्
    expect(cps(words.bn)).toBe("0985 09B0 09CD 09A5"); // অর্থ
    expect(cps(words.gu)).toBe("0A85 0AB0 0ACD 0AA5"); // અર્થ
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

  it("Welcome shows the new wordmark", () => {
    const welcome = readFileSync(path.join(ROOT, "app/flow/screens/Welcome.tsx"), "utf8");
    expect(welcome).toMatch(/<span lang="en"[^>]*>\s*Arth\b/);
    expect(welcome).toContain("अर्थ");
  });
});
