"use client";

// One paper term as a picture card: icon + name (in the selected language) + notes/coins or digits.
import type { Field, Value } from "@/lib/engine/types";
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
  const { ui } = useLang().pack;
  if (v.negated && v.amount === 0) return <span className="text-3xl font-extrabold">₹0 🚫</span>;
  if (v.amount === undefined) return <span className="text-3xl">❔</span>;
  if (v.unit === "INR") {
    return (
      <div className="flex flex-col gap-1">
        <Money amount={v.amount} />
        {v.frequency && v.frequency !== "once" && <span className="text-xl font-bold">🔁 {ui.freq[v.frequency]}</span>}
      </div>
    );
  }
  const unit = v.unit === "percent" ? "%" : v.unit === "months" ? ` ${ui.months}` : v.unit === "weeks" ? ` ${ui.weeks}` : "";
  return <span className="text-3xl font-extrabold">{`${v.amount}${unit}`}</span>;
}

export function TermCard({ v, highlight }: { v: Value; highlight?: boolean }) {
  const { ui } = useLang().pack;
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border-2 p-3 ${highlight ? "border-blue-600 bg-blue-50" : "border-gray-200"}`}>
      <span className="flex items-center gap-2 text-xl font-bold">
        <span className="text-3xl">{FIELD_ICON[v.field]}</span>
        {ui.fieldName[v.field]}
      </span>
      <ValueView v={v} />
    </div>
  );
}
