// Part 1: native numerals (display) and parsing of every digit system; gender-neutral app.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractClaims, parseAmounts } from "@/lib/engine";
import { nativeDigitsToAscii } from "@/lib/engine/tokens";
import { PACKS } from "@/lib/i18n";
import { NUMBERING_SYSTEM, nativeINR, nativeNumber } from "@/lib/i18n/numerals";
import type { LangCode } from "@/lib/i18n/types";
import { buildSummary, HI_RECEIPT_LANG } from "@/lib/receipt/build";
import { SAMPLE_PAPER } from "./fixtures/paper";

// 2,666 and 1,50,000 in each language's digits (what Intl.NumberFormat gives for that numbering system).
const SCRIPTS: [LangCode, string, string, string][] = [
  ["hi", "deva", "२,६६६", "१,५०,०००"],
  ["mr", "deva", "२,६६६", "१,५०,०००"],
  ["bn", "beng", "২,৬৬৬", "১,৫০,০০০"],
  ["gu", "gujr", "૨,૬૬૬", "૧,૫૦,૦૦૦"],
  ["kn", "knda", "೨,೬೬೬", "೧೫೦,೦೦೦"],
  ["ml", "mlym", "൨,൬൬൬", "൧,൫൦,൦൦൦"],
  ["pa", "guru", "੨,੬੬੬", "੧,੫੦,੦੦੦"],
  ["ta", "tamldec", "௨,௬௬௬", "௧,௫௦,௦௦௦"],
  ["te", "telu", "౨,౬౬౬", "౧౫౦,౦౦౦"],
  ["en", "latn", "2,666", "1,50,000"],
];

describe("display digits per language", () => {
  it("numbering systems follow the brief", () => {
    expect(Object.fromEntries(SCRIPTS.map(([c, nu]) => [c, nu]))).toEqual(NUMBERING_SYSTEM);
  });
  it.each(SCRIPTS)("%s (%s) shows 2,666 and 1,50,000 in its own digits", (code, _nu, small, big) => {
    expect(nativeNumber(2666, code)).toBe(small);
    expect(nativeNumber(150000, code)).toBe(big);
    expect(nativeINR(2666, code)).toBe(`₹${small}`);
  });
});

describe("parseAmounts accepts every digit system", () => {
  it.each(SCRIPTS)("%s digits parse to the same number", (code, _nu, small, big) => {
    expect(nativeDigitsToAscii(small)).toBe("2,666");
    expect(parseAmounts(`₹${small}`).map((a) => a.value)).toEqual([2666]);
    expect(parseAmounts(`${big}`).map((a) => a.value)).toEqual([150000]);
    expect(code).toBeTruthy();
  });

  it("round trip: format in a script, parse back, for many amounts", () => {
    for (const [code] of SCRIPTS) {
      for (const n of [0, 5, 66, 200, 1500, 2666, 28500, 30000, 120000, 2500000]) {
        const back = parseAmounts(`₹${nativeNumber(n, code)}`).map((a) => a.value);
        expect(back, `${code} ${n}`).toEqual([n]);
      }
    }
  });

  it("decimals and mixed ASCII/native digits", () => {
    expect(parseAmounts("१२.५ %").map((a) => a.value)).toEqual([12.5]);
    expect(parseAmounts("৩০,০০০ and 1500").map((a) => a.value)).toEqual([30000, 1500]);
  });

  it("claims are extracted from native digits with the engine's usual field words", () => {
    const hi = extractClaims("processing fee १,५०० रुपये", "processing_fee");
    expect(hi.map((v) => [v.field, v.amount])).toEqual([["processing_fee", 1500]]);
    const bn = extractClaims("EMI ২,৬৬৬ every month", "installment");
    expect(bn.map((v) => [v.field, v.amount, v.frequency])).toEqual([["installment", 2666, "monthly"]]);
    const ta = extractClaims("loan ௩௦,௦௦௦ rupees", "loan_amount");
    expect(ta[0].amount).toBe(30000);
  });
});

