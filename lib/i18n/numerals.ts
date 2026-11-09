// Amounts in each language's own digits (Intl.NumberFormat numbering systems). Display only: the engine always
// works on ASCII digits (see nativeDigitsToAscii), and spoken amounts for Timbre are always words.
import type { LangCode } from "./types";

export const NUMBERING_SYSTEM: Record<LangCode, string> = {
  hi: "deva",
  mr: "deva",
  bn: "beng",
  gu: "gujr",
  kn: "knda",
  ml: "mlym",
  pa: "guru",
  ta: "tamldec",
  te: "telu",
  en: "latn",
};

const cache = new Map<LangCode, Intl.NumberFormat>();

function formatter(code: LangCode): Intl.NumberFormat {
  let f = cache.get(code);
  if (!f) {
    // "-IN" locales group digits the Indian way (1,50,000); the -u-nu- extension picks the digit script.
    f = new Intl.NumberFormat(`${code}-IN-u-nu-${NUMBERING_SYSTEM[code]}`, { maximumFractionDigits: 2 });
    cache.set(code, f);
  }
  return f;
}

/** 28500 -> "२८,५००" (hi, mr), "28,500" (en), "২৮,৫০০" (bn) ... */
export function nativeNumber(n: number, code: LangCode): string {
  return formatter(code).format(n);
}

/** 28500 -> "₹२८,५००" */
export function nativeINR(n: number, code: LangCode): string {
  return `₹${nativeNumber(n, code)}`;
}
