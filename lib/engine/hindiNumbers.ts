// Hindi number words: lookup tables for parsing (Devanagari + romanised Hinglish)
// and builders that turn numbers into spoken Hindi for Timbre TTS
// (CLAUDE.md: write numbers as words, e.g. "पंद्रह सौ रुपये", not "₹1,500").

import { devanagariDigitsToAscii, normWord } from "./tokens";

/** Standard Hindi words for 0–99 (used for speech output). */
export const HINDI_0_99: readonly string[] = [
  "शून्य", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ",
  "दस", "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस",
  "बीस", "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस",
  "तीस", "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस",
  "चालीस", "इकतालीस", "बयालीस", "तैंतालीस", "चवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास",
  "पचास", "इक्यावन", "बावन", "तिरपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ",
  "साठ", "इकसठ", "बासठ", "तिरसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर",
  "सत्तर", "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी",
  "अस्सी", "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी",
  "नब्बे", "इक्यानबे", "बानबे", "तिरानबे", "चौरानबे", "पचानबे", "छियानबे", "सत्तानबे", "अट्ठानबे", "निन्यानबे",
];

/** Extra Devanagari spellings accepted when parsing. */
const DEVANAGARI_VARIANTS: Record<number, string[]> = {
  6: ["छः", "छे", "छै"],
  15: ["पन्द्रह"],
  17: ["सत्तरह"],
  28: ["अठाईस"],
  66: ["छाछठ"],
  79: ["उनासी", "उन्नासी"],
};

/** Romanised (Hinglish) spellings for 0–99, "|" separates variants. */
const ROMAN_0_99: readonly string[] = [
  "zero|shunya|shoonya", "ek|aek", "do|doh", "teen|tin", "char|chaar", "paanch|panch|paach", "chhe|chhah|chah|che|chhai|chhey|chheh", "saat|sat", "aath|ath", "nau|nao",
  "das|dus", "gyarah|gyara|gyaarah", "barah|baarah|bara|baara", "terah|tera", "chaudah|chauda|chaudha", "pandrah|pandra|pandhra", "solah|sola", "satrah|satra|sattrah", "atharah|athara|athaarah", "unnees|unnis|unees",
  "bees|bis", "ikkees|ikkis", "baees|bais|baais", "teis|teyis|teees", "chaubees|chaubis", "pachchees|pachees|pachis|pachchis", "chhabbees|chhabbis", "sattaees|sattais", "atthaees|atthais|athais", "untees|untis",
  "tees|tis", "iktees|iktis", "battees|battis", "taintees|taintis|tetis", "chauntees|chauntis|chautis", "paintees|paintis|pentis", "chhattees|chhattis", "saintees|saintis", "adtees|artees|adtis|artis", "untalees|untalis|unchalis",
  "chalees|chalis|chaalis", "iktalees|iktalis", "bayalees|bayalis|biyalis", "taintalees|taintalis|tetalis", "chavalees|chavalis|chawalis|chauvalis", "paintalees|paintalis|pentalis", "chhiyalees|chhiyalis", "saintalees|saintalis", "adtalees|adtalis|artalis", "unchaas|unchas",
  "pachaas|pachas", "ikyavan|ikyawan|ekyavan", "baavan|bavan|bawan", "tirpan", "chauvan|chauwan", "pachpan", "chhappan", "sattavan|sattawan", "atthavan|atthawan", "unsath|unsaath",
  "saath|sath", "iksath|iksaath", "baasath|basath", "tirsath|tiresath", "chaunsath|chausath", "painsath|pensath", "chhiyasath|chhiyaasath|chiyasath|chhachhath", "sadsath|sarsath", "adsath|arsath", "unhattar",
  "sattar", "ikhattar|ikahattar", "bahattar", "tihattar", "chauhattar", "pachhattar|pachattar", "chhihattar|chhiyattar", "sathattar|satattar", "athhattar|athattar", "unasi|unyasi|unnasi",
  "assi|assee", "ikyasi", "bayasi|biyasi", "tirasi", "chaurasi", "pachasi", "chhiyasi", "sattasi", "atthasi", "navasi|nawasi",
  "nabbe|nabbey", "ikyanve|ikyaanve", "baanve|banve", "tiranve", "chauranve", "pachanve|pachaanve", "chhiyanve|chhiyaanve", "sattanve", "atthanve|atthaanve", "ninyanve|ninyaanve|ninnyanve",
];

