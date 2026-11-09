// Receipt PDF (browser only): draw each A4 page on a <canvas> (the browser shapes Devanagari correctly),
// encode as JPEG, then put the images into one PDF with pdf-lib. Page 1 = summary, page 2+ = evidence log.
import { imagesToPdf } from "./assemble";
import type { Cell, Evidence, Mark, Summary } from "./build";
import type { ReceiptStrings } from "./strings";

const PW = 1240; // A4 at 150 dpi
const PH = 1754;
const M = 64;
const FOOTER = 96;
const FONT = '"Noto Sans Devanagari", "Nirmala UI", "Mangal", "Segoe UI", Roboto, Arial, sans-serif';
const MONO = 'ui-monospace, Consolas, "Courier New", monospace';
const JPEG_QUALITY = 0.85;

const MARK: Record<Mark, { icon: string; bg: string; fg: string }> = {
  match: { icon: "✅", bg: "#dcfce7", fg: "#14532d" },
  conflict: { icon: "❌", bg: "#fee2e2", fg: "#7f1d1d" },
  unable: { icon: "❔", bg: "#f3f4f6", fg: "#374151" },
  not_mentioned: { icon: "❔", bg: "#f3f4f6", fg: "#374151" },
  warn: { icon: "⚠️", bg: "#fef3c7", fg: "#78350f" },
  none: { icon: "", bg: "#ffffff", fg: "#111827" },
};

type Page = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

class Pages {
  pages: Page[] = [];
  y = 0;
  constructor() {
    this.add();
  }
  get ctx() {
    return this.pages[this.pages.length - 1].ctx;
  }
  add() {
    const canvas = document.createElement("canvas");
    canvas.width = PW;
    canvas.height = PH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not available");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PW, PH);
    ctx.textBaseline = "top";
    this.pages.push({ canvas, ctx });
    this.y = M;
  }
  /** Start a new page if `h` more pixels do not fit above the footer. */
  ensure(h: number) {
    if (this.y + h > PH - FOOTER) this.add();
  }
}

function font(size: number, weight = 400, mono = false) {
  return `${weight} ${size}px ${mono ? MONO : FONT}`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, byChar = false): string[] {
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
  if (cur.trim()) out.push(cur);
  return out.length ? out : [""];
}

/** Draws wrapped text at (x, y); returns the height used. */
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, size: number, opts: { weight?: number; color?: string; mono?: boolean } = {}) {
  ctx.font = font(size, opts.weight ?? 400, opts.mono);
  ctx.fillStyle = opts.color ?? "#111827";
  const lines = wrap(ctx, s, maxW, opts.mono);
  const lh = Math.round(size * 1.38);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh));
  return lines.length * lh;
}

function measure(ctx: CanvasRenderingContext2D, s: string, maxW: number, size: number, mono = false) {
  ctx.font = font(size, 400, mono);
  return wrap(ctx, s, maxW, mono).length * Math.round(size * 1.38);
}

/** A heading: Hindi first, small English below. */
function heading(p: Pages, hi: string, en: string) {
  p.ensure(90);
  p.y += 18;
  p.y += text(p.ctx, hi, M, p.y, PW - 2 * M, 34, { weight: 800 });
  p.y += text(p.ctx, en, M, p.y, PW - 2 * M, 20, { color: "#4b5563" }) + 6;
}

// ------------------------------------------------------------------ page 1: summary

function drawCell(ctx: CanvasRenderingContext2D, c: Cell, x: number, y: number, w: number, h: number) {
  const m = MARK[c.mark];
  ctx.fillStyle = m.bg;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  let yy = y + 10;
  const label = m.icon ? `${m.icon} ${c.hi}` : c.hi;
  yy += text(ctx, label, x + 10, yy, w - 20, 25, { weight: 700, color: m.fg });
  if (c.en) text(ctx, c.en, x + 10, yy, w - 20, 17, { color: "#4b5563" });
}

function cellHeight(ctx: CanvasRenderingContext2D, c: Cell, w: number) {
  const m = MARK[c.mark];
  return 20 + measure(ctx, m.icon ? `${m.icon} ${c.hi}` : c.hi, w - 20, 25) + (c.en ? measure(ctx, c.en, w - 20, 17) : 0);
}

