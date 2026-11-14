// Splash tap order (audio unlocked BEFORE any speech), the new spoken lines, and the labelled replay/slow buttons.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const order: string[] = [];
vi.mock("@/lib/audio/voice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audio/voice")>()),
  unlockAudio: vi.fn(() => order.push("unlock")),
}));

const { splashTap } = await import("@/app/flow/screens/Splash");
const { ReplayButtons } = await import("@/app/flow/ui");
const { LangProvider } = await import("@/app/flow/lang");
const { SpeechProvider } = await import("@/app/flow/speech");
const { PACKS } = await import("@/lib/i18n");

describe("splash tap", () => {
  beforeEach(() => {
    order.length = 0;
  });

  it("unlocks audio first, then starts the spoken welcome, then navigates without waiting for the speech", () => {
    let finish!: (ok: boolean) => void;
    const speech = new Promise<boolean>((r) => (finish = r));
    const say = vi.fn((text: string) => {
      order.push(`say:${text}`);
      return speech;
    });
    const onStart = vi.fn((p: Promise<boolean>) => {
      order.push("navigate");
      expect(p).toBe(speech); // the next screen gets the promise to wait on
    });
    splashTap(say, PACKS.hi.say!.splash, onStart);
    expect(order).toEqual(["unlock", `say:${PACKS.hi.say!.splash}`, "navigate"]); // navigated while speech still pending
    finish(true);
  });
});

describe("new spoken lines", () => {
  const cps = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16));
  it("are exactly the approved Hindi / Marathi / English texts, written for Timbre (अर्थ, no digits)", () => {
    expect(cps(PACKS.hi.say!.splash)).toEqual(cps("अर्थ में आपका स्वागत है।"));
    expect(cps(PACKS.hi.say!.chooseLang)).toEqual(cps("अपनी भाषा चुनिए। अपनी भाषा के बटन को दबाइए।"));
    expect(cps(PACKS.mr.say!.splash)).toEqual(cps("अर्थ मध्ये आपले स्वागत आहे."));
    expect(cps(PACKS.mr.say!.chooseLang)).toEqual(cps("आपली भाषा निवडा. आपल्या भाषेचे बटण दाबा."));
    expect(PACKS.en.say!.splash).toBe("Welcome to Arth.");
    expect(PACKS.en.say!.chooseLang).toBe("Choose your language. Press the button for your language.");
    for (const code of ["hi", "mr"] as const) expect(PACKS[code].say!.splash).not.toMatch(/Arth/);
  });
  it("are not added to the Beta stub packs", () => {
    for (const code of ["bn", "gu", "kn", "ml", "pa", "ta", "te"] as const) expect(PACKS[code].say).toBeNull();
  });
});

describe("replay / slow buttons", () => {
  it("show the pack's own 'say again' and 'say slowly' words under the icons", () => {
    const html = renderToStaticMarkup(
      createElement(LangProvider, null, createElement(SpeechProvider, null, createElement(ReplayButtons, { text: "x" }))),
    );
    const ui = PACKS.hi.ui!;
    expect(html).toContain(`>${ui.replay}</span>`);
    expect(html).toContain(`>${ui.slow}</span>`);
    expect(html).toContain(`aria-label="${ui.replay}"`);
    expect(html).toContain("🔁");
    expect(html).toContain("🐢");
    expect(html.match(/min-h-16 min-w-\[88px\]/g)).toHaveLength(2); // ≥64px tall, ≥88px wide
  });
  it("every selectable pack has both label words", () => {
    for (const code of ["hi", "en", "mr"] as const) {
      expect(PACKS[code].ui!.replay.length).toBeGreaterThan(0);
      expect(PACKS[code].ui!.slow.length).toBeGreaterThan(0);
    }
  });
});
