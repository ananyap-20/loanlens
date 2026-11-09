// Money as pictures of notes and coins, plus the digits. One tidy row per amount:
// one picture per denomination (a second one peeks out behind it when there are several) and "×count".
import { breakdown, formatINR } from "@/lib/flow/money";

const NOTE_COLOUR: Record<number, string> = {
  500: "bg-stone-300 border-stone-500",
  200: "bg-orange-300 border-orange-500",
  100: "bg-violet-300 border-violet-500",
  50: "bg-cyan-200 border-cyan-500",
  20: "bg-lime-300 border-lime-600",
};

function Note({ denom, className = "" }: { denom: number; className?: string }) {
  return (
    <span className={`flex h-7 w-11 shrink-0 items-center justify-center rounded border-2 text-[10px] font-bold shadow-sm ${NOTE_COLOUR[denom]} ${className}`}>
      ₹{denom}
    </span>
  );
}

function Coin({ denom, className = "" }: { denom: number; className?: string }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-yellow-700 bg-yellow-400 text-[10px] font-bold shadow-sm ${className}`}
    >
      ₹{denom}
    </span>
  );
}

export function Money({ amount }: { amount: number }) {
  const pieces = breakdown(amount);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-3xl font-extrabold tracking-wide">{formatINR(amount)}</span>
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1" aria-hidden>
        {pieces.map((p) => {
          const Pic = p.kind === "note" ? Note : Coin;
          return (
            <span key={p.denom} className="flex shrink-0 items-center gap-0.5">
              <span className="relative flex">
                {p.count > 1 && <Pic denom={p.denom} className="absolute left-1 top-1 opacity-70" />}
                <Pic denom={p.denom} className="relative" />
              </span>
              <span className="pl-1 text-sm font-bold">×{p.count}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
