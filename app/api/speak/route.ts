import { normaliseGnaniError } from "@/lib/gnani/errors";
import { GNANI_BASE_URL, errorResponse, gnaniHeaders } from "@/lib/gnani/server";

export const maxDuration = 30;

const MAX_TEXT = 1000;

type SpeakBody = {
  text?: unknown;
  voice?: unknown;
  model?: unknown;
  language?: unknown;
  speed?: unknown;
};

export async function POST(req: Request): Promise<Response> {
  const headers = gnaniHeaders();
  if (!headers) return errorResponse(500, "NO_API_KEY", "GNANI_API_KEY is not set on the server.");

  let b: SpeakBody;
  try {
    b = await req.json();
  } catch {
    return errorResponse(400, "BAD_REQUEST", "Expected JSON.");
  }
  if (typeof b.text !== "string" || !b.text.trim()) return errorResponse(400, "BAD_REQUEST", "Missing text.");
  if (b.text.length > MAX_TEXT) return errorResponse(400, "BAD_REQUEST", `Text longer than ${MAX_TEXT} characters.`);

  const speed = typeof b.speed === "number" ? b.speed : 1.0;
  if (speed < 0.85 || speed > 1.15) return errorResponse(400, "BAD_REQUEST", "speed must be 0.85–1.15.");

  const payload = {
    text: b.text,
    voice: typeof b.voice === "string" ? b.voice : "Nalini",
    model: typeof b.model === "string" ? b.model : "timbre-v2.5",
    language: typeof b.language === "string" ? b.language : "hi-IN",
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
