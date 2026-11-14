"use client";

// Call check screen: a SYNTHETIC call file -> ≤28 s WAV pieces -> Prisma one at a time (the shared queue,
// with the previous piece's transcript as previous_text) -> whole transcript -> the same engine -> differences.
import { useRef, useState } from "react";
import { buzz, chime } from "@/lib/audio/cues";
import { samplesToWavBlob } from "@/lib/audio/wav";
import { checkCall, rowsAsChecks, type CallResult } from "@/lib/call/check";
import { planChunks, toMono } from "@/lib/call/chunks";
import type { PaperInput } from "@/lib/flow/session";
import { gnani, GnaniClientError } from "@/lib/gnani/queue";
import { callStrings } from "@/lib/i18n/call";
import { useLang } from "../flow/lang";
import { useSpeech } from "../flow/speech";
import { FIELD_ICON, ValueView } from "../flow/TermCard";
import { statusPresentation } from "@/lib/flow/statusPresentation";
import { primary, Screen, secondary, StatusBadge } from "../flow/ui";

export function CallCheck({ paper, onBack }: { paper: PaperInput; onBack: () => void }) {
  const { pack, prismaLanguage } = useLang();
  const { say: t, ui } = pack;
  const c = callStrings(pack.code);
  const { say, stop } = useSpeech();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ part: number; of: number } | null>(null);
  const [parts, setParts] = useState<string[]>([]);
  const [result, setResult] = useState<CallResult | null>(null);
  const [problem, setProblem] = useState("");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  async function run(file: Blob) {
    stop();
    setBusy(true);
    setProblem("");
    setResult(null);
    setParts([]);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    setAudioUrl(urlRef.current);
    void say(c.say.working);
    let mono: Float32Array;
    let rate: number;
    try {
      const ctx = new AudioContext();
      const audio = await ctx.decodeAudioData(await file.arrayBuffer());
      void ctx.close();
      mono = toMono(Array.from({ length: audio.numberOfChannels }, (_, i) => audio.getChannelData(i)));
      rate = audio.sampleRate;
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      setBusy(false);
      void say(c.say.decodeFail);
      return;
    }

    const plan = planChunks(mono, rate);
    const texts: string[] = [];
    let previous = "";
    try {
      for (let i = 0; i < plan.length; i++) {
        setProgress({ part: i + 1, of: plan.length });
        const [a, b] = plan[i];
        const wav = samplesToWavBlob(mono.subarray(a, b), rate); // 16 kHz mono WAV, ≤ 28 s
        const r = await gnani.transcribe(wav, "clip.wav", { language: prismaLanguage, previousText: previous });
        const text = r.transcript.trim();
        texts.push(text);
        setParts([...texts]);
        if (text) previous = text;
      }
    } catch (e) {
      setProblem(e instanceof GnaniClientError ? `${e.code} (HTTP ${e.status}): ${e.message}` : String(e));
      setBusy(false);
      setProgress(null);
      void say(c.say.chunkFail);
      return;
    }

    const whole = texts.filter(Boolean).join(" ");
    const res = checkCall(whole, paper.terms, pack.normalize);
    setResult(res);
    setBusy(false);
    setProgress(null);

    const checks = rowsAsChecks(res.rows, whole);
    const differences = checks.filter((x) => x.status === "conflict");
    const questions = t.lenderQuestions(paper, checks);
    if (differences.length) buzz();
    else chime();
    const spoken = [
      differences.length ? c.say.differencesIntro : c.say.noDifferences,
      ...differences.map((x) => t.agentFlag(x)),
      ...questions,
    ]
      .filter(Boolean)
      .join(" ");
    void say(spoken);
  }

  async function sample() {
    const res = await fetch("/sample/call-sahyog.mp3");
    if (!res.ok) {
      setProblem(`HTTP ${res.status}`);
      return;
    }
    await run(await res.blob());
  }

  const questions = result ? t.lenderQuestions(paper, rowsAsChecks(result.rows, "")) : [];

  return (
    <Screen instruction={c.say.instruction}>
      <h1 className="text-3xl font-semibold leading-tight">{c.ui.title}</h1>
      <p className="rounded-chip border-2 border-amber-500 bg-amber-50 p-3 text-lg font-semibold text-amber-900">{c.ui.syntheticOnly}</p>
      <p className="text-sm text-muted">🔁 {c.ui.sameEngine}</p>

      <label className={`${primary} cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>
        {c.ui.upload}
        <input
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void run(f);
          }}
        />
      </label>
      <button className={secondary} disabled={busy} onClick={sample}>
        {c.ui.sampleCall}
      </button>
      {audioUrl && <audio src={audioUrl} controls className="w-full" />}

      {progress && (
        <p className="text-center text-2xl" role="status">
          ⏳ {c.ui.part} {progress.part}/{progress.of}
        </p>
      )}
      {problem && (
        <p className="rounded-chip border border-conflict/30 bg-conflict-soft p-3 text-lg text-conflict" role="alert">
          ❔ {problem}
        </p>
      )}

      {parts.length > 0 && (
        <section className="flex flex-col gap-2 rounded-card border border-line bg-surface p-5 shadow-soft">
          <h2 className="text-lg font-semibold">{c.ui.transcriptTitle}</h2>
          {parts.map((p, i) => (
            <p key={i} className="text-base text-muted">
              <b>
                {c.ui.part} {i + 1}:
              </b>{" "}
              “{p || "—"}”
            </p>
          ))}
        </section>
      )}

      {result && (
        <>
          <section className="flex flex-col gap-2">
            {result.rows.map((r) => (
              <div key={r.field} className={`flex flex-col gap-3 rounded-card border border-line bg-surface p-5 shadow-soft ${statusPresentation(r.status).stripe}`}>
                <span className="flex items-center gap-2 text-xl font-semibold">
                  <span className="text-3xl">{FIELD_ICON[r.field]}</span> {ui.fieldName[r.field]}
                </span>
                <StatusBadge status={r.status} reason={r.status === "unable_to_verify" && r.reason ? ui.reason[r.reason] : undefined} />
                <div className="grid grid-cols-2 gap-3 rounded-chip bg-sand p-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold">{c.ui.callCol}</span>
                    {r.spoken[0] ? <ValueView v={r.spoken[0]} compact /> : <span className="text-2xl">—</span>}
                  </div>
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-semibold">{ui.paperCol}</span>
                    {r.paper ? <ValueView v={r.paper} compact /> : <span className="text-2xl">❔</span>}
                  </div>
                </div>
              </div>
            ))}
          </section>
          <section className="flex flex-col gap-2 rounded-card border-2 border-amber-500 bg-amber-50 p-5">
            <h2 className="text-xl font-semibold">{ui.askLender}</h2>
            {questions.map((q) => (
              <p key={q} className="text-lg">
                • {q}
              </p>
            ))}
          </section>
        </>
      )}

      <button className={secondary} disabled={busy} onClick={onBack}>
        {c.ui.back}
      </button>
    </Screen>
  );
}
