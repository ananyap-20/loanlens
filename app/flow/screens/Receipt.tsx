"use client";

// Receipt (CLAUDE.md section 8) as one PDF: fingerprints -> summary + evidence -> canvas pages -> PDF ->
// SHA-256 of the PDF itself (both parties can compare copies) -> share (or download).
// The PDF is made when the screen opens, so the Share tap can call navigator.share() immediately.
import { useEffect, useState } from "react";
import { chime } from "@/lib/audio/cues";
import type { GateState } from "@/lib/engine/gate";
import type { AgentCheck } from "@/lib/flow/agent";
import { SAY } from "@/lib/flow/scripts";
import type { PaperInput, Presence, Recording } from "@/lib/flow/session";
import { buildEvidence, buildSummary, RECEIPT_LABEL, receiptFilename } from "@/lib/receipt/build";
import { sha256Hex } from "@/lib/receipt/hash";
import { makeReceiptPdf } from "@/lib/receipt/pdf";
import { shareOrDownload } from "@/lib/receipt/share";
import { ClearButton } from "../ClearButton";
import { useSpeech } from "../speech";
import { primary, Screen, secondary } from "../ui";

type Props = {
  dots: { total: number; current: number };
  presence: Presence;
  paper: PaperInput;
  recordings: Recording[];
  checks: AgentCheck[];
  gate: GateState | null;
  onBack: () => void;
  onClear: () => void;
};

type Ready = { pdf: Blob; name: string; sha256: string; pages: number; previews: string[] };

export function Receipt({ dots, presence, paper, recordings, checks, gate, onBack, onClear }: Props) {
  const { say } = useSpeech();
  const [ready, setReady] = useState<Ready | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const createdAt = new Date();
      const documentSha256 = paper.bytes ? await sha256Hex(paper.bytes) : null;
      const hashed = await Promise.all(recordings.map(async (r) => ({ ...r, sha256: await sha256Hex(r.blob) })));
      const input = { createdAt, presence, paper, documentSha256, recordings: hashed, checks, gate };
      const out = await makeReceiptPdf(buildSummary(input), buildEvidence(input), createdAt);
      const sha256 = await sha256Hex(out.pdf);
      if (!cancelled) setReady({ pdf: out.pdf, name: receiptFilename(createdAt), sha256, pages: out.pages, previews: out.previews });
    })().catch((e) => {
      if (cancelled) return;
      setProblem(e instanceof Error ? e.message : String(e));
      void say(SAY.receiptFail);
    });
    return () => {
      cancelled = true;
    };
  }, [presence, paper, recordings, checks, gate, say]);

  async function share() {
    if (!ready) return;
    try {
      const outcome = await shareOrDownload(ready.pdf, ready.name);
      if (outcome === "cancelled") return;
      chime();
      setDone(outcome === "shared" ? "✅ 📤" : "✅ ⬇️");
      void say(outcome === "shared" ? SAY.receiptShared : SAY.receiptDownloaded);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      void say(SAY.receiptFail);
    }
  }

  return (
    <Screen instruction={SAY.receipt} dots={dots}>
      <p className="rounded-xl border-2 border-amber-500 bg-amber-50 p-2 text-center text-base font-semibold text-amber-900">{RECEIPT_LABEL}</p>

      {ready ? (
        <>
          <div className="flex gap-2 overflow-x-auto" aria-label={`PDF, ${ready.pages} pages`}>
            {ready.previews.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={src} alt={`receipt page ${i + 1}`} className="h-72 shrink-0 rounded-lg border-2 border-gray-300 bg-white" />
            ))}
          </div>
          <p className="text-center text-lg font-semibold">
            📄 PDF · {ready.pages} पन्ने · {(ready.pdf.size / 1024).toFixed(0)} KB
          </p>
          <div className="rounded-xl border-2 border-gray-300 bg-gray-50 p-3" aria-label="receipt fingerprint">
            <p className="text-lg font-bold">🔏 रसीद फ़िंगरप्रिंट · Receipt fingerprint</p>
            <p className="font-mono text-2xl font-bold tracking-wider">{ready.sha256.slice(0, 16).match(/.{4}/g)!.join(" ")}</p>
            <p className="break-all font-mono text-xs text-gray-600">SHA-256: {ready.sha256}</p>
            <p className="text-sm text-gray-700">दोनों के फ़ोन पर यह नंबर एक जैसा हो, तो रसीद एक ही है। · Same number on both phones = identical copies.</p>
          </div>
        </>
      ) : (
        !problem && (
          <p className="text-center text-2xl" role="status">
            ⏳ 🧾 PDF…
          </p>
        )
      )}

      <button className={primary} disabled={!ready} onClick={share}>
        <span className="text-4xl">📤</span> शेयर {done}
      </button>
      {problem && (
        <p className="rounded-xl bg-red-100 p-3 text-lg text-red-800" role="alert">
          ❔ {problem}
        </p>
      )}
      <ClearButton onClear={onClear} />
      <button className={secondary} onClick={onBack}>
        <span className="text-3xl">◀️</span>
      </button>
    </Screen>
  );
}
