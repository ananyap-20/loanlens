"use client";

// Big "clear everything" button. Two taps: the first asks (spoken), the second clears.
import { useEffect, useState } from "react";
import { useLang } from "./lang";
import { useSpeech } from "./speech";
import { bigBtn } from "./ui";

export function ClearButton({ onClear }: { onClear: () => void }) {
  const { say } = useSpeech();
  const { say: t, ui } = useLang().pack;
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 10_000); // the question expires
    return () => clearTimeout(timer);
  }, [armed]);

  return (
    <button
      aria-label={armed ? `${ui.clearSure} — confirm clear everything` : `${ui.clear} — clear everything`}
      className={`${bigBtn} ${armed ? "bg-red-700 text-white ring-8 ring-red-200" : "border-2 border-red-600 bg-white text-red-700"}`}
      onClick={() => {
        if (armed) onClear();
        else {
          setArmed(true);
          void say(t.clearConfirm);
        }
      }}
    >
      <span className="text-4xl">🗑️</span> {armed ? ui.clearSure : ui.clear}
    </button>
  );
}
