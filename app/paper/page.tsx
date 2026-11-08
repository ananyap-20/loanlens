"use client";

// Phase 4 test page for the paper input (like /smoke). Phase 5 builds the real flow screens on lib/paper.
import { useEffect, useRef, useState } from "react";
import { readPdfTerms } from "@/lib/paper/pdf";
import { decodeQrFromFile, scanQrWithCamera, termsFromQrPayload } from "@/lib/paper/qr";
import type { PaperResult } from "@/lib/paper/terms";

const btn = "min-h-14 w-full rounded-xl bg-blue-600 px-4 py-3 text-lg font-semibold text-white disabled:opacity-50";

async function readFile(file: Blob): Promise<PaperResult> {
  const isPdf = file.type === "application/pdf" || ("name" in file && String((file as File).name).toLowerCase().endsWith(".pdf"));
  if (isPdf) return readPdfTerms(await file.arrayBuffer());
  try {
    const text = await decodeQrFromFile(file);
    if (!text) return { ok: false, reason: "bad_qr", message: "Is tasveer mein QR nahi mila" };
    return termsFromQrPayload(text);
  } catch {
    return { ok: false, reason: "unreadable", message: "Yeh file khul nahi payi" };
  }
}

export default function PaperPage() {
  const [result, setResult] = useState<PaperResult | null>(null);
  const [note, setNote] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handle(file: Blob) {
    setNote("Reading the paper...");
    setResult(null);
    try {
      setResult(await readFile(file));
      setNote("");
    } catch (e) {
      setNote(`ERROR: ${e instanceof Error ? e.name + ": " + e.message : String(e)}`);
    }
  }

  useEffect(() => {
    const shared = new URLSearchParams(window.location.search).get("shared");
    const fail = "Share se file nahi aayi. Neeche se file chuniye.";
    (async () => {
      if (shared === "failed") return setNote(fail);
      if (shared !== "1") return;
      const cache = await caches.open("loanlens-shared");
      const res = await cache.match("/shared-file");
      if (!res) return setNote(fail);
      const blob = await res.blob();
      await cache.delete("/shared-file"); // do not keep the document around
      await handle(blob);
    })().catch(() => setNote(fail));
    return () => abortRef.current?.abort();
  }, []);

  async function scan() {
    setNote("");
    setResult(null);
    setScanning(true);
    const ctl = new AbortController();
    abortRef.current = ctl;
    try {
      const text = await scanQrWithCamera(videoRef.current!, ctl.signal);
      setResult(termsFromQrPayload(text));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setNote("Camera nahi khul paya. File chuniye.");
    } finally {
      setScanning(false);
    }
  }

  async function loadSample() {
    setNote("Loading sample...");
    try {
      const res = await fetch("/sample/kfs-sahyog.pdf");
      if (!res.ok) return setNote(`ERROR: sample download failed (HTTP ${res.status})`);
      await handle(await res.blob());
    } catch (e) {
      setNote(`ERROR: ${e instanceof Error ? e.name + ": " + e.message : String(e)}`);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Paper input (Phase 4 test page)</h1>

      <button className={btn} onClick={scan} disabled={scanning}>
        Scan QR with camera
      </button>
      <div className={scanning ? "flex flex-col gap-2" : "hidden"}>
        <p className="font-semibold text-red-700">Camera ON (nothing is recorded)</p>
        {/* One always-mounted <video>: the stream is attached to this exact element. */}
        <video ref={videoRef} playsInline muted className="w-full rounded-xl bg-black" />
        <button className={btn} onClick={() => abortRef.current?.abort()}>
          Stop camera
        </button>
      </div>

      <label className={btn + " block cursor-pointer text-center"}>
        Choose PDF or QR photo
        <input
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])}
        />
      </label>
      <button className={btn} onClick={loadSample}>
        Load sample KFS PDF
      </button>

      {note && <p className="font-semibold">{note}</p>}
      {result && !result.ok && <p className="rounded-xl bg-gray-200 p-3 text-lg">❔ {result.message}{result.detail ? ` [${result.detail}]` : ""}</p>}
      {result?.ok && (
        <div className="flex flex-col gap-2">
          {result.lender && <p className="font-semibold">{result.lender}</p>}
          <ul className="flex flex-col gap-2">
            {result.terms.map((v) => (
              <li key={v.field} className="rounded-xl border p-3">
                <b>{v.field}</b>: {v.amount} {v.unit}
                {v.frequency ? ` (${v.frequency})` : ""}
                <div className="text-sm text-gray-600">{v.evidence}</div>
              </li>
            ))}
          </ul>
          {result.missing.length > 0 && <p>❔ Not found on paper: {result.missing.join(", ")}</p>}
          {result.ambiguous.length > 0 && <p>❔ Paper says two different things for: {result.ambiguous.join(", ")}</p>}
        </div>
      )}
    </main>
  );
}
