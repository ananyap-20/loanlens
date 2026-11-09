"use client";

// Receipt (CLAUDE.md section 8): fingerprints -> lines -> canvas PNG -> share (or download).
// The PNG is made when the screen opens, so the Share tap can call navigator.share() immediately.
import { useEffect, useRef, useState } from "react";
import { chime } from "@/lib/audio/cues";
import type { GateState } from "@/lib/engine/gate";
import type { AgentCheck } from "@/lib/flow/agent";
import { SAY } from "@/lib/flow/scripts";
import type { PaperInput, Presence, Recording } from "@/lib/flow/session";
import { buildReceipt, RECEIPT_LABEL, receiptFilename } from "@/lib/receipt/build";
import { sha256Hex } from "@/lib/receipt/hash";
import { renderReceiptPng } from "@/lib/receipt/render";
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

export function Receipt({ dots, presence, paper, recordings, checks, gate, onBack, onClear }: Props) {
  const { say } = useSpeech();
  const [png, setPng] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [problem, setProblem] = useState("");
  const [done, setDone] = useState("");
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const createdAt = new Date();
      const documentSha256 = paper.bytes ? await sha256Hex(paper.bytes) : null;
      const hashed = await Promise.all(recordings.map(async (r) => ({ ...r, sha256: await sha256Hex(r.blob) })));
      const lines = buildReceipt({ createdAt, presence, paper, documentSha256, recordings: hashed, checks, gate });
      const blob = await renderReceiptPng(lines);
      if (cancelled) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPng({ blob, url, name: receiptFilename(createdAt) });
    })().catch((e) => {
      if (cancelled) return;
      setProblem(e instanceof Error ? e.message : String(e));
      void say(SAY.receiptFail);
    });
    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current); // nothing left behind when leaving
    };
  }, [presence, paper, recordings, checks, gate, say]);

  async function share() {
    if (!png) return;
    try {
      const outcome = await shareOrDownload(png.blob, png.name);
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

      {png ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={png.url} alt="LoanLens receipt" className="max-h-[50vh] w-full rounded-xl border-2 border-gray-200 object-contain object-top" />
      ) : (
        !problem && (
          <p className="text-center text-2xl" role="status">
            ⏳ 🧾
          </p>
        )
      )}

      <button className={primary} disabled={!png} onClick={share}>
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