function buildMap(entries: [string, number][]): Map<string, number> {
  const m = new Map<string, number>();
  for (const [word, value] of entries) {
    const key = normWord(word);
    const prev = m.get(key);
    if (prev !== undefined && prev !== value) {
      throw new Error(`Number word "${word}" maps to both ${prev} and ${value}`);
    }
    m.set(key, value);
  }
  return m;
}

function numberWordEntries(): [string, number][] {
  const e: [string, number][] = [];
  HINDI_0_99.forEach((w, n) => {
    e.push([w, n]);
    if (w.endsWith("नबे")) e.push([w.slice(0, -3) + "नवे", n]); // इक्यानवे, निन्यानवे ...
  });
  for (const [n, list] of Object.entries(DEVANAGARI_VARIANTS)) for (const w of list) e.push([w, Number(n)]);
  ROMAN_0_99.forEach((variants, n) => variants.split("|").forEach((w) => e.push([w, n])));
  return e;
}

/** normalised word -> 0..99 */
export const NUMBER_WORDS: ReadonlyMap<string, number> = buildMap(numberWordEntries());

/** normalised word -> multiplier */
export const MULTIPLIERS: ReadonlyMap<string, number> = buildMap([
  ["सौ", 100], ["sau", 100], ["hundred", 100],
  ["हज़ार", 1000], ["hazaar", 1000], ["hazar", 1000], ["hajar", 1000], ["hajaar", 1000], ["hazzar", 1000], ["thousand", 1000],
  ["लाख", 100000], ["lakh", 100000], ["lakhs", 100000], ["lac", 100000], ["laakh", 100000],
  ["करोड़", 10000000], ["crore", 10000000], ["crores", 10000000], ["karod", 10000000], ["karor", 10000000],
]);

/** Stand-alone fractions: डेढ़ = 1.5, ढाई = 2.5 */
export const FRACTIONS: ReadonlyMap<string, number> = buildMap([
  ["डेढ़", 1.5], ["dedh", 1.5], ["derh", 1.5], ["dedha", 1.5],
  ["ढाई", 2.5], ["dhai", 2.5], ["dhaai", 2.5], ["dhaee", 2.5], ["dhayi", 2.5],
]);

/** Modifiers applied to the next number: साढ़े तीन = 3.5, सवा दो = 2.25, पौने दो = 1.75 */
export const MODIFIERS: ReadonlyMap<string, number> = buildMap([
  ["साढ़े", 0.5], ["saadhe", 0.5], ["sadhe", 0.5], ["saade", 0.5], ["sade", 0.5], ["saarhe", 0.5],
  ["सवा", 0.25], ["sawa", 0.25], ["sava", 0.25],
  ["पौने", -0.25], ["paune", -0.25], ["pone", -0.25],
]);

// ---------------------------------------------------------------- speech builders

const SCALES: [number, string][] = [
  [10000000, "करोड़"],
  [100000, "लाख"],
  [1000, "हज़ार"],
  [100, "सौ"],
];

