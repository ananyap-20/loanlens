"use client";

// Speech state for every screen: say(), replay (🔁), slow replay (🐢), and a visible error if Timbre fails.
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { buzz } from "@/lib/audio/cues";
import { speak, stopSpeaking } from "@/lib/audio/voice";
import { GnaniClientError } from "@/lib/gnani/queue";

type Speech = {
  say: (text: string, slow?: boolean) => Promise<boolean>;
  stop: () => void;
  speaking: boolean;
  error: string;
};

const Ctx = createContext<Speech | null>(null);

export function SpeechProvider({ children }: { children: React.ReactNode }) {
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const seq = useRef(0);

  const say = useCallback(async (text: string, slow = false) => {
    const mine = ++seq.current;
    setError("");
    setSpeaking(true);
    try {
      await speak(text, slow);
      return true;
    } catch (e) {
      if (mine === seq.current) {
        // Timbre itself failed: we cannot speak the error, so show it and buzz.
        setError(e instanceof GnaniClientError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e));
        buzz();
      }
      return false;
    } finally {
      if (mine === seq.current) setSpeaking(false);
    }
  }, []);

  const stop = useCallback(() => {
    seq.current++;
    stopSpeaking();
    setSpeaking(false);
  }, []);

  const value = useMemo(() => ({ say, stop, speaking, error }), [say, stop, speaking, error]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpeech(): Speech {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSpeech outside SpeechProvider");
  return s;
}
