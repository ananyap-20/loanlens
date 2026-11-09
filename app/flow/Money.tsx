"use client";

// Money as pictures of notes and coins, plus the amount in the language's own digits AND in words under it.
// One tidy row per amount: one picture per denomination (a second one peeks out behind it when there are
// several) and "×count". If the language has no verified number-word table, only the digits are shown.
import { breakdown } from "@/lib/flow/money";
import { nativeINR, nativeNumber } from "@/lib/i18n/numerals";
import { useLang } from "./lang";

const NOTE_COLOUR: Record<number, string> = {
  500: "bg-stone-300 border-stone-500",
  200: "bg-orange-300 border-orange-500",
  100: "bg-violet-300 border-violet-500",
  50: "bg-cyan-200 border-cyan-500",
  20: "bg-lime-300 border-lime-600",
};

function Note({ denom, label, className = "" }: { denom: number; label: string; className?: string }) {
  return (
    <span className={`flex h-7 w-11 shrink-0 items-center justify-center rounded border-2 text-[10px] font-bold shadow-sm ${NOTE_COLOUR[denom]} ${className}`}>
      ₹{label}
    </span>
  );
}

function Coin({ denom, label, className = "" }: { denom: number; label: string; className?: string }) {
  void denom;
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-yellow-700 bg-yellow-400 text-[10px] font-bold shadow-sm ${className}`}
    >
      ₹{label}
    </span>
  );
}

export function Money({ amount }: { amount: number }) {
  const { pack } = useLang();
  const pieces = breakdown(amount);
  const words = pack.rupeesToWords && Number.isInteger(amount) && amount >= 0 ? pack.rupeesToWords(amount) : null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-3xl font-extrabold tracking-wide">{nativeINR(amount, pack.code)}</span>
      {words && <span className="text-base font-semibold text-gray-700">{words}</span>}
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
              <span className="pl-1 text-sm font-bold">×{nativeNumber(p.count, pack.code)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
