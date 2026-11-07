"use client";

import { useRef, useState } from "react";

// Hindi sentence with numbers written as words (Timbre mispronounces raw digits).
const SENTENCE = "नमस्ते। आपका लोन तीस हज़ार रुपये का है। किस्त दो हज़ार छह सौ छियासठ रुपये है।";

export default function SmokePage() {
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function speak(): Promise<Blob> {
    const res = await fetch("/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: SENTENCE }),
    });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}: ${await res.text()}`);
    return res.blob();
  }

  async function transcribe(blob: Blob, filename: string): Promise<string> {
    const fd = new FormData();
    fd.append("audio_file", blob, filename);
    const res = await fetch("/api/transcribe", { method: "POST", body: fd });
    const text = await res.text();
    return `STT HTTP ${res.status}\n${text}`;
  }

  async function play(blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = audioRef.current!;
    a.src = url;
    await a.play();
  }

  async function run(fn: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setLog("Working...");
    try {
      setLog(await fn());
    } catch (e) {
      setLog(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  const btn = "min-h-14 rounded-xl bg-blue-600 px-4 py-3 text-lg font-semibold text-white disabled:opacity-50";

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Gnani smoke test</h1>
      <p className="text-sm">Each button makes at most one Timbre call and one Prisma call.</p>
      <p lang="hi" className="rounded bg-gray-100 p-2 text-sm text-black">
        {SENTENCE}
      </p>

      <button
        className={btn}
        disabled={busy}
        onClick={() =>
          run(async () => {
            const blob = await speak();
            await play(blob);
            return "TTS OK (1 call). Played the audio.";
          })
        }
      >
        Speak only (Timbre)
      </button>

      <button
        className={btn}
        disabled={busy}
        onClick={() =>
          run(async () => {
            const blob = await speak();
            await play(blob);
            return transcribe(blob, "clip.mp3");
          })
        }
      >
        Speak then transcribe
      </button>

      <label className="flex flex-col gap-2">
        <span className="font-semibold">Or upload a WAV / MP3 / M4A (Prisma only)</span>
        <input
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac,.aac"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) run(() => transcribe(f, f.name));
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
