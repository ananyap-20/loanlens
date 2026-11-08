"use client";

// The in-person flow. This component only moves between screens and keeps the session in memory;
// every decision comes from lib/engine, lib/paper and lib/flow.
import { useEffect, useRef, useState } from "react";
import type { AgentCheck as Check } from "@/lib/flow/agent";
import type { GateState } from "@/lib/engine/gate";
import type { PaperInput, Presence, Recording, Speaker } from "@/lib/flow/session";
import { SpeechProvider } from "./speech";
import { AgentCheck } from "./screens/AgentCheck";
import { Consent } from "./screens/Consent";
import { Explain } from "./screens/Explain";
import { Paper } from "./screens/Paper";
import { Result } from "./screens/Result";
import { TeachBack } from "./screens/TeachBack";
import { Welcome } from "./screens/Welcome";
import { Who } from "./screens/Who";
import type { ClipResult } from "./useClipRecorder";

type Step = "welcome" | "who" | "paper" | "explain" | "consent" | "agent" | "teachback" | "result";

function stepsFor(presence: Presence | null): Step[] {
  return presence === "with_agent"
    ? ["who", "paper", "explain", "consent", "agent", "teachback", "result"]
    : ["who", "paper", "explain", "teachback", "result"];
}

export default function Flow() {
  const [step, setStep] = useState<Step>("welcome");
  const [presence, setPresence] = useState<Presence | null>(null);
  const [paper, setPaper] = useState<PaperInput | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [gate, setGate] = useState<GateState | null>(null);
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
  const afterExplain: Step = presence === "with_agent" ? "consent" : "teachback";

  // Start again: drop everything kept in memory for this check.
  function restart() {
    setPresence(null);
    setPaper(null);
    setShared(null);
    setRecordings([]);
    setChecks([]);
    setGate(null);
    setStep("who");
  }

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
          onDone={() => setStep("teachback")}
        />
      )}
      {step === "teachback" && paper && (
        <TeachBack
          dots={dots}
          paper={paper}
          onClip={(r, field) => keep(r, "borrower", "teachback", field)}
          onDone={(g) => {
            setGate(g);
            setStep("result");
          }}
        />
      )}
      {step === "result" && paper && gate && <Result dots={dots} paper={paper} gate={gate} checks={checks} onRestart={restart} />}
    </SpeechProvider>
  );
}
