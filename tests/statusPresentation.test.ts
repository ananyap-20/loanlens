import { describe, expect, it } from "vitest";
import { checkAgentClip } from "@/lib/flow/agent";
import { statusPresentation } from "@/lib/flow/statusPresentation";
import type { Status } from "@/lib/engine/types";
import { SAMPLE_PAPER } from "./fixtures/paper";

const ALL: Status[] = ["match", "conflict", "not_mentioned", "unable_to_verify"];

describe("status -> icon, colour, sound", () => {
  it("match is ✅ green + chime", () => {
    expect(statusPresentation("match")).toMatchObject({ icon: "✅", tone: "match", cue: "chime" });
    expect(statusPresentation("match").cls).toContain("green");
  });

  it("conflict is ❌ red + buzz, never green or the chime", () => {
    const p = statusPresentation("conflict");
    expect(p).toMatchObject({ icon: "❌", tone: "conflict", cue: "buzz" });
    expect(p.cls).toContain("red");
    expect(p.cls).not.toContain("green");
    expect(p.icon).not.toBe("✅");
    expect(p.cue).not.toBe("chime");
  });

  it("not mentioned / couldn't check are ❔ grey, no chime", () => {
    for (const s of ["not_mentioned", "unable_to_verify"] as const) {
      const p = statusPresentation(s);
      expect(p).toMatchObject({ icon: "❔", tone: "unknown", cue: "tick" });
      expect(p.cls).not.toContain("green");
    }
  });

  it("only match ever gets ✅, green or the chime", () => {
    for (const s of ALL) {
      const p = statusPresentation(s);
      const looksLikeMatch = p.icon === "✅" || p.cue === "chime" || p.cls.includes("green");
      expect(looksLikeMatch).toBe(s === "match");
    }
  });

  it("every status has an icon and a sound (never colour alone)", () => {
    for (const s of ALL) {
      const p = statusPresentation(s);
      expect(p.icon.length).toBeGreaterThan(0);
      expect(p.cue.length).toBeGreaterThan(0);
    }
  });

  it("the demo fee conflict (agent says no fee, paper says ₹1,500) shows ❌ + buzz", () => {
    const c = checkAgentClip("processing_fee", "processing fee नहीं लगेगी", SAMPLE_PAPER);
    expect(c.status).toBe("conflict");
    expect(statusPresentation(c.status)).toMatchObject({ icon: "❌", cue: "buzz" });
  });
});
