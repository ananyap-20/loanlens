// Money as pictures of notes and coins, plus the digits.
import { breakdown, formatINR } from "@/lib/flow/money";

const NOTE_COLOUR: Record<number, string> = {
  500: "bg-stone-300 border-stone-500",
  200: "bg-orange-300 border-orange-500",
  100: "bg-violet-300 border-violet-500",
  50: "bg-cyan-200 border-cyan-500",
  20: "bg-lime-300 border-lime-600",
  10: "bg-amber-600 border-amber-800 text-white",
};

const MAX_PICTURES = 5; // per denomination; the count is always written next to them

export function Money({ amount }: { amount: number }) {
  const pieces = breakdown(amount);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-3xl font-extrabold tracking-wide">{formatINR(amount)}</span>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-hidden>
        {pieces.map((p) => (
          <span key={p.denom} className="flex items-center gap-1">
            <span className="flex">
              {Array.from({ length: Math.min(p.count, MAX_PICTURES) }, (_, i) =>
                p.kind === "note" ? (
                  <span
                    key={i}
                    className={`-ml-4 first:ml-0 flex h-8 w-14 items-center justify-center rounded border-2 text-xs font-bold shadow ${NOTE_COLOUR[p.denom]}`}
                  >
                    ₹{p.denom}
                  </span>
                ) : (
                  <span
                    key={i}
                    className="-ml-3 first:ml-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-yellow-700 bg-yellow-400 text-xs font-bold shadow"
                  >
                    ₹{p.denom}
                  </span>
                ),
              )}
            </span>
            <span className="text-lg font-bold">×{p.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
