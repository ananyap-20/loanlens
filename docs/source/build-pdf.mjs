// Builds Arth_Thinking_Behind_It.pdf (repo root) from thinking-behind-arth.html with a local headless Chrome or Edge
// (a plain browser print; no AI). Run from the repo root:  node docs/source/build-pdf.mjs
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..", "..");
const out = join(root, "Arth_Thinking_Behind_It.pdf");

// The HTML is self-contained (the logo is inlined in cream for the dark header), so it also opens as-is.
const html = readFileSync(join(import.meta.dirname, "thinking-behind-arth.html"), "utf8");

const work = mkdtempSync(join(tmpdir(), "arth-pdf-"));
const page = join(work, "doc.html");
writeFileSync(page, html, "utf8");

const browsers = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].filter(Boolean);
const browser = browsers.find((b) => existsSync(b));
if (!browser) throw new Error("No Chrome or Edge found; set CHROME_PATH.");

/** Runs the headless browser once and waits for `file` (Edge can return before the file is written). */
async function render(file, args, url) {
  rmSync(file, { force: true }); // the browser can silently keep an old file, so start clean and check below
  execFileSync(browser, ["--headless=new", "--disable-gpu", "--virtual-time-budget=8000",
    `--user-data-dir=${join(work, "profile-" + Date.now())}`, ...args, url], { stdio: "ignore" });
  const until = Date.now() + 20000;
  while (!existsSync(file) && Date.now() < until) await new Promise((r) => setTimeout(r, 250));
  if (!existsSync(file)) throw new Error(`The browser did not write ${file}.`);
  console.log("wrote", file);
}

const url = pathToFileURL(page).href;
await render(out, ["--no-pdf-header-footer", `--print-to-pdf=${out}`], url);
// README preview: page 1 only, as an image (A4 at 794 x 1123 CSS px, drawn at 1.5x for sharpness).
const cover = join(root, "docs", "images", "thinking-cover.png");
mkdirSync(dirname(cover), { recursive: true });
await render(cover, ["--hide-scrollbars", "--window-size=794,1123", "--force-device-scale-factor=1.5", `--screenshot=${cover}`], url + "#cover");

try {
  rmSync(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
} catch {
  /* Edge may still hold its temp profile for a moment; it is only a temp folder */
}
