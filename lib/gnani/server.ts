// Server-only helpers. Never import this from a client component.
// GNANI_API_KEY is read here and never logged, returned or exposed to the browser.

export const GNANI_BASE_URL = "https://api.vachana.ai";

export function gnaniHeaders(): Record<string, string> | null {
  const key = process.env.GNANI_API_KEY;
  if (!key) return null;
  return { "X-API-Key-ID": key };
}

export function errorResponse(status: number, code: string, message: string): Response {
  return Response.json({ success: false, error: { type: code, message } }, { status });
}

export const AUDIO_EXTENSIONS = ["wav", "mp3", "ogg", "flac", "aac", "m4a"] as const;

/** Prisma detects format from the file name, so keep the real extension (default wav). */
export function safeAudioFilename(original: string | undefined): string {
  const ext = (original ?? "").split(".").pop()?.toLowerCase() ?? "";
  return `clip.${(AUDIO_EXTENSIONS as readonly string[]).includes(ext) ? ext : "wav"}`;
}
