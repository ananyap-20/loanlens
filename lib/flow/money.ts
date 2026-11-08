// Money as pictures: split a rupee amount into Indian notes and coins (greedy, exact). Pure.
export const NOTES = [500, 200, 100, 50, 20, 10] as const;
export const COINS = [5, 2, 1] as const;

export type Piece = { denom: number; count: number; kind: "note" | "coin" };

/** 1500 -> [3 x ₹500]; 2666 -> [5x500, 1x100, 1x50, 1x10, 1x5, 1x1]. Non-integers / negatives -> [] (digits only). */
export function breakdown(amount: number): Piece[] {
  if (!Number.isInteger(amount) || amount <= 0) return [];
  const out: Piece[] = [];
  let rest = amount;
  for (const d of [...NOTES, ...COINS]) {
    const count = Math.floor(rest / d);
    if (count > 0) {
      out.push({ denom: d, count, kind: (NOTES as readonly number[]).includes(d) ? "note" : "coin" });
      rest -= count * d;
    }
  }
  return out;
}

/** 28500 -> "₹28,500" (Indian digit grouping). */
export function formatINR(n: number): string {
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}
