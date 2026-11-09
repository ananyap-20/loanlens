"use client";

// Second door: call check on a SYNTHETIC call. Start (unlocks audio) -> paper -> call check.
// Reuses the paper step and the same engine; the in-person flow is not involved.
import Link from "next/link";
import { useState } from "react";
import { unlockAudio } from "@/lib/audio/voice";
import { callStrings } from "@/lib/i18n/call";
import type { PaperInput } from "@/lib/flow/session";
import { LangProvider, useLang } from "../flow/lang";
import { Paper } from "../flow/screens/Paper";
import { SpeechProvider } from "../flow/speech";
import { primary, ReplayButtons } from "../flow/ui";
import { CallCheck } from "./CallCheck";

function CallDoor() {
  const { pack } = useLang();
  const c = callStrings(pack.code);
  const [step, setStep] = useState<"start" | "paper" | "call">("start");
  const [paper, setPaper] = useState<PaperInput | null>(null);

  if (step === "start") {
    return (
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 bg-white p-6 text-center text-gray-900">
        <ReplayButtons text={c.say.instruction} className="absolute right-3 top-3" />
        <h1 className="text-4xl font-extrabold">{c.ui.title}</h1>
        <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-3 text-lg font-bold text-amber-900">{c.ui.syntheticOnly}</p>
        <button
          className={`${primary} min-h-24 text-3xl`}
          onClick={() => {
            unlockAudio();
            setStep("paper");
          }}
        >
          {c.ui.start}
        </button>
        <Link href="/" className="text-lg text-blue-700 underline">
          {c.ui.back}
        </Link>
      </main>
    );
  }
  if (step === "paper" || !paper) {
    return (
      <Paper
        dots={{ total: 2, current: 0 }}
        shared={null}
        onPaper={(p) => {
          setPaper(p);
          setStep("call");
        }}
      />
    );
  }
  return <CallCheck paper={paper} onBack={() => setStep("paper")} />;
}

export default function CallPage() {
  return (
    <LangProvider>
      <SpeechProvider>
        <CallDoor />
      </SpeechProvider>
    </LangProvider>
  );
}