describe("amount in words, and never an invented number word", () => {
  it("hi, en, mr give rupee words; the seven unreviewed packs give none", () => {
    expect(PACKS.hi.rupeesToWords!(2666)).toBe("दो हज़ार छह सौ छियासठ रुपये");
    expect(PACKS.en.rupeesToWords!(2666)).toBe("two thousand six hundred sixty-six rupees");
    expect(PACKS.en.rupeesToWords!(1)).toBe("one rupee");
    expect(PACKS.mr.rupeesToWords!(2666)).toBe("दोन हजार सहाशे सहासष्ट रुपये");
    for (const c of ["bn", "gu", "kn", "ml", "pa", "ta", "te"] as const) {
      expect(PACKS[c].rupeesToWords).toBeNull();
      expect(PACKS[c].numberToWords).toBeNull();
    }
  });

  const input = {
    createdAt: new Date("2026-11-09T09:34:05.000Z"),
    presence: "alone" as const,
    paper: { terms: SAMPLE_PAPER, missing: [], ambiguous: [], source: "sample" as const },
    documentSha256: null,
    recordings: [],
    checks: [],
    gate: null,
  };
  const installment = (s: ReturnType<typeof buildSummary>) => s.rows.find((r) => r.field === "installment")!.paper;

  it("receipt (Hindi default): Devanagari digits with the words under them", () => {
    const c = installment(buildSummary(input));
    expect(c.hi).toBe("₹२,६६६ हर महीने");
    expect(c.words).toBe("दो हज़ार छह सौ छियासठ रुपये");
    expect(c.en).toBe("₹2,666 per month"); // the small English line stays Latin
  });

  it("receipt in Marathi", () => {
    const lang = { code: PACKS.mr.code, rupeesToWords: PACKS.mr.rupeesToWords, strings: PACKS.mr.receipt!, fieldName: PACKS.mr.ui!.fieldName, reason: PACKS.mr.ui!.reason, lenderQuestions: PACKS.mr.say!.lenderQuestions };
    expect(installment(buildSummary(input, lang)).words).toBe("दोन हजार सहाशे सहासष्ट रुपये");
  });

  it("a language without verified number words shows digits only (no words at all)", () => {
    const lang = { ...HI_RECEIPT_LANG, code: "bn" as const, rupeesToWords: null };
    const c = installment(buildSummary(input, lang));
    expect(c.words).toBeUndefined();
    expect(c.hi).toContain("₹২,৬৬৬");
  });
});

describe("gender-neutral app", () => {
  function files(dir: string, out: string[] = []): string[] {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) files(p, out);
      else if (/\.(ts|tsx)$/.test(f)) out.push(p);
    }
    return out;
  }
  const root = path.join(__dirname, "..");
  const src = [...files(path.join(root, "app")), ...files(path.join(root, "lib"))];

  it("no gendered person emoji anywhere in the app or library code", () => {
    for (const f of src) expect(readFileSync(f, "utf8"), f).not.toMatch(/👩|👨|🧔|👧|👦/u);
  });

  it("no gendered English pronouns for people in UI/receipt text", () => {
    for (const f of src) expect(readFileSync(f, "utf8"), f).not.toMatch(/in her own words|in his own words/);
  });

  it("the person roles are neutral in every verified language", () => {
    expect(PACKS.hi.ui!.role.borrower).toBe("ग्राहक");
    expect(PACKS.mr.ui!.role.borrower).toBe("ग्राहक");
    expect(PACKS.en.ui!.role.borrower).toBe("Borrower");
    for (const p of [PACKS.hi, PACKS.en, PACKS.mr]) {
      expect(p.ui!.female).toMatch(/1$/);
      expect(p.ui!.male).toMatch(/2$/);
      expect(p.ui!.female.startsWith("🔊")).toBe(true);
      expect(p.ui!.replay.length).toBeGreaterThan(0);
      expect(p.ui!.slow.length).toBeGreaterThan(0);
    }
    expect(PACKS.hi.ui!.replay).not.toBe(PACKS.en.ui!.replay);
    expect(PACKS.mr.ui!.replay).not.toBe(PACKS.hi.ui!.replay);
  });

  it("no first-person gendered verb forms in Hindi or Marathi spoken text", () => {
    const gendered = /रही हूँ|रहा हूँ|करूँगी|देता हूँ|देती हूँ|देतो|देते\b|बोलेन|देखती हूँ/u;
    for (const p of [PACKS.hi, PACKS.mr]) {
      const say = p.say!;
      const texts = [
        ...Object.values(say).filter((v): v is string => typeof v === "string"),
        p.greeting,
        p.ui!.consentLine,
        p.ui!.readingPaper,
        say.handover.agent,
        say.handover.borrower,
      ];
      for (const t of texts) expect(t).not.toMatch(gendered);
    }
  });
});
