"use client";

// The in-person flow. This component only moves between screens and keeps the session in memory;
// every decision comes from lib/engine, lib/paper and lib/flow.
import { useEffect, useState } from "react";
import type { PaperInput, Presence } from "@/lib/flow/session";
import { SpeechProvider } from "./speech";
import { Explain } from "./screens/Explain";
import { Paper } from "./screens/Paper";
import { Welcome } from "./screens/Welcome";
import { Who } from "./screens/Who";
import { primary } from "./ui";

type Step = "welcome" | "who" | "paper" | "explain" | "next";

function stepsFor(presence: Presence | null): Step[] {
  void presence;
  return ["who", "paper", "explain", "next"];
}

export default function Flow() {
  const [step, setStep] = useState<Step>("welcome");
  const [presence, setPresence] = useState<Presence | null>(null);
  const [paper, setPaper] = useState<PaperInput | null>(null);
  const [shared, setShared] = useState<string | null>(null);

  // A PDF shared to LoanLens arrives as /?shared=1 (see public/sw.js). Read the flag once, clean the URL.
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("shared");
    if (!flag) return;
    window.history.replaceState(null, "", "/");
    queueMicrotask(() => setShared(flag));
  }, []);

  const steps = stepsFor(presence);
  const dots = { total: steps.length, current: Math.max(0, steps.indexOf(step)) };

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
      {step === "explain" && paper && <Explain dots={dots} paper={paper} onNext={() => setStep("next")} />}
      {step === "next" && (
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 p-6">
          <p className="text-2xl">🚧 Next slice</p>
          <button className={primary} onClick={() => setStep("welcome")}>
            🔄
          </button>
        </main>
      )}
    </SpeechProvider>
  );
}