/** Non-negative integer -> Hindi words, Indian system. 1500 -> "पंद्रह सौ", 2666 -> "दो हज़ार छह सौ छियासठ". */
export function numberToHindiWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`numberToHindiWords needs a non-negative integer, got ${n}`);
  if (n < 100) return HINDI_0_99[n];
  // 1100–1999 is spoken as "X सौ": ग्यारह सौ, पंद्रह सौ, उन्नीस सौ निन्यानबे.
  if (n >= 1100 && n < 2000) {
    const rest = n % 100;
    const head = `${HINDI_0_99[Math.floor(n / 100)]} सौ`;
    return rest ? `${head} ${HINDI_0_99[rest]}` : head;
  }
  const parts: string[] = [];
  let rest = n;
  for (const [size, word] of SCALES) {
    if (rest >= size) {
      const q = Math.floor(rest / size);
      parts.push(`${numberToHindiWords(q)} ${word}`);
      rest %= size;
    }
  }
  if (rest > 0) parts.push(HINDI_0_99[rest]);
  return parts.join(" ");
}

/** Any non-negative number; decimals as "दशमलव" + digits (12.5 -> "बारह दशमलव पाँच"). */
export function decimalToHindiWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`Invalid number ${n}`);
  if (Number.isInteger(n)) return numberToHindiWords(n);
  const [int, frac] = String(n).split(".");
  return `${numberToHindiWords(Number(int))} दशमलव ${[...frac].map((d) => HINDI_0_99[Number(d)]).join(" ")}`;
}

function toNumber(input: number | string): number {
  if (typeof input === "number") return input;
  const cleaned = devanagariDigitsToAscii(input).replace(/\/-\s*$/, "").replace(/[^0-9.]/g, "").replace(/^\.+|\.+$/g, "");
  if (!cleaned) throw new RangeError(`No number in "${input}"`);
  return Number(cleaned);
}

/** "₹1,500" / 1500 -> "पंद्रह सौ रुपये"; 1 -> "एक रुपया". Whole rupees only. */
export function rupeesToHindi(input: number | string): string {
  const n = toNumber(input);
  if (!Number.isInteger(n)) throw new RangeError(`Rupee amounts must be whole rupees, got ${n}`);
  return n === 1 ? "एक रुपया" : `${numberToHindiWords(n)} रुपये`;
}

/** 12 -> "बारह प्रतिशत" */
export function percentToHindi(input: number | string): string {
  return `${decimalToHindiWords(toNumber(input))} प्रतिशत`;
}

/** 12 -> "बारह महीने", 1 -> "एक महीना" */
export function monthsToHindi(n: number): string {
  return n === 1 ? "एक महीना" : `${numberToHindiWords(n)} महीने`;
}

/** 52 -> "बावन हफ़्ते", 1 -> "एक हफ़्ता" */
export function weeksToHindi(n: number): string {
  return n === 1 ? "एक हफ़्ता" : `${numberToHindiWords(n)} हफ़्ते`;
}

const NUM = "[0-9\\u0966-\\u096F]+(?:,[0-9\\u0966-\\u096F]+)*(?:\\.[0-9\\u0966-\\u096F]+)?";

/**
 * Rewrites digits in a TTS sentence as spoken Hindi:
 * "EMI ₹2,666" -> "EMI दो हज़ार छह सौ छियासठ रुपये", "12%" -> "बारह प्रतिशत", "1500 रुपये" -> "पंद्रह सौ रुपये".
 */
export function toSpeakableText(text: string): string {
  return text
    .replace(new RegExp(`(?:₹|\\bRs\\.?|\\bINR)\\s*(${NUM})(?:\\s*\\/-)?`, "gi"), (_m, n: string) => rupeesToHindi(n))
    .replace(new RegExp(`(${NUM})\\s*(?:रुपये|रुपए|रुपया|रूपये|rupees|rupaye|rupee)(?![\\p{L}\\p{M}])`, "giu"), (_m, n: string) =>
      rupeesToHindi(n),
    )
    .replace(new RegExp(`(${NUM})\\s*%`, "g"), (_m, n: string) => percentToHindi(n))
    .replace(new RegExp(NUM, "g"), (n) => decimalToHindiWords(toNumber(n)));
}
