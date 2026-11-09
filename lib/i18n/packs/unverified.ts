// Packs that are NOT ready: only the Gnani configuration from docs.gnani.ai (Prisma code, Timbre v2.5 voices).
// No number words, no keywords, no templates: nothing is guessed. verified:false keeps them out of the picker
// until a native speaker writes and signs off the words. normalize() is the identity, so the engine finds no
// numbers in these languages' words and reports "couldn't check", never a made-up value.
import type { LangCode, LangPack } from "../types";

export function stub(code: LangCode, name: string, prisma: string, voices: LangPack["timbre"]["voices"]): LangPack {
  return {
    code,
    name,
    verified: false,
    prisma: { language_code: prisma },
    timbre: { language: prisma, voices },
    greeting: "",
    normalize: (t) => t,
    numberToWords: null,
    rupeesToWords: null,
    lexicon: { numberWords: [], negation: [], consequence: [], navigation: [] },
    say: null,
    ui: null,
    receipt: null,
  };
}

