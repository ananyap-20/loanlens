// Browser helpers shared by the flow and the /paper test page: a picked/shared file -> PaperResult.
import { readPdfTerms } from "./pdf";
import { decodeQrFromFile, termsFromQrPayload } from "./qr";
import type { PaperResult } from "./terms";

export function isPdf(file: Blob): boolean {
  return file.type === "application/pdf" || ("name" in file && String((file as File).name).toLowerCase().endsWith(".pdf"));
}

/** PDF -> text rules; anything else is treated as a photo of the QR. */
export async function readPaperFile(file: Blob): Promise<PaperResult> {
  if (isPdf(file)) return readPdfTerms(await file.arrayBuffer());
  try {
    const text = await decodeQrFromFile(file);
    if (!text) return { ok: false, reason: "bad_qr", message: "Is tasveer mein QR nahi mila" };
    return termsFromQrPayload(text);
  } catch (e) {
    const err = e as Error;
    return { ok: false, reason: "unreadable", message: "Yeh file khul nahi payi", detail: `${err?.name}: ${err?.message}` };
  }
}

/** A file shared to Arth (Web Share Target) is parked once by public/sw.js; read it and delete it. */
export async function takeSharedFile(): Promise<Blob | null> {
  if (typeof caches === "undefined") return null;
  const cache = await caches.open("loanlens-shared");
  const res = await cache.match("/shared-file");
  if (!res) return null;
  const blob = await res.blob();
  await cache.delete("/shared-file"); // do not keep the document around
  return blob;
}
