// Normalises the three Gnani error shapes (CLAUDE.md section 4) into one.
// Pure function: never receives the API key, audio or document text.

export type GnaniError = {
  status: number; // HTTP status to return to the browser
  code: string; // e.g. "RATE_LIMITED", "SCOPE_NOT_ALLOWED", "stt_error", "UNKNOWN"
  message: string;
};

const DEFAULT_CODES: Record<number, string> = {
  401: "UNAUTHORIZED",
  402: "NO_CREDIT",
  403: "SCOPE_NOT_ALLOWED",
  429: "RATE_LIMITED",
};

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function normaliseGnaniError(httpStatus: number, body: unknown): GnaniError {
  let code: string | undefined;
  let message: string | undefined;
  let status = httpStatus;

  if (isObj(body)) {
    // Auth / rate limit: { detail: { error_code, message, status_code } }
    if (isObj(body.detail)) {
      const d = body.detail;
      if (typeof d.error_code === "string") code = d.error_code;
      if (typeof d.message === "string") message = d.message;
      if (typeof d.status_code === "number") status = d.status_code;
    } else if (typeof body.detail === "string") {
      message = body.detail;
    }
    // STT: { success:false, error:{ type, message } }
    if (isObj(body.error)) {
      const e = body.error;
      if (typeof e.type === "string") code = code ?? e.type;
      if (typeof e.message === "string") message = message ?? e.message;
    }
    // TTS: { success:false, message, status_code }
    if (typeof body.message === "string") message = message ?? body.message;
    if (typeof body.status_code === "number" && httpStatus < 400) status = body.status_code;
  }

  if (status < 400) status = 502; // upstream said "error" with a 2xx
  return {
    status,
    code: code ?? DEFAULT_CODES[status] ?? "UNKNOWN",
    message: message ?? `Gnani request failed (HTTP ${httpStatus})`,
  };
}
