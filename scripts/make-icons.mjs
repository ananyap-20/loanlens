// Draws the Arth icon (blue rounded square, white magnifier with a rupee sign) with plain maths:
// signed-distance shapes + anti-aliasing, written as an RGBA PNG. No image AI, no dependencies.
// Run: node scripts/make-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const BLUE = [37, 99, 235];

// --- signed distances in unit space (0..1); negative = inside ---
const seg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
};
const stroke = (d, w) => d - w / 2; // line of width w around distance d
const roundedRect = (px, py, r) => {
  const qx = Math.abs(px - 0.5) - (0.5 - r), qy = Math.abs(py - 0.5) - (0.5 - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
// Right-hand half circle (the bowl of the rupee sign).
const bowl = (px, py, cx, cy, r) => {
  if (px >= cx) return Math.abs(Math.hypot(px - cx, py - cy) - r);
  return Math.min(Math.hypot(px - cx, py - (cy - r)), Math.hypot(px - cx, py - (cy + r)));
};

function whiteCoverage(x, y, s) {
  const lens = Math.abs(Math.hypot(x - 0.44, y - 0.44) - 0.27);
  const parts = [
    stroke(lens, 0.06),
    stroke(seg(x, y, 0.63, 0.63, 0.8, 0.8), 0.085), // handle
    stroke(seg(x, y, 0.34, 0.3, 0.55, 0.3), 0.04), // rupee: top bar
    stroke(seg(x, y, 0.34, 0.36, 0.55, 0.36), 0.04), // rupee: second bar
    stroke(bowl(x, y, 0.385, 0.37, 0.07), 0.04), // rupee: bowl
    stroke(seg(x, y, 0.355, 0.44, 0.5, 0.6), 0.045), // rupee: leg
  ];
  const d = Math.min(...parts);
  return Math.max(0, Math.min(1, 0.5 - d * s));
}

function render(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 3; // supersampling for smooth edges
  for (let j = 0; j < size; j++) {
    raw[j * (size * 4 + 1)] = 0;
    for (let i = 0; i < size; i++) {
      let a = 0, w = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const x = (i + (sx + 0.5) / SS) / size, y = (j + (sy + 0.5) / SS) / size;
          a += Math.max(0, Math.min(1, 0.5 - roundedRect(x, y, 0.22) * size));
          w += whiteCoverage(x, y, size);
        }
      a /= SS * SS; w /= SS * SS;
      const o = j * (size * 4 + 1) + 1 + i * 4;
      for (let c = 0; c < 3; c++) raw[o + c] = Math.round(BLUE[c] * (1 - w) + 255 * w);
      raw[o + 3] = Math.round(a * 255);
    }
  }
  return raw;
}

const table = Array.from({ length: 256 }, (_, k) => { let c = k; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = table[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const png = (s) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(s, 0); ihdr.writeUInt32BE(s, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(render(s))), chunk("IEND", Buffer.alloc(0))]);
};

mkdirSync("public/icons", { recursive: true });
for (const s of [192, 512]) writeFileSync(`public/icons/icon-${s}.png`, png(s));
console.log("icons done");
