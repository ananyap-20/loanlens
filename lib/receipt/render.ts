// Draws receipt lines on a <canvas> and returns a PNG Blob (browser only). Two passes: measure, then draw.
import type { Line, LineStyle } from "./build";

const W = 1080;
const PAD = 48;
const FONT = '"Noto Sans Devanagari", "Nirmala UI", "Segoe UI", Roboto, Arial, sans-serif';
const MAX_HEIGHT = 30000; // stay under browser canvas limits

const STYLE: Record<LineStyle, { size: number; weight: string; color: string; family?: string; before: number; after: number }> = {
  title: { size: 54, weight: "800", color: "#1d4ed8", before: 0, after: 8 },
  label: { size: 30, weight: "700", color: "#7c2d12", before: 8, after: 8 },
  h: { size: 34, weight: "800", color: "#111827", before: 30, after: 6 },
  body: { size: 28, weight: "400", color: "#111827", before: 4, after: 2 },
  muted: { size: 24, weight: "400", color: "#4b5563", before: 0, after: 2 },
  mono: { size: 21, weight: "400", color: "#374151", family: "ui-monospace, Consolas, monospace", before: 2, after: 4 },
  match: { size: 28, weight: "700", color: "#15803d", before: 8, after: 2 },
  conflict: { size: 28, weight: "700", color: "#b91c1c", before: 8, after: 2 },
  neutral: { size: 28, weight: "700", color: "#4b5563", before: 8, after: 2 },
};

const font = (s: LineStyle) => `${STYLE[s].weight} ${STYLE[s].size}px ${STYLE[s].family ?? FONT}`;

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, byChar: boolean): string[] {
  const parts = byChar ? [...text] : text.split(/(\s+)/);
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    const next = cur + p;
    if (ctx.measureText(next).width <= max || cur === "") cur = next;
    else {
      out.push(cur.trimEnd());
      cur = p.trimStart();
    }
  }
  if (cur) out.push(cur);
  return out;
}

export async function renderReceiptPng(lines: Line[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  // Pass 1: layout.
  const laid: { text: string; style: LineStyle; y: number; boxH?: number }[] = [];
  let y = PAD;
  for (const l of lines) {
    const st = STYLE[l.style];
    ctx.font = font(l.style);
    const inner = l.style === "label" ? W - PAD * 2 - 32 : W - PAD * 2;
    const rows = wrap(ctx, l.text, inner, l.style === "mono");
    y += st.before;
    const lh = Math.round(st.size * 1.35);
    if (l.style === "label") {
      laid.push({ text: "", style: l.style, y, boxH: rows.length * lh + 24 });
      y += 12;
    }
    for (const r of rows) {
      laid.push({ text: r, style: l.style, y });
      y += lh;
    }
    if (l.style === "label") y += 12;
    y += st.after;
  }
  const height = Math.min(MAX_HEIGHT, y + PAD);

  // Pass 2: draw.
  canvas.width = W;
  canvas.height = height;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, height);
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(0, 0, W, 12);
  ctx.textBaseline = "top";
  for (const item of laid) {
    if (item.boxH) {
      ctx.fillStyle = "#fef3c7";
      ctx.strokeStyle = "#d97706";
      ctx.lineWidth = 3;
      ctx.fillRect(PAD, item.y, W - PAD * 2, item.boxH);
      ctx.strokeRect(PAD, item.y, W - PAD * 2, item.boxH);
      continue;
    }
    ctx.font = font(item.style);
    ctx.fillStyle = STYLE[item.style].color;
    ctx.fillText(item.text, item.style === "label" ? PAD + 16 : PAD, item.y);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the PNG"))), "image/png"),
  );
}
