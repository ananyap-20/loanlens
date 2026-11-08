"use client";

// Paper step: QR camera scan, PDF / QR-photo file picker, the sample KFS, or a file shared to the app.
import { useEffect, useRef, useState } from "react";
import { PAPER_FAIL_HI, SAY } from "@/lib/flow/scripts";
import type { PaperInput } from "@/lib/flow/session";
import { isPdf, readPaperFile, takeSharedFile } from "@/lib/paper/input";
import { scanQrWithCamera, termsFromQrPayload } from "@/lib/paper/qr";
import type { PaperResult } from "@/lib/paper/terms";
import { useSpeech } from "../speech";
import { primary, Screen, secondary } from "../ui";

type Props = {
  dots: { total: number; current: number };
  shared: string | null; // "1" = a file was shared to LoanLens, "failed" = share did not arrive
  onPaper: (p: PaperInput) => void;
};

export function Paper({ dots, shared, onPaper }: Props) {
  const { say, stop } = useSpeech();
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [problem, setProblem] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function finish(r: PaperResult, source: PaperInput["source"], bytes?: Uint8Array) {
    if (!r.ok) {
      setProblem(r.detail ? `${r.message} [${r.detail}]` : r.message);
      void say(PAPER_FAIL_HI[r.reason]);
      return;
    }
    onPaper({ terms: r.terms, missing: r.missing, ambiguous: r.ambiguous, lender: r.lender, grievance: r.grievance, source, bytes });
  }

  async function fromFile(file: Blob, source: PaperInput["source"]) {
    setProblem("");
    setBusy(true);
    try {
      const bytes = isPdf(file) ? new Uint8Array(await file.arrayBuffer()) : undefined;
      finish(await readPaperFile(file), source, bytes);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      void say(PAPER_FAIL_HI.unreadable);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!shared) return;
    (async () => {
      const file = shared === "1" ? await takeSharedFile() : null;
      if (file) await fromFile(file, isPdf(file) ? "pdf" : "qr");
      else void say(SAY.sharedFail);
    })().catch(() => void say(SAY.sharedFail));
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared]);

  async function scan() {
    stop();
    setProblem("");
    setScanning(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const text = await scanQrWithCamera(videoRef.current!, ctl.signal);
      finish(termsFromQrPayload(text), "qr", new TextEncoder().encode(text));
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setProblem((e as Error).message);
        void say(SAY.cameraFail);
      }
    } finally {
      setScanning(false);
    }
  }

  async function sample() {
    setBusy(true);
    try {
      const res = await fetch("/sample/kfs-sahyog.pdf");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fromFile(await res.blob(), "sample");
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      void say(PAPER_FAIL_HI.unreadable);
      setBusy(false);
    }
  }

  return (
    <Screen instruction={SAY.paper} dots={dots}>
      <div className={scanning ? "flex flex-col gap-3" : "hidden"}>
        <p className="flex items-center gap-2 rounded-xl bg-red-600 p-3 text-xl font-bold text-white" role="status">
          <span className="h-4 w-4 animate-pulse rounded-full bg-white" /> 📷 कैमरा चालू (रिकॉर्ड नहीं हो रहा)
        </p>
        <video ref={videoRef} playsInline muted className="w-full rounded-2xl bg-black" />
        <button className={secondary} onClick={() => abortRef.current?.abort()}>
          ⏹️ कैमरा बंद
        </button>
      </div>

      {!scanning && (
        <>
          <button className={primary} disabled={busy} onClick={scan}>
            <span className="text-4xl">📷</span> 1 · QR
          </button>
          <label className={`${primary} cursor-pointer ${busy ? "pointer-events-none opacity-40" : ""}`}>
            <span className="text-4xl">📄</span> 2 · PDF
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void fromFile(f, isPdf(f) ? "pdf" : "qr");
              }}
            />
          </label>
          <button className={secondary} disabled={busy} onClick={sample}>
            <span className="text-4xl">🧪</span> 3 · नमूना
          </button>
        </>
      )}

      {busy && (
        <p className="text-center text-2xl" role="status">
          ⏳ कागज़ पढ़ रही हूँ…
        </p>
      )}
      {problem && (
        <p className="rounded-xl bg-gray-100 p-3 text-lg" role="alert">
          ❔ {problem}
        </p>
      )}
    </Screen>
  );
}
