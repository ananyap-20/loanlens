"use client";

// Record one clip (16 kHz WAV) -> Prisma through the shared queue (in the selected language) -> transcript.
// Handles mic permission denied / no mic / unsupported, empty transcripts and API errors with a spoken message.
import { useEffect, useRef, useState } from "react";
import { WavRecorder, type RecordedClip, type RecorderState } from "@/lib/audio/recorder";
import { gnani, GnaniClientError } from "@/lib/gnani/queue";
import { useLang } from "./lang";
import { useSpeech } from "./speech";

export type ClipPhase = "idle" | "requesting" | "recording" | "sending";
export type ClipResult = { transcript: string; clip: RecordedClip };

export function useClipRecorder(onTranscript: (r: ClipResult) => void) {
  const { say, stop } = useSpeech();
  const { pack, prismaLanguage } = useLang();
  const [phase, setPhase] = useState<ClipPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [problem, setProblem] = useState("");
  const recRef = useRef<WavRecorder | null>(null);
  const cb = useRef(onTranscript);
  const lang = useRef({ t: pack.say, prismaLanguage });
  useEffect(() => {
    cb.current = onTranscript;
    lang.current = { t: pack.say, prismaLanguage };
  });

  useEffect(() => {
    const problemSay = (s: RecorderState): string | undefined => {
      const t = lang.current.t;
      return ({ denied: t.micDenied, no_mic: t.noMic, unsupported: t.micUnsupported, error: t.micError } as Partial<Record<RecorderState, string>>)[s];
    };
    const rec = new WavRecorder({
      onState: (s, message) => {
        if (s === "requesting") setPhase("requesting");
        else if (s === "recording") {
          setElapsed(0);
          setPhase("recording");
        } else if (problemSay(s)) {
          setPhase("idle");
          setProblem(message ?? s);
          void say(message === "Nothing was recorded." ? lang.current.t.emptyTranscript : problemSay(s)!);
        }
      },
      onTick: setElapsed,
      onClip: async (clip) => {
        setPhase("sending");
        try {
          const r = await gnani.transcribe(clip.blob, clip.filename, { language: lang.current.prismaLanguage });
          const transcript = r.transcript.trim();
          if (!transcript) {
            setProblem("Prisma: empty transcript");
            void say(lang.current.t.emptyTranscript);
          } else {
            setProblem("");
            cb.current({ transcript, clip });
          }
        } catch (e) {
          setProblem(e instanceof GnaniClientError ? `${e.code} (HTTP ${e.status}): ${e.message}` : String(e));
          void say(lang.current.t.apiError);
        } finally {
          setPhase("idle");
        }
      },
    });
    recRef.current = rec;
    return () => rec.discard(); // leaving the screen releases the mic
  }, [say]);

  async function toggle() {
    const rec = recRef.current;
    if (!rec) return;
    if (phase === "recording") await rec.stop();
    else if (phase === "idle") {
      stop(); // never record the app's own voice
      setProblem("");
      await rec.start();
    }
  }

  return { phase, elapsed, problem, toggle };
}
