// QR path: pure decoder (jsQR, not an AI model) + strict payload validation.
// Payload (CLAUDE.md section 5): {"v":1,"lender":"...","amt":30000,"rate":12,"n":12,"freq":"monthly","emi":2666,"fee":1500,"net":28500,"late":200}
import jsQR from "jsqr";
import type { Field, Frequency, Unit, Value } from "@/lib/engine/types";
import { finishTerms, paperValue, type PaperResult } from "./terms";

const BAD = (message = "Yeh QR LoanLens ka nahi hai"): PaperResult => ({ ok: false, reason: "bad_qr", message });
const FREQS: readonly string[] = ["monthly", "weekly", "fortnightly"];

type NumOpts = { min?: number; max?: number; int?: boolean };

function num(o: Record<string, unknown>, key: string, opts: NumOpts = {}): number | undefined | "bad" {
  if (!(key in o)) return undefined;
  const v = o[key];
  if (typeof v !== "number" || !Number.isFinite(v)) return "bad";
  if (v < (opts.min ?? 0) || (opts.max !== undefined && v > opts.max) || (opts.int && !Number.isInteger(v))) return "bad";
  return v;
}

export function termsFromQrPayload(text: string): PaperResult {
  if (text.length > 2000) return BAD();
  let o: unknown;
  try {
    o = JSON.parse(text);
  } catch {
    return BAD();
  }
  if (typeof o !== "object" || o === null || Array.isArray(o)) return BAD();
  const p = o as Record<string, unknown>;
  if (p.v !== 1) return BAD();

  const amt = num(p, "amt", { min: 1 });
  const rate = num(p, "rate", { max: 100 });
  const n = num(p, "n", { min: 1, max: 600, int: true });
  const emi = num(p, "emi", { min: 1 });
  const fee = num(p, "fee");
  const net = num(p, "net", { min: 1 });
  const late = num(p, "late");
  if ([amt, rate, n, emi, fee, net, late].includes("bad")) return BAD();
  if ("freq" in p && (typeof p.freq !== "string" || !FREQS.includes(p.freq))) return BAD();
  if ("lender" in p && (typeof p.lender !== "string" || p.lender.length > 80)) return BAD();
  const freq = p.freq as Frequency | undefined;

  const ev = (key: string) => `QR: ${key}=${JSON.stringify(p[key])}`;
  const vals: Value[] = [];
  const add = (field: Field, key: string, v: number | undefined | "bad", unit: Unit, f?: Frequency) => {
    if (typeof v === "number") vals.push(paperValue(field, v, unit, ev(key), f));
  };
  add("loan_amount", "amt", amt, "INR", "once");
  add("interest_rate", "rate", rate, "percent");
  // n counts instalments: its unit follows the payment frequency; unknown frequency = unknown tenure.
  if (typeof n === "number" && freq === "monthly") vals.push(paperValue("tenure", n, "months", ev("n")));
  if (typeof n === "number" && freq === "weekly") vals.push(paperValue("tenure", n, "weeks", ev("n")));
  if (typeof n === "number" && freq === "fortnightly") vals.push(paperValue("tenure", n * 2, "weeks", ev("n")));
  add("installment", "emi", emi, "INR", freq);
  add("processing_fee", "fee", fee, "INR", "once");
  add("net_disbursed", "net", net, "INR", "once");
  add("late_fee", "late", late, "INR");

  const { terms, missing } = finishTerms(vals);
  if (terms.length === 0) return BAD();
  return { ok: true, terms, missing, ambiguous: [], lender: typeof p.lender === "string" ? p.lender : undefined };
}

export function decodeQrFromImageData(data: Uint8ClampedArray, width: number, height: number): string | null {
  return jsQR(data, width, height, { inversionAttempts: "attemptBoth" })?.data ?? null;
}

/** Image upload (browser): file -> canvas -> QR text, or null when no QR is found. */
export async function decodeQrFromFile(file: Blob): Promise<string | null> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const img = ctx.getImageData(0, 0, w, h);
  return decodeQrFromImageData(img.data, w, h);
}

/**
 * Camera scan (browser): shows the back camera in `video` and resolves with the first QR text found.
 * Nothing is recorded or stored; the camera stops when it resolves, rejects or `signal` aborts.
 */
export function scanQrWithCamera(video: HTMLVideoElement, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    let stream: MediaStream | undefined;
    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    };
    signal.addEventListener("abort", () => {
      stop();
      reject(new DOMException("aborted", "AbortError"));
    });
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then(async (s) => {
        if (signal.aborted) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        await video.play();
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        const tick = () => {
          if (video.videoWidth && ctx) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const text = decodeQrFromImageData(img.data, canvas.width, canvas.height);
            if (text) {
              stop();
              resolve(text);
              return;
            }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch((e) => {
        stop();
        reject(e);
      });
  });
}
