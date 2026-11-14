"use client";

// Money as pictures of notes and coins, plus the amount in the language's own digits AND in words under it.
// One tidy row per amount: one picture per denomination (a second one peeks out behind it when there are
// several) and "×count". If the language has no verified number-word table, only the digits are shown.
import { breakdown } from "@/lib/flow/money";
import { nativeINR, nativeNumber } from "@/lib/i18n/numerals";
import { useLang } from "./lang";

const NOTE_COLOUR: Record<number, string> = {
  500: "bg-stone-200 border-stone-400",
  200: "bg-orange-200 border-orange-400",
  100: "bg-violet-200 border-violet-400",
  50: "bg-cyan-100 border-cyan-400",
  20: "bg-lime-200 border-lime-500",
};

function Note({ denom, label, className = "" }: { denom: number; label: string; className?: string }) {
  return (
    <span className={`note-paper flex h-7 w-11 shrink-0 items-center justify-center rounded-md border text-[10px] font-semibold text-ink shadow-sm ${NOTE_COLOUR[denom]} ${className}`}>
      ₹{label}
    </span>
  );
}

function Coin({ denom, label, className = "" }: { denom: number; label: string; className?: string }) {
  void denom;
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-yellow-600 bg-yellow-300 text-[10px] font-semibold text-ink shadow-sm ${className}`}
    >
      ₹{label}
    </span>
  );
}

/** `compact`: for two amounts side by side (agent vs paper); the size follows the screen width so they never touch. */
export function Money({ amount, compact = false }: { amount: number; compact?: boolean }) {
  const { pack } = useLang();
  const pieces = breakdown(amount);
  const words = pack.rupeesToWords && Number.isInteger(amount) && amount >= 0 ? pack.rupeesToWords(amount) : null;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className={`font-semibold leading-none ${compact ? "text-[clamp(18px,6vw,28px)] [overflow-wrap:anywhere]" : "text-[40px] tracking-wide"}`}>
        {nativeINR(amount, pack.code)}
      </span>
      {words && <span className={`font-semibold text-muted ${compact ? "text-sm" : "text-base"}`}>{words}</span>}
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1" aria-hidden>
        {pieces.map((p) => {
          const Pic = p.kind === "note" ? Note : Coin;
          const label = nativeNumber(p.denom, pack.code);
          return (
            <span key={p.denom} className="flex shrink-0 items-center gap-0.5">
              <span className="relative flex">
                {p.count > 1 && <Pic denom={p.denom} label={label} className="absolute left-1 top-1 opacity-70" />}
                <Pic denom={p.denom} label={label} className="relative" />
              </span>
              <span className="pl-1 text-sm font-semibold">×{nativeNumber(p.count, pack.code)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