function drawSummary(p: Pages, s: Summary) {
  const ctx = p.ctx;
  // header band
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(0, 0, PW, 150);
  const t = s.strings;
  text(ctx, t.title, M, 26, PW - 2 * M, 54, { weight: 800, color: "#ffffff" });
  text(ctx, "Receipt · page 1: summary", M, 100, PW - 2 * M, 22, { color: "#dbeafe" });
  p.y = 172;
  p.y += text(ctx, `🕒 ${s.createdIST}`, M, p.y, PW - 2 * M, 26, { weight: 600 });
  if (s.lender) p.y += text(ctx, `🏦 ${s.lender}`, M, p.y, PW - 2 * M, 26);
  p.y += text(ctx, `👥 ${t.present}: ${s.presenceHi}  ·  present: ${s.presenceEn}`, M, p.y, PW - 2 * M, 24);
  p.y += text(ctx, `📄 ${t.docFingerprint} / document fingerprint: ${s.documentShort}…`, M, p.y, PW - 2 * M, 20, { color: "#4b5563" });
  p.y += 12;

  // outcome block
  if (s.outcome) {
    const ok = s.outcome === "passed";
    const h = 92;
    ctx.fillStyle = ok ? "#dcfce7" : "#fee2e2";
    ctx.fillRect(M, p.y, PW - 2 * M, h);
    ctx.fillStyle = ok ? "#16a34a" : "#dc2626";
    ctx.fillRect(M, p.y, 12, h);
    text(ctx, ok ? t.outcomePassed : t.outcomeStopped, M + 28, p.y + 12, PW - 2 * M - 40, 30, {
      weight: 800,
      color: ok ? "#14532d" : "#7f1d1d",
    });
    text(ctx, ok ? "Borrower explained the key terms in her own words (number-and-keyword check)" : "Stopped: do not sign yet", M + 28, p.y + 56, PW - 2 * M - 40, 18, {
      color: "#374151",
    });
    p.y += h + 18;
  }

  // table
  const cols = [250, 290, 290, 270]; // = PW - 2M = 1112 (rounded)
  const heads: [string, string][] = [
    [t.cols.item, "Item"],
    [t.cols.paper, "Paper"],
    [t.cols.agent, "Agent"],
    [t.cols.borrower, "Borrower"],
  ];
  let x = M;
  heads.forEach(([hi, en], i) => {
    ctx.fillStyle = "#1e3a8a";
    ctx.fillRect(x, p.y, cols[i], 70);
    text(ctx, hi, x + 10, p.y + 8, cols[i] - 20, 24, { weight: 800, color: "#ffffff" });
    text(ctx, en, x + 10, p.y + 42, cols[i] - 20, 17, { color: "#bfdbfe" });
    x += cols[i];
  });
  p.y += 70;
  for (const r of s.rows) {
    const item: Cell = { mark: "none", hi: r.hi, en: r.en };
    const cells = [item, r.paper, r.agent, r.borrower];
    const h = Math.max(78, ...cells.map((c, i) => cellHeight(ctx, c, cols[i])));
    p.ensure(h);
    x = M;
    cells.forEach((c, i) => {
      drawCell(p.ctx, c, x, p.y, cols[i], h);
      x += cols[i];
    });
    p.y += h;
  }
  p.y += 20;

  // questions box
  const qText = s.questions.map((q) => `• ${q}`);
  const qh = 80 + qText.reduce((sum, q) => sum + measure(ctx, q, PW - 2 * M - 40, 25), 0);
  p.ensure(qh);
  p.ctx.fillStyle = "#fffbeb";
  p.ctx.fillRect(M, p.y, PW - 2 * M, qh);
  p.ctx.strokeStyle = "#d97706";
  p.ctx.lineWidth = 4;
  p.ctx.strokeRect(M, p.y, PW - 2 * M, qh);
  let qy = p.y + 14;
  qy += text(p.ctx, t.questionsTitle, M + 20, qy, PW - 2 * M - 40, 28, { weight: 800, color: "#78350f" });
  qy += text(p.ctx, "Questions to ask before signing", M + 20, qy, PW - 2 * M - 40, 18, { color: "#92400e" }) + 6;
  for (const q of qText) qy += text(p.ctx, q, M + 20, qy, PW - 2 * M - 40, 25);
  p.y += qh + 18;

  // complaint path
  const ch = 40 + [...s.complaintHi].reduce((sum, c) => sum + measure(ctx, c, PW - 2 * M, 23), 0) + 30;
  p.ensure(ch);
  p.y += text(p.ctx, `${t.complaintTitle} · Where to complain`, M, p.y, PW - 2 * M, 26, { weight: 800 });
  for (const c of s.complaintHi) p.y += text(p.ctx, c, M, p.y, PW - 2 * M, 23);
  p.y += text(p.ctx, s.complaintEn.join("   "), M, p.y, PW - 2 * M, 17, { color: "#4b5563" });
}

