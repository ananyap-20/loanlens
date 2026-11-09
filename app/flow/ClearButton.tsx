"use client";

// Big "सब मिटाएँ" (clear everything). Two taps: the first asks (spoken), the second clears.
import { useEffect, useState } from "react";
import { SAY } from "@/lib/flow/scripts";
import { useSpeech } from "./speech";
import { bigBtn } from "./ui";

export function ClearButton({ onClear }: { onClear: () => void }) {
  const { say } = useSpeech();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 10_000); // the question expires
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      aria-label={armed ? "पक्का, सब मिटाएँ — confirm clear everything" : "सब मिटाएँ — clear everything"}
      className={`${bigBtn} ${armed ? "bg-red-700 text-white ring-8 ring-red-200" : "border-2 border-red-600 bg-white text-red-700"}`}
      onClick={() => {
        if (armed) onClear();
        else {
          setArmed(true);
          void say(SAY.clearConfirm);
        }
      }}
    >
      <span className="text-4xl">🗑️</span> {armed ? "पक्का? ✔️" : "सब मिटाएँ"}
    </button>
  );
}
