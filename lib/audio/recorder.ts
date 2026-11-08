// Browser microphone recorder -> 16 kHz mono 16-bit WAV Blob named clip.wav (client-side only).
// Chrome's MediaRecorder gives WebM, which Prisma rejects, so we capture raw samples with the
// Web Audio API and encode the WAV ourselves (see wav.ts).
//
// Rules from CLAUDE.md: hard stop at 28 s (Prisma max is 30 s), recording state always visible
// (the UI reads `state`), nothing recorded in the background (mic released on stop and when the
// page is hidden). No audio is logged.

import { samplesToWavBlob, mergeChunks, TARGET_RATE } from "./wav";

export const MAX_RECORD_SECONDS = 28;

export type RecorderState =
  | "idle"
  | "requesting" // waiting for the browser's mic permission prompt
  | "recording"
  | "stopped"
  | "denied" // user (or browser policy) blocked the microphone
  | "no_mic" // no microphone found
  | "unsupported" // no getUserMedia / Web Audio, or page not on HTTPS/localhost
  | "error";

export type RecordedClip = {
  blob: Blob; // 16 kHz mono 16-bit WAV
  filename: "clip.wav";
  durationSec: number;
  sampleRate: typeof TARGET_RATE;
  capturedRate: number; // what the device actually captured at, before resampling
  autoStopped: boolean; // true if the 28 s limit (or page hiding) ended it, not the user
};

export type RecorderEvents = {
  onState?: (state: RecorderState, message?: string) => void;
  onTick?: (elapsedSec: number) => void;
  /** Fires once when a recording finishes, however it ended (stop button, 28 s limit, page hidden). */
  onClip?: (clip: RecordedClip) => void;
};

export class WavRecorder {
  state: RecorderState = "idle";

  private events: RecorderEvents;
  private maxSeconds: number;
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private mute: GainNode | null = null;
  private chunks: Float32Array[] = [];
  private sampleCount = 0;
  private capturedRate = 48000;
  private clip: RecordedClip | null = null;
  private autoStopped = false;
  private finished = true;
  private visibilityHandler = () => {
    if (document.hidden && this.state === "recording") this.finish(true);
  };

  constructor(events: RecorderEvents = {}, maxSeconds: number = MAX_RECORD_SECONDS) {
    this.events = events;
    this.maxSeconds = maxSeconds;
  }

  static isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof AudioContext !== "undefined"
    );
  }

  private setState(state: RecorderState, message?: string) {
    this.state = state;
    this.events.onState?.(state, message);
  }

  async start(): Promise<void> {
    if (this.state === "recording" || this.state === "requesting") return;
    if (!WavRecorder.isSupported()) {
      this.setState("unsupported", "This browser cannot record here. Open the HTTPS link in Chrome.");
      return;
    }

    this.clip = null;
    this.chunks = [];
    this.sampleCount = 0;
    this.autoStopped = false;
    this.setState("requesting");

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        this.setState("denied", "Microphone is blocked. Allow the microphone for this site and try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        this.setState("no_mic", "No microphone found.");
      } else {
        this.setState("error", e instanceof Error ? e.message : "Could not open the microphone.");
      }
      return;
    }

    try {
      this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.capturedRate = this.ctx.sampleRate;
      this.source = this.ctx.createMediaStreamSource(this.stream);
      // ScriptProcessor is deprecated but works in every Chrome/Android WebView we target
      // and needs no separate worklet file.
      this.processor = this.ctx.createScriptProcessor(4096, 1, 1);
      this.mute = this.ctx.createGain();
      this.mute.gain.value = 0; // must be connected to run, but we don't want to hear ourselves
      this.processor.onaudioprocess = (ev) => {
        if (this.finished) return;
        const data = ev.inputBuffer.getChannelData(0);
        this.chunks.push(new Float32Array(data)); // copy: the browser reuses the buffer
        this.sampleCount += data.length;
        const elapsed = this.sampleCount / this.capturedRate;
        this.events.onTick?.(Math.min(elapsed, this.maxSeconds));
        if (elapsed >= this.maxSeconds) this.finish(true);
      };
      this.source.connect(this.processor);
      this.processor.connect(this.mute);
      this.mute.connect(this.ctx.destination);
      this.finished = false;
      document.addEventListener("visibilitychange", this.visibilityHandler);
      this.setState("recording");
    } catch (e) {
      this.releaseHardware();
      this.setState("error", e instanceof Error ? e.message : "Could not start recording.");
    }
  }

  /** Stops (if recording) and returns the clip. Returns null if nothing was captured. */
  async stop(): Promise<RecordedClip | null> {
    if (this.state === "recording") this.finish(false);
    return this.clip;
  }

  /** Throw away any recording and release the microphone (used by "sab mitaayein"). */
  discard() {
    this.finished = true;
    this.releaseHardware();
    this.chunks = [];
    this.clip = null;
    if (this.state !== "unsupported") this.setState("idle");
  }

  private finish(auto: boolean) {
    if (this.finished) return;
    this.finished = true;
    this.autoStopped = auto;
    const capturedRate = this.capturedRate;
    const samples = mergeChunks(this.chunks);
    this.chunks = [];
    this.releaseHardware();

    // Trim to the hard limit in case the last buffer ran slightly over.
    const limited = samples.subarray(0, Math.floor(this.maxSeconds * capturedRate));
    if (limited.length === 0) {
      this.setState("error", "Nothing was recorded.");
      return;
    }
    const blob = samplesToWavBlob(limited, capturedRate);
    this.clip = {
      blob,
      filename: "clip.wav",
      durationSec: limited.length / capturedRate,
      sampleRate: TARGET_RATE,
      capturedRate,
      autoStopped: this.autoStopped,
    };
    this.setState("stopped");
    this.events.onClip?.(this.clip);
  }

  private releaseHardware() {
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    try {
      if (this.processor) this.processor.onaudioprocess = null;
      this.source?.disconnect();
      this.processor?.disconnect();
      this.mute?.disconnect();
    } catch {
      /* already disconnected */
    }
    this.stream?.getTracks().forEach((t) => t.stop()); // turns the browser's mic indicator off
    void this.ctx?.close().catch(() => undefined);
    this.stream = null;
    this.ctx = null;
    this.source = null;
    this.processor = null;
    this.mute = null;
  }
}
