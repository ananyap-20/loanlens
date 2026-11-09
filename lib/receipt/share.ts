// Share the receipt file with the Web Share API (Android: WhatsApp etc.); fall back to a download.
export type ShareOutcome = "shared" | "downloaded" | "cancelled";

export async function shareOrDownload(file: Blob, filename: string, nav: Navigator = navigator): Promise<ShareOutcome> {
  const f = new File([file], filename, { type: file.type || "application/pdf" });
  if (typeof nav.canShare === "function" && nav.canShare({ files: [f] })) {
    try {
      await nav.share({ files: [f], title: "LoanLens receipt" });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled"; // the user closed the share sheet
      // any other share failure: fall through to the download
    }
  }
  const url = URL.createObjectURL(f);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}
