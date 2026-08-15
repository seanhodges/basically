/**
 * What the IDE measures about one run of one program, and the readings derived
 * from it.
 *
 * Everything here is in the emulated machine's own terms. Durations are the time
 * the program would have taken on the hardware - frames divided by the machine's
 * frame rate - never elapsed time in the browser, so running at four times speed
 * on a 144Hz display reports exactly what running at real time on a 60Hz one
 * does. Per-line costs come back in CPU cycles, and are reported as shares of
 * the run's total rather than as cycle counts: machines are clocked at wildly
 * different rates, and the question "where did the time go" is asking for a
 * proportion.
 */
import type { LineCost, MachineMemoryStats } from '../dialects/types';
import {
  buildOutline,
  type OutlineCapabilities,
} from '../editor/programOutline';

/**
 * Emulated frames between memory samples - about twice a second on every
 * machine. Fine enough to catch a Commodore string-reclaim pause, which stalls
 * BASIC for the best part of a second, and coarse enough that reading the
 * machine's pointers is nothing next to running the frame.
 */
export const MEMORY_SAMPLE_FRAMES = 25;

/**
 * Memory samples retained. At {@link MEMORY_SAMPLE_FRAMES} that is around ten
 * minutes of emulated run time, past which the oldest are dropped and the
 * account says so - a long run keeps its recent shape and its peak rather than
 * growing a series without limit.
 */
export const MAX_MEMORY_SAMPLES = 1200;

/**
 * Emulated frames between pushes of the growing profile into the store.
 *
 * The run loop folds a frame in fifty times a second and more at a speed
 * multiple; the editor gutter it feeds is worth redrawing about twice a second.
 * Publishing on this cadence keeps the heat live enough to watch appear without
 * re-rendering the editor on every frame.
 */
export const PROFILE_PUBLISH_FRAMES = 25;

/** BASIC RAM in use at one moment of the run. */
export interface MemorySample {
  /** Emulated seconds since the run started. */
  at: number;
  used: number;
  free: number;
}

/** How much memory a run used, across the run rather than at the end of it. */
export interface MemoryProfile {
  /** The retained series, oldest first. */
  samples: MemorySample[];
  /** The greatest `used` at any point, including samples since dropped. */
  peakUsed: number;
  /** BASIC RAM the machine fitted (`used + free`), as last read. */
  totalBytes: number;
  /**
   * True once the run outlasted {@link MAX_MEMORY_SAMPLES} and `samples` covers
   * only its tail. The peak is still the whole run's.
   */
  partial: boolean;
}

/** Everything measured about the most recent run. */
export interface RunProfile {
  /** The buffer that ran: a scratch buffer's id, or null for the program. */
  bufferId: string | null;
  /** The BASIC line numbers the measured program had, so an edit can void it. */
  measuredLines: number[];
  /** Per-line costs, or null when the machine cannot report which line ran. */
  lines: LineCost[] | null;
  /** The memory account, or null when the machine cannot report its figures. */
  memory: MemoryProfile | null;
  /** Emulated seconds the run has lasted. */
  elapsed: number;
}

/** A line's measured cost, and what fraction of the run it accounts for. */
export interface LineShare {
  line: number;
  /** CPU cycles charged to the line. */
  cost: number;
  /** `cost` over the run's measured total, 0…1. */
  share: number;
}

/** A named routine or jump destination, with the run's cost summed over it. */
export interface RoutineShare {
  title: string;
  /** The line the routine starts at. */
  lineNo: number;
  /** Lines charged to it: from `lineNo` up to the next entry point. */
  through: number;
  share: number;
}

/**
 * Each line's share of the run, hottest first.
 *
 * Shares rather than cycle counts, because a share is what the question "where
 * did the time go" actually asks and it does not need the machine's clock rate
 * to be read. Lines that consumed nothing are absent, not zero: a
 * line that never ran is a different thing from one that ran cheaply, and the
 * editor draws the difference.
 */
export function lineShares(lines: readonly LineCost[]): LineShare[] {
  let total = 0;
  for (const l of lines) total += l.cost;
  if (total <= 0) return [];
  return lines
    .filter((l) => l.cost > 0)
    .map((l) => ({ ...l, share: l.cost / total }))
    .sort((a, b) => b.share - a.share || a.line - b.line);
}

/**
 * The run's cost summed over each routine and jump destination the outline can
 * identify, hottest first.
 *
 * A routine's extent is everything from its entry line up to the next entry
 * line, which is the only structure a BASIC program actually has - there is no
 * end-of-routine marker to read, and RETURN can appear anywhere. That makes this
 * a reading of the program's layout rather than of its call graph, and it is
 * still flat: a routine's figure is the time spent on its own lines, and the
 * routines it calls in turn are counted against themselves.
 */
export function routineShares(
  source: string,
  caps: OutlineCapabilities,
  shares: readonly LineShare[],
): RoutineShare[] {
  const entries = new Map<number, string>();
  for (const section of buildOutline(source, caps)) {
    for (const item of section.items) {
      // The first name wins: a line that is both a PROC definition and a GOSUB
      // target is one routine, and the outline lists the named form first.
      if (!entries.has(item.lineNo)) entries.set(item.lineNo, item.title);
    }
  }
  if (entries.size === 0) return [];

  const starts = [...entries.keys()].sort((a, b) => a - b);
  const out: RoutineShare[] = [];
  for (let i = 0; i < starts.length; i++) {
    const from = starts[i]!;
    const to = starts[i + 1] ?? Infinity;
    let share = 0;
    for (const s of shares) {
      if (s.line >= from && s.line < to) share += s.share;
    }
    out.push({
      title: entries.get(from)!,
      lineNo: from,
      through: Number.isFinite(to) ? to - 1 : from,
      share,
    });
  }
  return out.sort((a, b) => b.share - a.share || a.lineNo - b.lineNo);
}

