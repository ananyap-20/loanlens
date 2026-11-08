// One-off generator (non-AI, deterministic): public/sample/kfs-sahyog.pdf and PWA icons.
// Run: node scripts/make-sample.mjs
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import QRCode from "qrcode";
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

// CLAUDE.md section 5 (fictional). Same text is in tests/fixtures/paper.ts (SAMPLE_QR_PAYLOAD).
const PAYLOAD =
  '{"v":1,"lender":"Sahyog Finance (fictional)","amt":30000,"rate":12,"n":12,"freq":"monthly","emi":2666,"fee":1500,"net":28500,"late":200}';

const pdf = await PDFDocument.create();
const page = pdf.addPage([595, 842]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

page.drawText("SAMPLE - FICTIONAL", { x: 90, y: 250, size: 62, font: bold, color: rgb(0.85, 0.85, 0.85), rotate: degrees(40) });
page.drawText("Key Fact Statement (sample)", { x: 50, y: 790, size: 20, font: bold });
page.drawText("Sahyog Finance (fictional) - Borrower: Sunita (sample)", { x: 50, y: 765, size: 11, font });

const lines = [
  "Loan amount: Rs. 30,000",
  "Interest rate: 12% per year (reducing balance)",
  "Tenure: 12 months",
  "Instalment: Rs. 2,666 per month",
  "Processing fee: Rs. 1,500 (deducted upfront)",
  "Net amount disbursed: Rs. 28,500",
  "Late fee: Rs. 200 per missed instalment",
  "Sum of instalments on this paper: Rs. 31,992",
];
lines.forEach((t, i) => page.drawText(t, { x: 50, y: 715 - i * 28, size: 14, font }));

page.drawText("Grievance Officer: Mr. A. Sample (fictional), grievance@sahyog.example", { x: 50, y: 470, size: 11, font });
page.drawText("Complaints can also be filed at cms.rbi.org.in", { x: 50, y: 452, size: 11, font });

const qr = QRCode.create(PAYLOAD, { errorCorrectionLevel: "M" });
const n = qr.modules.size;
const cell = 5, quiet = 4, side = (n + quiet * 2) * cell, ox = 50, oy = 140;
page.drawRectangle({ x: ox, y: oy, width: side, height: side, color: rgb(1, 1, 1) });
for (let r = 0; r < n; r++)
  for (let c = 0; c < n; c++)
    if (qr.modules.get(r, c))
      page.drawRectangle({ x: ox + (c + quiet) * cell, y: oy + side - (r + quiet + 1) * cell, width: cell, height: cell, color: rgb(0, 0, 0) });
page.drawText("Scan to read these terms in LoanLens", { x: ox + side + 15, y: oy + side / 2, size: 11, font });
page.drawText("QR payload: " + PAYLOAD, { x: 50, y: 60, size: 5, font });
mkdirSync("public/sample", { recursive: true });
writeFileSync("public/sample/kfs-sahyog.pdf", await pdf.save());

// Solid-colour PWA icons (valid PNG, written by hand).
const crcTable = Array.from({ length: 256 }, (_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const png = (s) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(s * 3).fill(0)]);
  for (let i = 0; i < s; i++) { row[1 + i * 3] = 37; row[2 + i * 3] = 99; row[3 + i * 3] = 235; }
  const raw = Buffer.concat(Array(s).fill(row));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", png(192));
writeFileSync("public/icons/icon-512.png", png(512));
console.log("done");
