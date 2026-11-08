// PDF path: text from text-based PDFs (pdfjs-dist), then deterministic regex rules. No OCR, no AI.
import { detectFrequency, parseAmounts } from "@/lib/engine";
import type { Field, Frequency, Unit, Value } from "@/lib/engine/types";
import { finishTerms, NO_TEXT_MESSAGE, paperValue, type PaperResult } from "./terms";

type Rule = { field: Field; label: RegExp; unit: Unit; freq?: Frequency | "detect" };

const NONNUM = "[^\\d\\u0966-\\u096F]*";

// Labels are anchored at the start of a line so "Sum of instalments..." never counts as the instalment.
const RULES: Rule[] = [
  { field: "net_disbursed", label: new RegExp("^net\\s+(?:amount\\s+)?(?:disbursed|disbursal)\\b" + NONNUM, "i"), unit: "INR", freq: "once" },
  { field: "loan_amount", label: new RegExp("^(?:loan|principal)\\s+amount\\b" + NONNUM, "i"), unit: "INR", freq: "once" },
  { field: "interest_rate", label: new RegExp("^(?:interest|rate\\s+of\\s+interest)(?:\\s+rate)?\\b" + NONNUM, "i"), unit: "percent" },
  { field: "tenure", label: new RegExp("^(?:loan\\s+)?(?:tenure|term|duration)\\b" + NONNUM, "i"), unit: "months" },
  { field: "installment", label: new RegExp("^(?:instal?lment|emi)(?:\\s+amount)?\\b" + NONNUM, "i"), unit: "INR", freq: "detect" },
  { field: "processing_fee", label: new RegExp("^processing\\s+fees?\\b" + NONNUM, "i"), unit: "INR", freq: "once" },
  { field: "late_fee", label: new RegExp("^(?:late|penal)\\s+(?:payment\\s+)?(?:fee|charges?)\\b" + NONNUM, "i"), unit: "INR" },
];

/** Pure: turns text lines into paper Values (evidence = the line itself). Unreadable fields are left out. */
export function termsFromLines(lines: string[]): { values: Value[]; ambiguous: Field[] } {
  const found = new Map<Field, Value[]>();
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, " ").trim();
    for (const rule of RULES) {
      const m = rule.label.exec(line);
      if (!m) continue;
      const rest = line.slice(m[0].length);
      const num = parseAmounts(rest)[0];
      if (!num || num.bare) break;
      let unit: Unit;
      if (rule.unit === "percent") {
        if (num.unitAfter !== "percent") break;
        unit = "percent";
      } else if (rule.unit === "months") {
        if (num.unitAfter !== "months" && num.unitAfter !== "weeks") break;
        unit = num.unitAfter;
      } else {
        unit = "INR";
      }
      // The label regex swallows the "Rs." / "₹" before the number, so look for it there too.
      const currencyInPrefix = /₹|\brs\b|\binr\b|रु/i.test(m[0]);
      const sure = rule.unit !== "INR" || num.currency || num.unitAfter === "INR" || currencyInPrefix;
      const freq = rule.freq === "detect" ? detectFrequency(rest) : rule.freq;
      const list = found.get(rule.field) ?? [];
      list.push(paperValue(rule.field, num.value, unit, line, freq, sure ? "high" : "medium"));
      found.set(rule.field, list);
      break;
    }
  }
  const values: Value[] = [];
  const ambiguous: Field[] = [];
  for (const [field, list] of found) {
    // Two lines disagreeing about one field: do not guess which one is right.
    if (list.some((v) => v.amount !== list[0].amount || v.unit !== list[0].unit)) ambiguous.push(field);
    else values.push(list[0]);
  }
  return { values, ambiguous };
}

/** Pure: lines -> PaperResult. Used by the PDF path and tested directly on the sample text. */
export function paperResultFromLines(lines: string[]): PaperResult {
  if (lines.every((l) => l.trim() === "")) return { ok: false, reason: "no_text", message: NO_TEXT_MESSAGE };
  const { values, ambiguous } = termsFromLines(lines);
  const { terms, missing } = finishTerms(values);
  if (terms.length === 0) {
    return { ok: false, reason: "no_terms", message: "Is kagaz par loan ki shartein nahi mil payeen" };
  }
  return { ok: true, terms, missing, ambiguous };
}

type TextItem = { str: string; transform: number[] };

/** Group pdf.js text items into visual lines (same y, left to right). */
export function groupItemsIntoLines(items: TextItem[]): string[] {
  const rows = new Map<number, { x: number; str: string }[]>();
  for (const it of items) {
    if (!it.str.trim()) continue;
    const y = Math.round(it.transform[5] / 3);
    const row = rows.get(y) ?? [];
    row.push({ x: it.transform[4], str: it.str });
    rows.set(y, row);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, row]) => row.sort((a, b) => a.x - b.x).map((r) => r.str).join(" "));
}

const MAX_PAGES = 5;

export async function extractPdfLines(bytes: ArrayBuffer | Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const data = new Uint8Array(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); // copy: pdf.js detaches it
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  const lines: string[] = [];
  try {
    for (let p = 1; p <= Math.min(doc.numPages, MAX_PAGES); p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      lines.push(...groupItemsIntoLines(content.items as TextItem[]));
    }
  } finally {
    await task.destroy();
  }
  return lines;
}

export async function readPdfTerms(bytes: ArrayBuffer | Uint8Array): Promise<PaperResult> {
  let lines: string[];
  try {
    lines = await extractPdfLines(bytes);
  } catch (e) {
    const err = e as Error;
    return { ok: false, reason: "unreadable", message: "Yeh PDF khul nahi payi", detail: `${err?.name}: ${err?.message}`.slice(0, 200) };
  }
  return paperResultFromLines(lines);
}
