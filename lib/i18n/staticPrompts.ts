// The FIXED spoken prompts (no amounts, no results) that are pre-generated once with real Timbre and shipped as
// mp3 files, for every selectable language and voice. Everything dynamic still goes through /api/speak.
import { staticKeyFor } from "@/lib/audio/staticAudio";
import type { PaperFacts } from "@/lib/flow/scripts";
import type { LangPack, VoiceGender } from "./types";

export type StaticPrompt = { id: string; text: string };

/**
 * @param sample the terms read from the SAMPLE KFS (public/sample/kfs-sahyog.pdf): adds the paper-explained
 *               narration for those exact values. A real paper with other values (or a QR, whose evidence text
 *               differs) produces different text, which simply does not match and is spoken live.
 */
export function staticPrompts(pack: LangPack, sample?: PaperFacts): StaticPrompt[] {
  const s = pack.say;
  if (!s) return [];
  const asks = (Object.keys(s.agentAsk) as (keyof typeof s.agentAsk)[]).map((f) => ({ id: `agent-ask-${f}`, text: s.agentAsk[f] }));
  return [
    { id: "greeting", text: pack.greeting }, // Welcome
    { id: "who", text: s.who }, // who is present
    { id: "paper", text: s.paper },
    { id: "handover-agent", text: s.handover.agent },
    { id: "handover-borrower", text: s.handover.borrower },
    { id: "consent", text: s.consentSay }, // the agent's consent line
    { id: "consent-done", text: s.consentDone },
    ...asks, // the agent's five check questions
    ...(sample ? [{ id: "explain-sample", text: s.explainPaper(sample) }] : []),
  ].filter((p) => p.text.trim().length > 0);
}

/** The voices to generate for a pack: key, Timbre voice and language. */
export function staticVoices(pack: LangPack): { key: string; gender: VoiceGender; voice: string; language: string }[] {
  return (["female", "male"] as const)
    .filter((g) => !!pack.timbre.voices[g])
    .map((g) => ({ key: staticKeyFor(pack.code, g), gender: g, voice: pack.timbre.voices[g]!, language: pack.timbre.language }));
}
