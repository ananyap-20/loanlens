// The Welcome screen is deliberately sparse: the logo, one heading, the ready languages as big cards, the
// not-ready ones as one quiet non-tappable row, two voice buttons, one Start button, and the disclaimer
// one tap away (not printed on the page).
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LangProvider } from "@/app/flow/lang";
import { SpeechProvider } from "@/app/flow/speech";
import { Welcome } from "@/app/flow/screens/Welcome";
import { PACKS } from "@/lib/i18n";

const html = renderToStaticMarkup(
  createElement(LangProvider, null, createElement(SpeechProvider, null, createElement(Welcome, { afterSplash: null, onStart: () => {} }))),
);
const ui = PACKS.hi.ui!;

describe("Welcome screen", () => {
  it("shows the logo mark, not the name typed in a font", () => {
    expect(html).toContain("/arth-mark.svg");
    expect(html).not.toContain("Arth.");
  });

  it("makes exactly the three ready languages tappable, as large cards, with Hindi selected", () => {
    for (const code of ["hi", "en", "mr"] as const) expect(html).toContain(`lang="${code}"`);
    const cards = html.match(/min-h-16 items-center justify-between/g) ?? [];
    expect(cards).toHaveLength(3);
    expect(html).toMatch(/aria-pressed="true"[^>]*lang="hi"|lang="hi"[^>]*aria-pressed="true"/);
  });

  it("lists the languages still being prepared as plain text, not as buttons, under one Beta label", () => {
    for (const code of ["bn", "gu", "kn", "ml", "pa", "ta", "te"] as const) {
      expect(html).toContain(PACKS[code].name);
      expect(html).not.toMatch(new RegExp(`<button[^>]*lang="${code}"`));
    }
    expect(html.match(new RegExp(`>${ui.betaTag}<`, "g"))).toHaveLength(1);
  });

  it("has two voice buttons, the Start button and the information button, and no replay words", () => {
    expect(html).toContain(ui.female);
    expect(html).toContain(ui.male);
    expect(html).toContain(`>${ui.start}<`);
    expect(html).toContain(`aria-expanded="false"`);
    expect(html).toContain(ui.info);
    expect(html).not.toContain(`>${ui.replay}</span>`); // the replay / slow buttons are icon-only here
  });

  it("keeps the disclaimer behind the information button, closed by default", () => {
    expect(html).not.toContain(ui.disclaimer);
  });

  it("drops the clutter: no tagline, etymology, scripts row or yellow tags", () => {
    expect(html).not.toContain("know what it means");
    expect(html).not.toContain("Sanskrit");
    expect(html).not.toContain("अर्थम्");
    expect(html).not.toContain("bg-amber-200");
  });
});
