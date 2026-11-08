"use client";

import { useEffect, useRef, useState } from "react";
import { WavRecorder, MAX_RECORD_SECONDS, type RecordedClip, type RecorderState } from "@/lib/audio/recorder";
import { gnani, GnaniClientError } from "@/lib/gnani/queue";

// Hindi sentence with numbers written as words (Timbre mispronounces raw digits).
const SENTENCE = "नमस्ते। आपका लोन तीस हज़ार रुपये का है। किस्त दो हज़ार छह सौ छियासठ रुपये है।";

const fmt = (s: number) => `0:${Math.floor(s).toString().padStart(2, "0")}`;

function describeError(e: unknown): string {
  if (e instanceof GnaniClientError) return `ERROR ${e.code} (HTTP ${e.status}): ${e.message}`;
  return `ERROR: ${e instanceof Error ? e.message : String(e)}`;
}

export default function SmokePage() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState("");
  const [recState, setRecState] = useState<RecorderState>("idle");
  const [recMessage, setRecMessage] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [clipInfo, setClipInfo] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<WavRecorder | null>(null);
  const lastClipRef = useRef<RecordedClip | null>(null);
  const [hasClip, setHasClip] = useState(false);

  async function play(blob: Blob) {
    const a = audioRef.current!;
    if (a.src.startsWith("blob:")) URL.revokeObjectURL(a.src);
    a.src = URL.createObjectURL(blob);
    await a.play();
  }

  async function run(fn: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setLog("Working...");
    try {
      setLog(await fn());
    } catch (e) {
      setLog(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function transcribeBlob(blob: Blob, filename: string) {
    const r = await gnani.transcribe(blob, filename);
    return `STT OK (${filename})\n${JSON.stringify(r.raw)}`;
  }

  // Recorder is created once, in the browser only.
  useEffect(() => {
    const rec = new WavRecorder({
      onState: (s, m) => {
        setRecState(s);
        setRecMessage(m ?? "");
      },
      onTick: setElapsed,
      onClip: (clip) => {
        lastClipRef.current = clip;
        setHasClip(true);
        setClipInfo(
          `${clip.filename}: ${clip.durationSec.toFixed(1)} s, ${(clip.blob.size / 1024).toFixed(0)} KB, ` +
            `16 kHz mono 16-bit (device captured at ${clip.capturedRate} Hz)` +
            (clip.autoStopped ? " - stopped automatically" : ""),
        );
        // Stop -> transcribe automatically: one Prisma call per recording.
        void run(async () => {
          await play(clip.blob).catch(() => undefined);
          return transcribeBlob(clip.blob, clip.filename);
        });
      },
    });
    recorderRef.current = rec;
    return () => rec.discard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recording = recState === "recording";
  const btn = "min-h-14 rounded-xl bg-blue-600 px-4 py-3 text-lg font-semibold text-white disabled:opacity-50";
  const problem = ["denied", "no_mic", "unsupported", "error"].includes(recState);

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Gnani smoke test</h1>
      <p className="text-sm">Each button makes at most one Timbre call and one Prisma call.</p>
      <p lang="hi" className="rounded bg-gray-100 p-2 text-sm text-black">
        {SENTENCE}
      </p>

      <button
        className={btn}
        disabled={busy || recording}
        onClick={() =>
          run(async () => {
            const cached = gnani.isSpeakCached(SENTENCE);
            const blob = await gnani.speak(SENTENCE);
            await play(blob);
            return cached ? "TTS OK (played from memory cache, 0 calls)." : "TTS OK (1 Timbre call). Played the audio.";
          })
        }
      >
        Speak only (Timbre)
      </button>

      <button
        className={btn}
        disabled={busy || recording}
        onClick={() =>
          run(async () => {
            const blob = await gnani.speak(SENTENCE);
            await play(blob);
            return transcribeBlob(blob, "clip.mp3");
          })
        }
      >
        Speak then transcribe
      </button>

      <section className="flex flex-col gap-3 rounded-xl border border-gray-500 p-3">
        <h2 className="text-lg font-bold">Record your voice</h2>
        <p className="text-sm">
          Say something in Hindi/Hinglish, e.g. &quot;processing fee pandrah sau hai&quot;. Max {MAX_RECORD_SECONDS} seconds. Stop
          sends it to Prisma (1 call).
        </p>

        {recording ? (
          <div role="status" className="flex items-center gap-3 rounded-lg bg-red-600 p-3 text-white">
            <span className="inline-block h-4 w-4 animate-pulse rounded-full bg-white" />
            <span className="text-lg font-bold">
              RECORDING {fmt(elapsed)} / {fmt(MAX_RECORD_SECONDS)}
            </span>
          </div>
        ) : (
          <div role="status" className="rounded-lg bg-gray-700 p-3 text-white">
            {recState === "requesting" && "Waiting for microphone permission..."}
            {recState === "idle" && "Not recording"}
            {recState === "stopped" && "Recording finished (microphone is off)"}
            {problem && "Cannot record"}
          </div>
        )}
        {problem && recMessage && <p className="rounded bg-yellow-200 p-2 text-sm text-black">{recMessage}</p>}

        {!recording ? (
          <button
            className={btn}
            disabled={busy || recState === "requesting"}
            onClick={() => void recorderRef.current?.start()}
          >
            🎤 Record
          </button>
        ) : (
          <button className="min-h-14 rounded-xl bg-red-600 px-4 py-3 text-lg font-semibold text-white" onClick={() => void recorderRef.current?.stop()}>
            ⏹ Stop
          </button>
        )}

        {clipInfo && <p className="text-xs">{clipInfo}</p>}
        {hasClip && !recording && (
          <button
            className={btn}
            disabled={busy}
            onClick={() => {
              const clip = lastClipRef.current;
              if (clip) void run(() => transcribeBlob(clip.blob, clip.filename));
            }}
          >
            Transcribe last recording again
          </button>
        )}
      </section>

      <label className="flex flex-col gap-2">
        <span className="font-semibold">Or upload a WAV / MP3 / M4A (Prisma only)</span>
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.aac"
          disabled={busy || recording}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void run(() => transcribeBlob(f, f.name));
            e.target.value = "";
          }}
        />
      </label>

      <audio ref={audioRef} controls className="w-full" />
      <pre className="min-h-24 overflow-x-auto whitespace-pre-wrap break-words rounded bg-gray-900 p-3 text-xs text-green-300">
        {log || "Raw response appears here."}
      </pre>
    </main>
  );
}
