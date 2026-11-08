import { describe, expect, it } from "vitest";
import { parseAmounts } from "@/lib/engine/parseAmounts";

const values = (t: string) => parseAmounts(t).map((a) => a.value);

describe("parseAmounts: digits", () => {
  it("plain and comma digits", () => {
    expect(values("EMI 2666")).toEqual([2666]);
    expect(values("EMI 2,666 hai")).toEqual([2666]);
    expect(values("loan 1,00,000 ka")).toEqual([100000]);
  });
  it("currency forms", () => {
    expect(parseAmounts("₹1,500")[0]).toMatchObject({ value: 1500, currency: true });
    expect(parseAmounts("Rs 1500")[0]).toMatchObject({ value: 1500, currency: true });
    expect(parseAmounts("Rs. 1,500/-")[0]).toMatchObject({ value: 1500, currency: true, raw: "1,500" });
    expect(parseAmounts("1500 रुपये")[0]).toMatchObject({ value: 1500, currency: true, unitAfter: "INR" });
  });
  it("Devanagari digits", () => {
    expect(values("फीस १,५०० रुपये")).toEqual([1500]);
    expect(values("₹२६६६")).toEqual([2666]);
  });
  it("digits with a multiplier", () => {
    expect(values("30 हज़ार")).toEqual([30000]);
    expect(values("1.5 lakh")).toEqual([150000]);
    expect(values("2 lakh rupaye")).toEqual([200000]);
  });
  it("decimals and percent", () => {
    expect(parseAmounts("12% byaj")[0]).toMatchObject({ value: 12, unitAfter: "percent" });
    expect(parseAmounts("13.5 प्रतिशत")[0]).toMatchObject({ value: 13.5, unitAfter: "percent" });
  });
  it("empty / no numbers", () => {
    expect(values("")).toEqual([]);
    expect(values("   ")).toEqual([]);
    expect(values("koi fee nahi")).toEqual([]);
  });
});

describe("parseAmounts: Hindi words (Devanagari)", () => {
  it("पंद्रह सौ / तीस हज़ार / दो हज़ार छह सौ छियासठ", () => {
    expect(values("प्रोसेसिंग फीस पंद्रह सौ रुपये")).toEqual([1500]);
    expect(values("तीस हज़ार का लोन")).toEqual([30000]);
    expect(values("दो हज़ार छह सौ छियासठ")).toEqual([2666]);
  });
  it("spelling variants (nukta, chandrabindu)", () => {
    expect(values("तीस हजार")).toEqual([30000]);
    expect(values("पांच सौ")).toEqual([500]);
    expect(values("दो हज़ार छः सौ छाछठ")).toEqual([2666]);
  });
  it("डेढ़ / ढाई / साढ़े / सवा / पौने", () => {
    expect(values("डेढ़ हज़ार")).toEqual([1500]);
    expect(values("ढाई हज़ार")).toEqual([2500]);
    expect(values("साढ़े तीन हज़ार")).toEqual([3500]);
    expect(values("सवा दो हज़ार")).toEqual([2250]);
    expect(values("पौने दो हज़ार")).toEqual([1750]);
  });
  it("लाख and करोड़", () => {
    expect(values("एक लाख पचास हज़ार")).toEqual([150000]);
    expect(values("दो करोड़")).toEqual([20000000]);
  });
  it("a number followed by a unit is not glued to the previous phrase", () => {
    expect(parseAmounts("तीस हज़ार बारह महीने").map((a) => [a.value, a.unitAfter])).toEqual([
      [30000, undefined],
      [12, "months"],
    ]);
  });
});

describe("parseAmounts: Hinglish words (romanised)", () => {
  it("pandrah sau", () => expect(values("processing fee pandrah sau hai")).toEqual([1500]));
  it("dedh hazaar", () => expect(values("dedh hazaar")).toEqual([1500]));
  it("dhai hazaar", () => expect(values("dhai hazaar")).toEqual([2500]));
  it("saadhe teen hazaar", () => expect(values("saadhe teen hazaar")).toEqual([3500]));
  it("teen hazaar paanch sau", () => expect(values("teen hazaar paanch sau")).toEqual([3500]));
  it("do hazaar chhe sau chhiyasath", () => expect(values("EMI do hazaar chhe sau chhiyasath")).toEqual([2666]));
  it("tees hazaar", () => expect(values("Aapko tees hazaar ka loan milega")).toEqual([30000]));
  it("hazaar rupaye = 1000", () => expect(values("hazaar rupaye")).toEqual([1000]));
});

describe("parseAmounts: bare words are flagged", () => {
  it("'de do' is a bare 2, not a trusted amount", () => {
    expect(parseAmounts("sign kar do")[0]).toMatchObject({ value: 2, bare: true });
    expect(parseAmounts("do sau")[0]).toMatchObject({ value: 200, bare: false });
    expect(parseAmounts("2666")[0]).toMatchObject({ bare: false });
  });
});
