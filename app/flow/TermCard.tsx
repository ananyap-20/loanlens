"use client";

// One paper term as a picture card: icon + name (in the selected language) + notes/coins or digits.
import type { Field, Value } from "@/lib/engine/types";
import { nativeINR, nativeNumber } from "@/lib/i18n/numerals";
import { useLang } from "./lang";
import { Money, numClass } from "./Money";

export const FIELD_ICON: Record<Field, string> = {
  loan_amount: "💰",
  net_disbursed: "👛",
  processing_fee: "🧾",
  installment: "🗓️",
  tenure: "⏳",
  interest_rate: "📈",
  late_fee: "⏰",
};

/** `compact`: for the two-column agent/call vs paper comparison, where 40px amounts would run into each other. */
export function ValueView({ v, compact = false }: { v: Value; compact?: boolean }) {
  const { ui, code } = useLang().pack;
  const big = `${numClass(code)} ${compact ? "text-[clamp(18px,6vw,28px)] [overflow-wrap:anywhere]" : "text-[40px]"}`;
  if (v.negated && v.amount === 0) return <span className={`${big} font-semibold leading-none`}>{nativeINR(0, code)} 🚫</span>;
  if (v.amount === undefined) return <span className="text-3xl">❔</span>;
  if (v.unit === "INR") {
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <Money amount={v.amount} compact={compact} />
        {v.frequency && v.frequency !== "once" && <span className={`${compact ? "text-base" : "text-xl"} font-semibold`}>🔁 {ui.freq[v.frequency]}</span>}
      </div>
    );
  }
  const unit = v.unit === "percent" ? "%" : v.unit === "months" ? ` ${ui.months}` : v.unit === "weeks" ? ` ${ui.weeks}` : "";
  return <span className={`${big} font-semibold leading-none`}>{`${nativeNumber(v.amount, code)}${unit}`}</span>;
}

export function TermCard({ v, highlight }: { v: Value; highlight?: boolean }) {
  const { ui } = useLang().pack;
  return (
    <div className={`flex flex-col gap-3 rounded-card border bg-surface p-5 shadow-soft ${highlight ? "border-2 border-primary" : "border-line"}`}>
      <span className="flex items-center gap-2 text-xl font-semibold">
        <span className="text-3xl">{FIELD_ICON[v.field]}</span>
        {ui.fieldName[v.field]}
      </span>
      <ValueView v={v} />
    </div>
  );
}