/**
 * Bands of heat the editor draws, 1 for a line incidental to the run up to
 * {@link HEAT_LEVELS} for one that dominates it.
 */
export const HEAT_LEVELS = 5;

/** A line's heat, as the gutter draws it. */
export interface LineHeat {
  level: number;
  share: number;
}

/**
 * Each measured line's heat, keyed by BASIC line number.
 *
 * Scaled against the hottest line rather than against the whole run, so the
 * bands always span what this program actually did: a program whose work is
 * spread over fifty lines has no line above a few percent, and an absolute
 * scale would draw every one of them the same faint colour and answer nothing.
 *
 * Lines that consumed no measured time are absent rather than level zero. The
 * gutter leaves them unmarked, which is the honest reading - a line that never
 * ran is not a line that ran cheaply.
 */
export function lineHeat(shares: readonly LineShare[]): Map<number, LineHeat> {
  const out = new Map<number, LineHeat>();
  const max = shares.reduce((m, s) => Math.max(m, s.share), 0);
  if (max <= 0) return out;
  for (const s of shares) {
    const level = Math.min(
      HEAT_LEVELS,
      Math.max(1, Math.ceil((s.share / max) * HEAT_LEVELS)),
    );
    out.set(s.line, { level, share: s.share });
  }
  return out;
}

/**
 * Accumulates one run's measurements as it happens.
 *
 * Owned by the run loop, which drains the machine every frame and hands the
 * readings here. Anchored to the run: it is built when a run starts and thrown
 * away when the next one does, so a figure always describes a single execution
 * rather than an accumulation across several.
 */
export class RunProfiler {
  private readonly lines = new Map<number, number>();
  /** True once the machine has charged anything, so no costs reads as "none". */
  private measuredLineCosts = false;
  private samples: MemorySample[] = [];
  private peakUsed = 0;
  private totalBytes = 0;
  private partial = false;
  private frames = 0;
  private elapsed = 0;
  /** Frames since the last memory sample, so the cadence survives a slow frame. */
  private sinceSample = MEMORY_SAMPLE_FRAMES;
  /** True once any machine reading has arrived, memory or per-line. */
  private measuredMemory = false;

  constructor(
    /** The buffer this run belongs to; a scratch buffer's id, or null. */
    readonly bufferId: string | null,
    /** The BASIC line numbers the measured program had. */
    readonly measuredLines: readonly number[],
  ) {}

  /**
   * Fold in one emulated frame: the costs the machine charged since the last
   * drain, and - on the sampling cadence - what its BASIC pointers now say.
   *
   * `costs` is null on a machine that cannot report its executing line and
   * `memory` null on one that cannot report its RAM, which is how half a
   * profile is offered rather than none.
   */
  frame(
    costs: readonly LineCost[] | null,
    readMemory: () => MachineMemoryStats | null,
    frameHz: number,
  ): void {
    this.frames++;
    // Read every frame rather than cached, because the Amstrad derives its
    // frame rate from CRTC registers a program can reprogram mid-run.
    this.elapsed += 1 / frameHz;
    if (costs) {
      this.measuredLineCosts = true;
      for (const c of costs) {
        this.lines.set(c.line, (this.lines.get(c.line) ?? 0) + c.cost);
      }
    }
    if (++this.sinceSample < MEMORY_SAMPLE_FRAMES) return;
    this.sinceSample = 0;
    const stats = readMemory();
    if (!stats) return; // mid-boot, mid-injection, or a machine that can't say
    this.measuredMemory = true;
    this.peakUsed = Math.max(this.peakUsed, stats.used);
    this.totalBytes = stats.used + stats.free;
    this.samples.push({ at: this.elapsed, used: stats.used, free: stats.free });
    if (this.samples.length > MAX_MEMORY_SAMPLES) {
      // Keep the tail. The peak above is tracked separately for exactly this:
      // a run longer than the record still reports the most it ever used.
      this.samples = this.samples.slice(-MAX_MEMORY_SAMPLES);
      this.partial = true;
    }
  }

  /** Whether anything at all has been measured yet. */
  get measured(): boolean {
    return this.lines.size > 0 || this.measuredMemory;
  }

  /** Emulated frames folded in so far. */
  get frameCount(): number {
    return this.frames;
  }

  /** The profile as it stands, for the store and everything reading from it. */
  snapshot(): RunProfile {
    return {
      bufferId: this.bufferId,
      measuredLines: [...this.measuredLines],
      lines: this.measuredLineCosts
        ? [...this.lines].map(([line, cost]) => ({ line, cost }))
        : null,
      memory: this.measuredMemory
        ? {
            samples: [...this.samples],
            peakUsed: this.peakUsed,
            totalBytes: this.totalBytes,
            partial: this.partial,
          }
        : null,
      elapsed: this.elapsed,
    };
  }
}

/**
 * The BASIC line numbers a program has, in order.
 *
 * What a measured profile is checked against when the program is edited: costs
 * are keyed by line number, so they stay meaningful through a change that leaves
 * the same lines in place and stop meaning anything the moment a line is added,
 * removed or renumbered.
 */
export function programLineNumbers(source: string): number[] {
  const out: number[] = [];
  for (const row of source.split('\n')) {
    const m = /^\s*(\d+)/.exec(row);
    if (m) out.push(parseInt(m[1]!, 10));
  }
  return out;
}

/** Whether `source` still has exactly the lines a profile was measured against. */
export function profileStillApplies(
  profile: RunProfile,
  source: string,
): boolean {
  const now = programLineNumbers(source);
  return (
    now.length === profile.measuredLines.length &&
    now.every((n, i) => n === profile.measuredLines[i])
  );
}