// ------------------------------------------------------------------ page 2+: evidence log

function drawEvidence(p: Pages, e: Evidence, t: ReceiptStrings) {
  p.add();
  const ctx = () => p.ctx;
  ctx().fillStyle = "#1d4ed8";
  ctx().fillRect(0, 0, PW, 16);
  p.y = 40;
  p.y += text(ctx(), t.evidenceTitle, M, p.y, PW - 2 * M, 44, { weight: 800 });
  p.y += text(ctx(), `Evidence log · source: ${e.sourceEn}`, M, p.y, PW - 2 * M, 22, { color: "#4b5563" }) + 6;

  heading(p, t.termsTitle, "Terms on the paper (with the line printed on the paper)");
  for (const t of e.terms) {
    const h = measure(ctx(), `${t.hi} / ${t.en}: ${t.value}`, PW - 2 * M, 23) + measure(ctx(), `“${t.evidence}”`, PW - 2 * M - 24, 19) + 6;
    p.ensure(h);
    p.y += text(ctx(), `${t.hi} / ${t.en}: ${t.value}`, M, p.y, PW - 2 * M, 23, { weight: 600 });
    p.y += text(ctx(), `“${t.evidence}”`, M + 24, p.y, PW - 2 * M - 24, 19, { color: "#4b5563" }) + 6;
  }
  for (const m of e.missing) {
    p.ensure(34);
    p.y += text(ctx(), `❔ ${m}: not on the paper`, M, p.y, PW - 2 * M, 21, { color: "#374151" });
  }
  for (const m of e.ambiguous) {
    p.ensure(34);
    p.y += text(ctx(), `⚠️ ${m}: written twice, differently`, M, p.y, PW - 2 * M, 21, { color: "#78350f" });
  }

  if (e.comparisons.length) {
    heading(p, t.agentVsPaperTitle, "Agent vs paper (latest recording counts; all recordings are listed below)");
    for (const c of e.comparisons) {
      const lines = [
        `${c.en}: ${c.status}${c.attempts > 1 ? ` · ${c.attempts} recordings` : ""}`,
        `paper: “${c.paper}”`,
        `agent: “${c.agent}”`,
        ...(c.changed ? [`⚠️ ${t.agentChanged} · an earlier answer differed from the paper`] : []),
      ];
      const h = lines.reduce((s, l) => s + measure(ctx(), l, PW - 2 * M - 24, 20), 0) + 10;
      p.ensure(h);
      lines.forEach((l, i) => {
        p.y += text(ctx(), l, i ? M + 24 : M, p.y, PW - 2 * M - 24, i ? 19 : 21, {
          weight: i ? 400 : 700,
          color: l.startsWith("⚠️") ? "#78350f" : i ? "#374151" : "#111827",
        });
      });
      p.y += 10;
    }
  }

  if (e.teachback.length) {
    heading(p, t.ownWordsTitle, "Borrower's own words (number-and-keyword check)");
    for (const t of e.teachback) {
      const lines = [`${t.en}: ${t.status}`, `paper: “${t.paper}”`, ...t.answers.map((a, k) => `try ${k + 1}: “${a}”`)];
      const h = lines.reduce((s, l) => s + measure(ctx(), l, PW - 2 * M - 24, 20), 0) + 10;
      p.ensure(h);
      lines.forEach((l, i) => {
        p.y += text(ctx(), l, i ? M + 24 : M, p.y, PW - 2 * M - 24, i ? 19 : 21, { weight: i ? 400 : 700, color: i ? "#374151" : "#111827" });
      });
      p.y += 10;
    }
  }

  // recordings table
  heading(p, t.recordingsTitle, "All recordings, original and re-recordings · SHA-256 first 16 characters");
  const cols = [50, 150, 210, 150, 80, 300, 172];
  const heads = ["#", `${t.recCols.who} / who`, `${t.recCols.what} / what`, `${t.recCols.time} / time`, "sec", `${t.recCols.transcript} / transcript`, "SHA-256 (16)"];
  const drawRow = (vals: string[], header: boolean) => {
    const sizes = vals.map((_, i) => (header ? 18 : i === 6 ? 15 : 17));
    const h = Math.max(header ? 40 : 34, ...vals.map((v, i) => 14 + measure(ctx(), v, cols[i] - 14, sizes[i], i === 6 && !header)));
    p.ensure(h);
    let x = M;
    vals.forEach((v, i) => {
      ctx().fillStyle = header ? "#e5e7eb" : "#ffffff";
      ctx().fillRect(x, p.y, cols[i], h);
      ctx().strokeStyle = "#d1d5db";
      ctx().lineWidth = 1;
      ctx().strokeRect(x, p.y, cols[i], h);
      text(ctx(), v, x + 7, p.y + 7, cols[i] - 14, sizes[i], { weight: header ? 700 : 400, mono: i === 6 && !header });
      x += cols[i];
    });
    p.y += h;
  };
  drawRow(heads, true);
  if (e.recordings.length === 0) drawRow(["", "", "no recordings", "", "", "", ""], false);
  for (const r of e.recordings) {
    drawRow([String(r.id), `${r.whoHi} / ${r.whoEn}`, r.what, r.time, r.durationSec.toFixed(1), r.transcript, r.sha16], false);
  }

  // full fingerprints
  heading(p, t.fullFingerprintsTitle, "Full SHA-256 fingerprints");
  const full = [`document: ${e.documentSha256 ?? "not available"}`, ...e.recordings.map((r) => `#${r.id}: ${r.sha256}`)];
  for (const f of full) {
    p.ensure(30);
    p.y += text(ctx(), f, M, p.y, PW - 2 * M, 16, { mono: true, color: "#374151" });
  }
}

