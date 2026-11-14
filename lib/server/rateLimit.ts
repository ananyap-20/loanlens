// Abuse protection for our two Gnani routes, so nobody can drain the Gnani credits. No dependency, no database.
//
// BEST-EFFORT ONLY: the limiter lives in this server instance's memory. On Vercel each serverless instance keeps
// its own counts and loses them when it is recycled, so a determined caller spread across instances can exceed
// these numbers. It stops casual abuse and runaway loops; it is not a security boundary.
//
// Never logs anything: no IP, no audio, no text, no request body, no API key.

/** Sliding window length for both routes. */
export const RATE_WINDOW_MS = 5 * 60 * 1000;
/** Max /api/transcribe requests per IP per window. */
export const TRANSCRIBE_LIMIT = 60;
/** Max /api/speak requests per IP per window. */
export const SPEAK_LIMIT = 60;

/** Hard caps. 30 s of 16 kHz mono 16-bit WAV is about 960 KB, so 2 MB leaves room. */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
/** The longest fixed prompt is under 600 characters; live speech is sent in chunks of at most 140. */
export const MAX_SPEAK_CHARS = 600;
export const MIN_SPEED = 0.85;
export const MAX_SPEED = 1.15;

/** Error code our own limiter returns with 429. The client queue does NOT retry it (Gnani's RATE_LIMITED it does). */
export const APP_RATE_LIMIT_CODE = "APP_RATE_LIMIT";

/** Used when no x-forwarded-for header is present (e.g. local runs): everyone shares one bucket. */
export const UNKNOWN_IP = "unknown";

export type LimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/** A sliding-window limiter: at most `limit` hits per key within any `windowMs`. `now` is injectable for tests. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let lastSweep = 0;

  function sweep(t: number) {
    // Drop idle keys now and then so memory does not grow with every IP ever seen.
    if (t - lastSweep < windowMs) return;
    lastSweep = t;
    for (const [k, list] of hits) if (!list.length || list[list.length - 1] <= t - windowMs) hits.delete(k);
  }

  return {
    hit(key: string): LimitResult {
      const t = now();
      sweep(t);
      const recent = (hits.get(key) ?? []).filter((ts) => ts > t - windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const retryAfterSeconds = Math.max(1, Math.ceil((recent[0] + windowMs - t) / 1000));
        return { ok: false, retryAfterSeconds };
      }
      recent.push(t);
      hits.set(key, recent);
      return { ok: true };
    },
  };
}

/** First IP in x-forwarded-for (the client, as set by Vercel), else a constant. */
export function clientIp(headers: Headers): string {
  const first = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first ? first : UNKNOWN_IP;
}

/** Limits are skipped only under `next dev`, so the local clip generator and eval runs are not blocked. */
export function limitsEnabled(env: string | undefined = process.env.NODE_ENV): boolean {
  return env !== "development";
}

/** 429 in the same JSON error shape the client already reads ({success:false, error:{type,message}}). */
export function rateLimitedResponse(retryAfterSeconds: number): Response {
  return Response.json(
    { success: false, error: { type: APP_RATE_LIMIT_CODE, message: `Too many requests. Try again in ${retryAfterSeconds} seconds.` } },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
  );
}

/** Pure size checks: null = fine, otherwise the reason to refuse (413 for size, 400 for a bad speed). */
export type CapProblem = { status: 400 | 413; code: string; message: string };

export function audioSizeProblem(bytes: number): CapProblem | null {
  return bytes > MAX_AUDIO_BYTES ? { status: 413, code: "TOO_LARGE", message: "Audio file larger than 2 MB." } : null;
}

export function speakTextProblem(text: string): CapProblem | null {
  return text.length > MAX_SPEAK_CHARS
    ? { status: 413, code: "TOO_LARGE", message: `Text longer than ${MAX_SPEAK_CHARS} characters.` }
    : null;
}

export function speedProblem(speed: number): CapProblem | null {
  return Number.isFinite(speed) && speed >= MIN_SPEED && speed <= MAX_SPEED
    ? null
    : { status: 400, code: "BAD_REQUEST", message: `speed must be ${MIN_SPEED}–${MAX_SPEED}.` };
}

// One limiter per route for this server instance.
export const transcribeLimiter = createRateLimiter(TRANSCRIBE_LIMIT, RATE_WINDOW_MS);
export const speakLimiter = createRateLimiter(SPEAK_LIMIT, RATE_WINDOW_MS);

/** Route helper: a 429 Response when this request is over the limit, otherwise null. */
export function checkLimit(limiter: ReturnType<typeof createRateLimiter>, req: Request): Response | null {
  if (!limitsEnabled()) return null;
  const r = limiter.hit(clientIp(req.headers));
  return r.ok ? null : rateLimitedResponse(r.retryAfterSeconds);
}
