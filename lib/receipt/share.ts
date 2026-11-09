// Share the receipt PNG with the Web Share API (Android: WhatsApp etc.); fall back to a download.
export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function shareOrDownload(png: Blob, filename: string, nav: Navigator = navigator): Promise<ShareOutcome> {
  const file = new File([png], filename, { type: "image/png" });
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "LoanLens receipt" });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled"; // the user closed the share sheet
      // any other share failure: fall through to the download
    }
  }
  const url = URL.createObjectURL(png);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}
