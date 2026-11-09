// Engine fix found while building the call check: a number said in words followed by "रुपये"
// was split ("दो हज़ार छह सौ छियासठ रुपये" -> 2600 + 66). A time unit still splits ("तीस हज़ार बारह महीने").
import { describe, expect, it } from "vitest";
import { extractClaims, numberToHindiWords, parseAmounts } from "@/lib/engine";
import { checkAgentClip } from "@/lib/flow/agent";
import { SAMPLE_PAPER } from "../fixtures/paper";

const values = (t: string) => parseAmounts(t).map((a) => a.value);

describe("number words followed by rupees", () => {
  it("stay one number", () => {
    expect(values("दो हज़ार छह सौ छियासठ रुपये")).toEqual([2666]);
    expect(values("अट्ठाईस हज़ार पाँच सौ रुपये")).toEqual([28500]);
    expect(values("do hazaar chhe sau chhiyasath rupaye")).toEqual([2666]);
    for (const n of [66, 150, 1500, 2666, 28500, 30000]) expect(values(`${numberToHindiWords(n)} रुपये`)).toEqual([n]);
  });

  it("a time unit still splits (existing rule)", () => {
    expect(values("तीस हज़ार बारह महीने")).toEqual([30000, 12]);
  });

  it("EMI said fully in words matches the paper", () => {
    expect(checkAgentClip("installment", "किस्त दो हज़ार छह सौ छियासठ रुपये हर महीने", SAMPLE_PAPER).status).toBe("match");
    expect(extractClaims("किस्त दो हज़ार छह सौ छियासठ रुपये", "installment").map((v) => v.amount)).toEqual([2666]);
  });
});
