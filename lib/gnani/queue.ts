// Client-side Gnani request queue (CLAUDE.md section 4):
//  - exactly ONE request in flight at a time (Gnani can answer 429 "Only 1 active request at a time")
//  - retry with exponential backoff on 429 only (max 4 retries: 1 s, 2 s, 4 s, 8 s)
//  - 30 s timeout per attempt; a timeout is NOT retried (the call may already have used credit)
//  - in-memory cache of speak() results, so repeated prompts cost one Timbre call
// Talks only to our own /api routes; the Gnani key never reaches the browser.

export class GnaniClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "GnaniClientError";
  }
}

export type SpeakOptions = { voice?: string; model?: string; language?: string; speed?: number };
export type TranscribeResult = { transcript: string; model?: string; detectedLanguage?: string; raw: unknown };

export type QueueConfig = {
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
};

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function createGnaniClient(config: QueueConfig = {}) {
  const fetchImpl: typeof fetch = config.fetchImpl ?? ((...a) => fetch(...a));
  const sleep = config.sleep ?? realSleep;
  const timeoutMs = config.timeoutMs ?? 30_000;
  const maxRetries = config.maxRetries ?? 4;
  const baseDelayMs = config.baseDelayMs ?? 1000;

  // One-at-a-time queue: each task starts only after the previous one has settled.
  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task);
    tail = run.catch(() => undefined);
    return run;
  }

  async function errorFrom(res: Response): Promise<GnaniClientError> {
    let code = "UNKNOWN";
    let message = `Request failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      if (body?.error?.type) code = String(body.error.type);
      if (body?.error?.message) message = String(body.error.message);
    } catch {
      /* non-JSON error body */
    }
    return new GnaniClientError(res.status, code, message);
  }

  /** One logical call: attempts + 429 backoff. Runs inside the queue slot. */
  async function callWithRetry(makeRequest: () => { url: string; init: RequestInit }): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      const { url, init } = makeRequest();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchImpl(url, { ...init, signal: controller.signal });
      } catch (e) {
        if (controller.signal.aborted) {
          throw new GnaniClientError(0, "TIMEOUT", `No answer within ${Math.round(timeoutMs / 1000)} seconds.`);
        }
        throw new GnaniClientError(0, "NETWORK", e instanceof Error ? e.message : "Network error");
      } finally {
        clearTimeout(timer);
      }

      if (res.status === 429 && attempt < maxRetries) {
        await sleep(baseDelayMs * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw await errorFrom(res);
      return res;
    }
  }

  const speakCache = new Map<string, Blob>();
  const speakKey = (text: string, o: SpeakOptions) =>
    JSON.stringify([text, o.voice ?? "", o.model ?? "", o.language ?? "", o.speed ?? 1]);

  return {
    /** Audio -> transcript through /api/transcribe. Keep the real filename extension (clip.wav from the recorder). */
    transcribe(audio: Blob, filename = "clip.wav", opts: { language?: string } = {}): Promise<TranscribeResult> {
      return enqueue(async () => {
        const res = await callWithRetry(() => {
          const fd = new FormData();
          fd.append("audio_file", audio, filename);
          if (opts.language) fd.append("language_code", opts.language); // omitted = server default (hi-IN,en-IN)
          return { url: "/api/transcribe", init: { method: "POST", body: fd } };
        });
        const raw = await res.json();
        return {
          transcript: typeof raw?.transcript === "string" ? raw.transcript : "",
          model: typeof raw?.model === "string" ? raw.model : undefined,
          detectedLanguage: typeof raw?.detected_language_code === "string" ? raw.detected_language_code : undefined,
          raw,
        };
      });
    },

    /** Text -> mp3 Blob through /api/speak. Identical requests are served from memory. */
    speak(text: string, options: SpeakOptions = {}): Promise<Blob> {
      const key = speakKey(text, options);
      return enqueue(async () => {
        const cached = speakCache.get(key);
        if (cached) return cached;
        const res = await callWithRetry(() => ({
          url: "/api/speak",
          init: {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, ...options }),
          },
        }));
        const blob = await res.blob();
        speakCache.set(key, blob);
        return blob;
      });
    },

    isSpeakCached(text: string, options: SpeakOptions = {}): boolean {
      return speakCache.has(speakKey(text, options));
    },

    /** Forget every cached Timbre clip ("sab mitaayein": some prompts contain the loan figures). */
    clearSpeakCache(): void {
      speakCache.clear();
    },
  };
}

export const gnani = createGnaniClient();
