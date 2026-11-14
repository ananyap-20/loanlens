import { connection } from "next/server";
import { PRISMA_FORMATS, PRISMA_LANGUAGES, PRISMA_MODELS, notAllowed } from "@/lib/gnani/allowed";
import { normaliseGnaniError } from "@/lib/gnani/errors";
import { GNANI_BASE_URL, errorResponse, gnaniHeaders, safeAudioFilename } from "@/lib/gnani/server";
import { MAX_AUDIO_BYTES, audioSizeProblem, checkLimit, transcribeLimiter } from "@/lib/server/rateLimit";

export const maxDuration = 30;

/** Warm-up ping from the app on page load: wakes this function, calls nothing at Gnani, costs nothing. */
export async function GET(): Promise<Response> {
  await connection();
  return new Response(null, { status: 204 });
}

const KEYTERMS = ["processing fee", "EMI", "किस्त", "बीमा", "ब्याज", "लोन", "KFS", "penalty"];
const TOPIC = "A loan agent explains loan amount, EMI, processing fee, tenure and penalties.";
const MULTIPART_SLACK = 64 * 1024; // form boundaries and the small text fields around the audio

export async function POST(req: Request): Promise<Response> {
  const limited = checkLimit(transcribeLimiter, req);
  if (limited) return limited;
  // Refuse an oversized upload before reading it, when the size is declared.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_AUDIO_BYTES + MULTIPART_SLACK) return errorResponse(413, "TOO_LARGE", "Audio file larger than 2 MB.");

  const headers = gnaniHeaders();
  if (!headers) return errorResponse(500, "NO_API_KEY", "GNANI_API_KEY is not set on the server.");

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Expected multipart/form-data.");
  }
  const file = incoming.get("audio_file");
  if (!(file instanceof File)) return errorResponse(400, "BAD_REQUEST", "Missing audio_file.");
  const tooBig = audioSizeProblem(file.size);
  if (tooBig) return errorResponse(tooBig.status, tooBig.code, tooBig.message);

  // Defaults per CLAUDE.md section 4; a caller may pass model="" to use v2.5.
  const model = (incoming.get("model") as string | null) ?? "prisma-v3.0";
  const language = (incoming.get("language_code") as string | null) ?? "hi-IN,en-IN";
  const format = (incoming.get("format") as string | null) ?? "transcribe";
  const refused =
    notAllowed("model", model, PRISMA_MODELS) ??
    notAllowed("language_code", language, PRISMA_LANGUAGES) ??
    notAllowed("format", format, PRISMA_FORMATS);
  if (refused) return errorResponse(400, "BAD_REQUEST", refused);

  const out = new FormData();
  out.append("audio_file", file, safeAudioFilename(file.name));
  out.append("language_code", language);
  out.append("format", format);
  if (model) {
    out.append("model", model);
    if (model === "prisma-v3.0") {
      out.append("keyterms", JSON.stringify(KEYTERMS));
      out.append("topic", TOPIC);
      // Call check: the transcript of the previous chunk (prisma-v3.0, up to 1,600 characters per docs.gnani.ai).
      const previous = incoming.get("previous_text");
      if (typeof previous === "string" && previous.trim()) out.append("previous_text", previous.trim().slice(-1600));
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${GNANI_BASE_URL}/stt/v3`, { method: "POST", headers, body: out });
  } catch {
    return errorResponse(502, "NETWORK", "Could not reach Gnani.");
  }

  const text = await upstream.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* non-JSON upstream body */
  }

  const failed =
    !upstream.ok || (typeof body === "object" && body !== null && (body as { success?: unknown }).success === false);
  if (failed) {
    const e = normaliseGnaniError(upstream.status, body);
    return errorResponse(e.status, e.code, e.message);
  }
  // Success: pass the real Gnani JSON through unchanged (transcript may be "" for silence).
  return Response.json(body, { status: 200 });
}
