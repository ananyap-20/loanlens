// The Welcome screen keeps its familiar layout (logo block, language chips, two voice buttons, Start, footer note),
// tidied: the real logo instead of a typed name, no repeated lines, icon-only replay buttons, readable footer.
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

  it("lists all ten languages as chips; only Hindi, English and Marathi can be selected", () => {
    const chips = html.match(/<button[^>]*lang="(\w+)"[^>]*>/g) ?? [];
    expect(chips).toHaveLength(10);
    const enabled = chips.filter((c) => !c.includes('disabled=""')).map((c) => c.match(/lang="(\w+)"/)![1]);
    expect(enabled).toEqual(["hi", "en", "mr"]);
    expect(html).toMatch(/aria-pressed="true"[^>]*lang="hi"|lang="hi"[^>]*aria-pressed="true"/);
  });

  it("keeps the tagline, two voice buttons, Start and the footer note", () => {
    expect(html).toContain("know what it means before you sign");
    expect(html).toContain(ui.female);
    expect(html).toContain(ui.male);
    expect(html).toContain(`>${ui.start}<`);
    expect(html).toContain(ui.disclaimer);
  });

  it("uses icon-only replay buttons and drops the repeated lines", () => {
    expect(html).not.toContain(`>${ui.replay}</span>`);
    expect(html).not.toContain("Sanskrit");
    expect(html).not.toContain("अर्थम्");
    expect(html).not.toContain("Proof of understanding, alongside");
  });
});
