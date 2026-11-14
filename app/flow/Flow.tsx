"use client";

// The in-person flow. This component only moves between screens and keeps the session in memory;
// every decision comes from lib/engine, lib/paper and lib/flow.
import { useEffect, useRef, useState } from "react";
import type { AgentCheck as Check } from "@/lib/flow/agent";
import type { GateState } from "@/lib/engine/gate";
import type { PaperInput, Presence, Recording, Speaker } from "@/lib/flow/session";
import { speak, stopSpeaking } from "@/lib/audio/voice";
import { gnani } from "@/lib/gnani/queue";
import { LangProvider, useLang } from "./lang";
import { SpeechProvider } from "./speech";
import { Receipt } from "./screens/Receipt";
import { Handover } from "./screens/Handover";
import { AgentCheck } from "./screens/AgentCheck";
import { Consent } from "./screens/Consent";
import { Explain } from "./screens/Explain";
import { Paper } from "./screens/Paper";
import { Result } from "./screens/Result";
import { Splash } from "./screens/Splash";
import { TeachBack } from "./screens/TeachBack";
import { Welcome } from "./screens/Welcome";
import { Who } from "./screens/Who";
import type { ClipResult } from "./useClipRecorder";

type Step = "welcome" | "who" | "paper" | "explain" | "consent" | "agent" | "teachback" | "result" | "receipt";

function stepsFor(presence: Presence | null): Step[] {
  return presence === "with_agent"
    ? ["who", "paper", "explain", "consent", "agent", "teachback", "result", "receipt"]
    : ["who", "paper", "explain", "teachback", "result", "receipt"];
}

export default function Flow() {
  return (
    <LangProvider>
      <FlowSteps />
    </LangProvider>
  );
}

function FlowSteps() {
  const { say: t } = useLang().pack;
  const [step, setStep] = useState<Step>("welcome");
  const [presence, setPresence] = useState<Presence | null>(null);
  const [paper, setPaper] = useState<PaperInput | null>(null);
  const [shared, setShared] = useState<string | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [gate, setGate] = useState<GateState | null>(null);
  const [handedTo, setHandedTo] = useState<"agent" | "borrower" | null>(null); // who has been handed the phone
  const nextId = useRef(1);
  // Splash: once per page load. `splashSpoken` = the spoken welcome started by the splash tap; Welcome waits for it
  // before its own instruction. null = Welcome was not reached from the splash (e.g. after "सब मिटाएँ").
  const [splashDone, setSplashDone] = useState(false);
  const [splashSpoken, setSplashSpoken] = useState<Promise<boolean> | null>(null);

  // A PDF shared to Arth arrives as /?shared=1 (see public/sw.js). Read the flag once, clean the URL.
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

  // "सब मिटाएँ": drop everything this check kept — document bytes, recordings, transcripts, results,
  // cached speech (some prompts contain the loan figures) and any shared file still parked by the service worker.
  function clearAll() {
    stopSpeaking();
    gnani.clearSpeakCache();
    if (typeof caches !== "undefined") void caches.delete("loanlens-shared").catch(() => undefined);
    setPresence(null);
    setPaper(null);
    setShared(null);
    setRecordings([]);
    setChecks([]);
    setGate(null);
    setHandedTo(null);
    setSplashSpoken(null);
    nextId.current = 1;
    setStep("welcome");
    void speak(t.cleared).catch(() => undefined);
  }

  // Before every change of speaker, a full-screen handover. When the borrower is alone, they already hold
  // the phone, so there is nothing to hand over before the teach-back.
  const speakerFor: Partial<Record<Step, "agent" | "borrower">> = {
    consent: "agent",
    agent: "agent",
    teachback: presence === "with_agent" ? "borrower" : undefined,
  };
  const needed = speakerFor[step];
  if (needed && handedTo !== needed) {
    return (
      <SpeechProvider>
        <Handover speaker={needed} next={needed === "agent" ? t.consentSay : t.teachbackIntro} onReady={() => setHandedTo(needed)} />
      </SpeechProvider>
    );
  }

  return (
    <SpeechProvider>
      {step === "welcome" && !splashDone && (
        <Splash
          onStart={(spoken) => {
            setSplashSpoken(spoken);
            setSplashDone(true);
          }}
        />
      )}
      {step === "welcome" && splashDone && <Welcome afterSplash={splashSpoken} onStart={() => setStep("who")} />}
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
      {step === "explain" && paper && (
        <Explain dots={dots} paper={paper} nextSpeaker={presence === "with_agent" ? "agent" : "borrower"} onNext={() => setStep(afterExplain)} />
      )}
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
            keep(r, "agent", "agent", c ? c.field : "navigation");
            if (c) setChecks((all) => [...all, c]); // "next"/"skip" is kept as a recording, not as an answer
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
      {step === "result" && paper && gate && (
        <Result dots={dots} paper={paper} gate={gate} checks={checks} onReceipt={() => setStep("receipt")} onClear={clearAll} />
      )}
      {step === "receipt" && paper && presence && (
        <Receipt
          dots={dots}
          presence={presence}
          paper={paper}
          recordings={recordings}
          checks={checks}
          gate={gate}
          onBack={() => setStep("result")}
          onClear={clearAll}
        />
      )}
    </SpeechProvider>
  );
}
