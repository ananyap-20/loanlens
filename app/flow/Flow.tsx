"use client";

// The in-person flow. This component only moves between screens and keeps the session in memory;
// every decision comes from lib/engine, lib/paper and lib/flow.
import { useEffect, useRef, useState } from "react";
import type { AgentCheck as Check } from "@/lib/flow/agent";
import type { PaperInput, Presence, Recording, Speaker } from "@/lib/flow/session";
import { SpeechProvider } from "./speech";
import { AgentCheck } from "./screens/AgentCheck";
import { Consent } from "./screens/Consent";
import { Explain } from "./screens/Explain";
import { Paper } from "./screens/Paper";
import { Welcome } from "./screens/Welcome";
import { Who } from "./screens/Who";
import { primary } from "./ui";
import type { ClipResult } from "./useClipRecorder";

type Step = "welcome" | "who" | "paper" | "explain" | "consent" | "agent" | "next";

function stepsFor(presence: Presence | null): Step[] {
  return presence === "with_agent" ? ["who", "paper", "explain", "consent", "agent", "next"] : ["who", "paper", "explain", "next"];
}

export default function Flow() {
  const [step, setStep] = useState<Step>("welcome");
  const [presence, setPresence] = useState<Presence | null>(null);
  const [paper, setPaper] = useState<PaperInput | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const nextId = useRef(1);

  // A PDF shared to LoanLens arrives as /?shared=1 (see public/sw.js). Read the flag once, clean the URL.
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("shared");
    if (!flag) return;
    window.history.replaceState(null, "", "/");
    queueMicrotask(() => setShared(flag));
  }, []);

  function keep(r: ClipResult, speaker: Speaker, at: Recording["step"], field?: string) {
    const rec: Recording = {
      id: nextId.current++,
      speaker,
      step: at,
      field,
      transcript: r.transcript,
      blob: r.clip.blob,
      durationSec: r.clip.durationSec,
      at: new Date().toISOString(),
    };
    setRecordings((all) => [...all, rec]);
  }

  const steps = stepsFor(presence);
  const dots = { total: steps.length, current: Math.max(0, steps.indexOf(step)) };
  const consent = [...recordings].reverse().find((r) => r.step === "consent");
  const afterExplain: Step = presence === "with_agent" ? "consent" : "next";

  return (
    <SpeechProvider>
      {step === "welcome" && <Welcome onStart={() => setStep("who")} />}
      {step === "who" && (
        <Who
          dots={dots}
          onPick={(p) => {
            setPresence(p);
            setStep("paper");
          }}
        />
      )}
      {step === "paper" && (
        <Paper
          dots={dots}
          shared={shared}
          onPaper={(p) => {
            setPaper(p);
            setStep("explain");
          }}
        />
      )}
      {step === "explain" && paper && <Explain dots={dots} paper={paper} onNext={() => setStep(afterExplain)} />}
      {step === "consent" && (
        <Consent
          dots={dots}
          consentTranscript={consent?.transcript ?? null}
          onRecorded={(r) => keep(r, "agent", "consent")}
          onNext={() => setStep("agent")}
        />
      )}
      {step === "agent" && paper && (
        <AgentCheck
          dots={dots}
          paper={paper}
          checks={checks}
          onClip={(r, c) => {
            keep(r, "agent", "agent", c.field);
            setChecks((all) => [...all, c]);
          }}
          onDone={() => setStep("next")}
        />
      )}
      {step === "next" && (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
          <p className="text-2xl">🚧 Next slice ({recordings.length} recordings)</p>
          <button className={primary} onClick={() => setStep("welcome")}>
            🔄
          </button>
        </main>
      )}
    </SpeechProvider>
  );
}
