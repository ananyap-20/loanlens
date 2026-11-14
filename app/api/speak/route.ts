import { connection } from "next/server";
import { TIMBRE_LANGUAGES, TIMBRE_MODELS, TIMBRE_VOICES, notAllowed } from "@/lib/gnani/allowed";
import { normaliseGnaniError } from "@/lib/gnani/errors";
import { GNANI_BASE_URL, errorResponse, gnaniHeaders } from "@/lib/gnani/server";
import { checkLimit, speakLimiter, speakTextProblem, speedProblem } from "@/lib/server/rateLimit";

export const maxDuration = 30;

/** Warm-up ping from the app on page load: wakes this function, calls nothing at Gnani, costs nothing. */
export async function GET(): Promise<Response> {
  await connection();
  return new Response(null, { status: 204 });
}

type SpeakBody = {
  text?: unknown;
  voice?: unknown;
  model?: unknown;
  language?: unknown;
  speed?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  const limited = checkLimit(speakLimiter, req);
  if (limited) return limited;

  const headers = gnaniHeaders();
  if (!headers) return errorResponse(500, "NO_API_KEY", "GNANI_API_KEY is not set on the server.");

  let b: SpeakBody;
  try {
    b = await req.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Expected JSON.");
  }
  if (typeof b.text !== "string" || !b.text.trim()) return errorResponse(400, "BAD_REQUEST", "Missing text.");
  const tooLong = speakTextProblem(b.text);
  if (tooLong) return errorResponse(tooLong.status, tooLong.code, tooLong.message);

  const speed = typeof b.speed === "number" ? b.speed : 1.0;
  const badSpeed = speedProblem(speed);
  if (badSpeed) return errorResponse(badSpeed.status, badSpeed.code, badSpeed.message);

  const voice = typeof b.voice === "string" ? b.voice : "Nalini";
  const model = typeof b.model === "string" ? b.model : "timbre-v2.5";
  const language = typeof b.language === "string" ? b.language : "hi-IN";
  const refused =
    notAllowed("voice", voice, TIMBRE_VOICES) ??
    notAllowed("model", model, TIMBRE_MODELS) ??
    notAllowed("language", language, TIMBRE_LANGUAGES);
  if (refused) return errorResponse(400, "BAD_REQUEST", refused);

  const payload = {
    text: b.text,
    voice,
    model,
    language,
    speed,
    audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, container: "mp3", bitrate: "64k" },
  };

  let upstream: Response;
  try {
    upstream = await fetch(`${GNANI_BASE_URL}/api/v1/tts/inference`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    return errorResponse(502, "NETWORK", "Could not reach Gnani.");
  }

  const ctype = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || ctype.includes("application/json")) {
    let body: unknown = null;
    try {
      body = await upstream.json();
    } catch {
      /* non-JSON */
    }
    const e = normaliseGnaniError(upstream.status, body);
    return errorResponse(e.status, e.code, e.message);
  }

  const audio = await upstream.arrayBuffer();
  return new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