function drawFooters(p: Pages, s: Summary) {
  const n = p.pages.length;
  p.pages.forEach(({ ctx }, i) => {
    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(0, PH - FOOTER + 10, PW, FOOTER - 10);
    ctx.fillStyle = "#d97706";
    ctx.fillRect(0, PH - FOOTER + 10, PW, 4);
    text(ctx, s.labelHi, M, PH - FOOTER + 22, PW - 2 * M - 120, 20, { weight: 700, color: "#78350f" });
    text(ctx, s.label, M, PH - FOOTER + 52, PW - 2 * M - 120, 17, { color: "#78350f" });
    ctx.font = font(24, 800);
    ctx.fillStyle = "#111827";
    const pn = `${i + 1}/${n}`;
    ctx.fillText(pn, PW - M - ctx.measureText(pn).width, PH - FOOTER + 34);
  });
}

const toJpeg = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the page"))), "image/jpeg", JPEG_QUALITY));

export type ReceiptPdf = { pdf: Blob; pages: number; previews: string[] };

export async function makeReceiptPdf(summary: Summary, evidence: Evidence, createdAt: Date): Promise<ReceiptPdf> {
  const p = new Pages();
  drawSummary(p, summary);
  drawEvidence(p, evidence, summary.strings);
  drawFooters(p, summary);
  const jpegs = await Promise.all(p.pages.map((pg) => toJpeg(pg.canvas)));
  const bytes = await imagesToPdf(
    await Promise.all(jpegs.map(async (b) => ({ bytes: new Uint8Array(await b.arrayBuffer()), kind: "jpg" as const }))),
    { title: "LoanLens receipt", createdAt },
  );
  return {
    pdf: new Blob([bytes as BlobPart], { type: "application/pdf" }),
    pages: p.pages.length,
    previews: p.pages.map((pg) => pg.canvas.toDataURL("image/jpeg", 0.6)),
  };
}
