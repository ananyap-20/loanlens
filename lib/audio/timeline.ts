// One continuous playback timeline on an AudioContext clock (pure). Each chunk is started the moment the
// previous one ends (plus a tiny gap); a chunk that arrives late starts as soon as it is ready.
export class Timeline {
  private cursor = 0;
  constructor(
    readonly gap = 0.03, // seconds between chunks (on top of the few ms of padding kept by trimming)
    readonly lead = 0.02, // seconds between "now" and the earliest possible start
  ) {}

  /** Start time (seconds on the context clock) for a chunk of `duration` seconds, given the current clock `now`. */
  schedule(duration: number, now: number): number {
    const start = Math.max(now + this.lead, this.cursor);
    this.cursor = start + duration + this.gap;
    return start;
  }

  /** When everything scheduled so far ends. */
  get end(): number {
    return this.cursor;
  }
}
