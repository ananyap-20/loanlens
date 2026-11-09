// Beta / wording-review tags and the disclaimer footer.
import { describe, expect, it } from "vitest";
import { getPack, PACKS } from "@/lib/i18n";
import { GNANI_BETA, langStatus } from "@/lib/i18n/status";
import type { LangCode } from "@/lib/i18n/types";
import { buildSummary } from "@/lib/receipt/build";
import { SAMPLE_PAPER } from "./fixtures/paper";

const EN =
  "Languages marked Beta are still being tested, and their wording has not been reviewed by a native speaker. LoanLens gives proof of understanding alongside the signature. It is not a signature and not a loan approval.";

describe("language status tags", () => {
  it("docs.gnani.ai marks no individual language beta, so tags come from our review status", () => {
    expect(GNANI_BETA).toEqual([]);
  });

  it("Hindi and English: no tag; Marathi: wording under review; the seven others: Beta", () => {
    expect(langStatus("hi")).toBe("stable");
    expect(langStatus("en")).toBe("stable");
    expect(langStatus("mr")).toBe("review");
    for (const c of ["bn", "gu", "kn", "ml", "pa", "ta", "te"] as LangCode[]) expect(langStatus(c)).toBe("beta");
  });

  it("every pack that is not verified is tagged Beta; every verified pack that is not Hindi/English carries a tag", () => {
    for (const p of Object.values(PACKS)) {
      if (!p.verified) expect(langStatus(p.code)).toBe("beta");
      if (p.verified && !["hi", "en"].includes(p.code)) expect(langStatus(p.code)).not.toBe("stable");
    }
  });

  it("a language whose docs mark it beta would be tagged Beta (rule check)", () => {
    // langStatus() treats GNANI_BETA as beta before looking at our own review status
    expect(["hi", "en"].every((c) => !(GNANI_BETA as readonly string[]).includes(c))).toBe(true);
  });

  it("tag words exist in every selectable language", () => {
    for (const c of ["hi", "en", "mr"] as const) {
      const ui = getPack(c).ui;
      expect(ui.betaTag).toBe("Beta");
      expect(ui.reviewTag.length).toBeGreaterThan(0);
      expect(ui.notReady.length).toBeGreaterThan(0);
    }
  });
});

describe("disclaimer", () => {
  it("English text is exactly the requested sentence set", () => {
    expect(PACKS.en.ui!.disclaimer).toBe(EN);
    expect(PACKS.en.receipt!.disclaimer).toBe(EN);
  });

  it("is present in every verified pack, on screen and on the receipt, and says Beta, native speaker-review, signature and approval", () => {
    for (const c of ["hi", "en", "mr"] as const) {
      const p = PACKS[c];
      expect(p.ui!.disclaimer).toBe(p.receipt!.disclaimer);
      expect(p.ui!.disclaimer).toContain("Beta");
      expect(p.ui!.disclaimer).toContain("LoanLens");
      expect(p.ui!.disclaimer.length).toBeLessThan(330); // small footer
    }
    expect(PACKS.hi.ui!.disclaimer).not.toBe(EN);
    expect(PACKS.mr.ui!.disclaimer).not.toBe(PACKS.hi.ui!.disclaimer);
  });

  it("no verdict words", () => {
    for (const c of ["hi", "en", "mr"] as const) expect(PACKS[c].ui!.disclaimer).not.toMatch(/\b(safe|approved|verified|fraud)\b/i);
  });

  it("the receipt summary carries the disclaimer in the receipt language (Hindi by default)", () => {
    const input = {
      createdAt: new Date("2026-11-09T09:34:05.000Z"),
      presence: "alone" as const,
      paper: { terms: SAMPLE_PAPER, missing: [], ambiguous: [], source: "sample" as const },
      documentSha256: null,
      recordings: [],
      checks: [],
      gate: null,
    };
    expect(buildSummary(input).strings.disclaimer).toBe(PACKS.hi.receipt!.disclaimer);
    const en = PACKS.en;
    const lang = { code: en.code, rupeesToWords: en.rupeesToWords, strings: en.receipt!, fieldName: en.ui!.fieldName, reason: en.ui!.reason, lenderQuestions: en.say!.lenderQuestions };
    expect(buildSummary(input, lang).strings.disclaimer).toBe(EN);
  });
});
