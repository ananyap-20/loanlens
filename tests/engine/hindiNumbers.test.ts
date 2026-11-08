import { describe, expect, it } from "vitest";
import {
  decimalToHindiWords,
  monthsToHindi,
  numberToHindiWords,
  percentToHindi,
  rupeesToHindi,
  toSpeakableText,
  weeksToHindi,
} from "@/lib/engine/hindiNumbers";
import { parseAmounts } from "@/lib/engine/parseAmounts";

// Independent copy of the standard Hindi words 0–99 (guards against accidental edits of the table).
const WORDS_0_99 = [
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

describe("numberToHindiWords 0–99 (every word)", () => {
  it("has 100 distinct words", () => {
    expect(WORDS_0_99).toHaveLength(100);
    expect(new Set(WORDS_0_99).size).toBe(100);
  });
  for (let n = 0; n <= 99; n++) {
    it(`${n} -> ${WORDS_0_99[n]} and back`, () => {
      expect(numberToHindiWords(n)).toBe(WORDS_0_99[n]);
      expect(parseAmounts(WORDS_0_99[n]).map((a) => a.value)).toEqual([n]);
    });
  }
});

describe("numberToHindiWords larger amounts", () => {
  const cases: [number, string][] = [
    [100, "एक सौ"],
    [101, "एक सौ एक"],
    [200, "दो सौ"],
    [999, "नौ सौ निन्यानबे"],
    [1000, "एक हज़ार"],
    [1050, "एक हज़ार पचास"],
    [1100, "ग्यारह सौ"],
    [1500, "पंद्रह सौ"],
    [1999, "उन्नीस सौ निन्यानबे"],
    [2000, "दो हज़ार"],
    [2500, "दो हज़ार पाँच सौ"],
    [2666, "दो हज़ार छह सौ छियासठ"],
    [10050, "दस हज़ार पचास"],
    [28500, "अट्ठाईस हज़ार पाँच सौ"],
    [30000, "तीस हज़ार"],
    [31992, "इकतीस हज़ार नौ सौ बानबे"],
    [99999, "निन्यानबे हज़ार नौ सौ निन्यानबे"],
    [100000, "एक लाख"],
    [150000, "एक लाख पचास हज़ार"],
    [101500, "एक लाख एक हज़ार पाँच सौ"],
    [1234567, "बारह लाख चौंतीस हज़ार पाँच सौ सड़सठ"],
    [10000000, "एक करोड़"],
    [250000000, "पच्चीस करोड़"],
    [1000000000, "एक सौ करोड़"],
  ];
  for (const [n, words] of cases) {
    it(`${n} -> ${words}`, () => expect(numberToHindiWords(n)).toBe(words));
  }

  it("round-trips through parseAmounts for a sweep up to 99 crore", () => {
    const ns: number[] = [];
    for (let n = 100; n < 3000; n += 7) ns.push(n);
    for (let n = 3000; n < 2_000_000; n += 9973) ns.push(n);
    ns.push(1100, 1101, 1500, 1999, 12_34_56_789, 99_99_99_999);
    for (const n of ns) expect(parseAmounts(numberToHindiWords(n)).map((a) => a.value), `n=${n}`).toEqual([n]);
  });

  it("rejects negatives and fractions", () => {
    expect(() => numberToHindiWords(-1)).toThrow();
    expect(() => numberToHindiWords(1.5)).toThrow();
  });
});

describe("template builders for TTS", () => {
  it("₹1,500 -> पंद्रह सौ रुपये", () => expect(rupeesToHindi("₹1,500")).toBe("पंद्रह सौ रुपये"));
  it("₹2,666 -> दो हज़ार छह सौ छियासठ रुपये", () => expect(rupeesToHindi("₹2,666")).toBe("दो हज़ार छह सौ छियासठ रुपये"));
  it("numbers, Rs. and Devanagari digits", () => {
    expect(rupeesToHindi(30000)).toBe("तीस हज़ार रुपये");
    expect(rupeesToHindi("Rs. 28,500/-")).toBe("अट्ठाईस हज़ार पाँच सौ रुपये");
    expect(rupeesToHindi("₹२००")).toBe("दो सौ रुपये");
    expect(rupeesToHindi(1)).toBe("एक रुपया");
  });
  it("rejects paise and empty input", () => {
    expect(() => rupeesToHindi(2666.5)).toThrow();
    expect(() => rupeesToHindi("no number")).toThrow();
  });
  it("percent, months, weeks, decimals", () => {
    expect(percentToHindi(12)).toBe("बारह प्रतिशत");
    expect(percentToHindi("12.5%")).toBe("बारह दशमलव पाँच प्रतिशत");
    expect(decimalToHindiWords(1.5)).toBe("एक दशमलव पाँच");
    expect(monthsToHindi(12)).toBe("बारह महीने");
    expect(monthsToHindi(1)).toBe("एक महीना");
    expect(weeksToHindi(52)).toBe("बावन हफ़्ते");
  });
  it("toSpeakableText rewrites every number in a sentence", () => {
    expect(toSpeakableText("EMI ₹2,666 per month, fee Rs 1500, rate 12%")).toBe(
      "EMI दो हज़ार छह सौ छियासठ रुपये per month, fee पंद्रह सौ रुपये, rate बारह प्रतिशत",
    );
    expect(toSpeakableText("कागज़ पर 1500 रुपये फीस लिखी है।")).toBe("कागज़ पर पंद्रह सौ रुपये फीस लिखी है।");
    expect(toSpeakableText("12 महीने")).toBe("बारह महीने");
    expect(toSpeakableText("कोई संख्या नहीं")).toBe("कोई संख्या नहीं");
  });
});
