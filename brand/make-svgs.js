const fs = require("fs");
const src = fs.readFileSync("brand/arth-logo-source.svg", "utf8");
const els = [...src.matchAll(/<(?:path|line|circle)\b[^>]*\/>/g)].map((m) => m[0]);
const attr = (el, k) => {
  const m = el.match(new RegExp(" " + k + '="([^"]*)"'));
  return m ? m[1] : null;
};
function bboxPath(el) {
  const d = attr(el, "d");
  const t = attr(el, "transform").match(/translate\(([-\d.]+),([-\d.]+)\) scale\(([-\d.]+),([-\d.]+)\)/);
  const [tx, ty, sx, sy] = t.slice(1).map(Number);
  const toks = d.match(/[MQLHVZ]|-?[\d.]+/g);
  let cmd, cx = 0, cy = 0, i = 0;
  const pts = [];
  const num = () => Number(toks[i++]);
  while (i < toks.length) {
    if (/[A-Z]/.test(toks[i])) cmd = toks[i++];
    if (cmd === "Z") continue;
    if (cmd === "H") { cx = num(); pts.push([cx, cy]); }
    else if (cmd === "V") { cy = num(); pts.push([cx, cy]); }
    else if (cmd === "Q") { num(); num(); cx = num(); cy = num(); pts.push([cx, cy]); }
    else { cx = num(); cy = num(); pts.push([cx, cy]); }
  }
  const xs = pts.map((p) => tx + p[0] * sx);
  const ys = pts.map((p) => ty + p[1] * sy);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
function bbox(el) {
  if (el.startsWith("<path")) return bboxPath(el);
  const n = (k) => Number(attr(el, k));
  if (el.startsWith("<line")) {
    const w = n("stroke-width") / 2;
    return [Math.min(n("x1"), n("x2")) - w, n("y1") - w, Math.max(n("x1"), n("x2")) + w, n("y1") + w];
  }
  return [n("cx") - n("r"), n("cy") - n("r"), n("cx") + n("r"), n("cy") + n("r")];
}
function build(list, name, pad) {
  const b = list.map(bbox);
  const x0 = Math.min(...b.map((v) => v[0])) - pad;
  const y0 = Math.min(...b.map((v) => v[1])) - pad;
  const x1 = Math.max(...b.map((v) => v[2])) + pad;
  const y1 = Math.max(...b.map((v) => v[3])) + pad;
  const w = Math.round(x1 - x0), h = Math.round(y1 - y0);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0.toFixed(0)} ${y0.toFixed(0)} ${w} ${h}" role="img" aria-label="Arth">${list.join("")}</svg>\n`;
  fs.writeFileSync(name, svg);
  console.log(name, x0.toFixed(0), y0.toFixed(0), w, h);
}
const mark = els.filter((e) => !e.includes('fill="#0F766E"'));
build(els, "public/arth-logo.svg", 12);
build(mark, "public/arth-mark.svg", 12);
