"use client";

// One paper term as a picture card: icon + name (in the selected language) + notes/coins or digits.
import type { Field, Value } from "@/lib/engine/types";
import { nativeINR, nativeNumber } from "@/lib/i18n/numerals";
import { useLang } from "./lang";
import { Money } from "./Money";

export const FIELD_ICON: Record<Field, string> = {
  loan_amount: "💰",
  net_disbursed: "👛",
  processing_fee: "🧾",
  installment: "🗓️",
  tenure: "⏳",
  interest_rate: "📈",
  late_fee: "⏰",
};

export function ValueView({ v }: { v: Value }) {
  const { ui, code } = useLang().pack;
  if (v.negated && v.amount === 0) return <span className="text-[40px] font-semibold leading-none">{nativeINR(0, code)} 🚫</span>;
  if (v.amount === undefined) return <span className="text-3xl">❔</span>;
  if (v.unit === "INR") {
    return (
      <div className="flex flex-col gap-1">
        <Money amount={v.amount} />
        {v.frequency && v.frequency !== "once" && <span className="text-xl font-semibold">🔁 {ui.freq[v.frequency]}</span>}
      </div>
    );
  }
  const unit = v.unit === "percent" ? "%" : v.unit === "months" ? ` ${ui.months}` : v.unit === "weeks" ? ` ${ui.weeks}` : "";
  return <span className="text-[40px] font-semibold leading-none">{`${nativeNumber(v.amount, code)}${unit}`}</span>;
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
