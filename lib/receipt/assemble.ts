// Page images -> one A4 portrait PDF (pdf-lib, a non-AI library). Hindi is never drawn with pdf-lib's text API
// (it does not shape Devanagari); each page arrives as an image rendered by the browser's canvas.
import { PDFDocument } from "pdf-lib";

export const A4 = { width: 595.28, height: 841.89 }; // points

export type PageImage = { bytes: Uint8Array; kind: "jpg" | "png" };

export async function imagesToPdf(pages: PageImage[], meta: { title: string; createdAt: Date }): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title);
  doc.setCreator("Arth");
  doc.setProducer("Arth (pdf-lib)");
  doc.setCreationDate(meta.createdAt);
  doc.setModificationDate(meta.createdAt);
  for (const p of pages) {
    const img = p.kind === "jpg" ? await doc.embedJpg(p.bytes) : await doc.embedPng(p.bytes);
    const page = doc.addPage([A4.width, A4.height]);
    page.drawImage(img, { x: 0, y: 0, width: A4.width, height: A4.height });
  }
  return doc.save({ useObjectStreams: true });
}
