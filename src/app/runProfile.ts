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
 *
 * Memory is the exception, and is reported in bytes. The reason shares are used
 * for time does not apply to it - a byte is the same byte on every machine, and
 * needs no clock rate to be read - and "how much memory" is asked and answered
 * in the machine's own bytes.
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

/** Bytes of BASIC RAM one line took over a run. */
export interface LineAllocation {
  line: number;
  /** Gross: rises summed, with nothing subtracted for what BASIC reclaimed. */
  bytes: number;
}

/**
 * How a memory breakdown was arrived at.
 *
 * `measured` is the machine's own figure read at each change of BASIC line and
 * charged to the line that had been executing - the line that took the memory,
 * and no other. `approximate` is the fallback: each rise the run's memory
 * account showed, spread over the lines running at the time in proportion to
 * their cycles.
 */
export type AllocationAccuracy = 'measured' | 'approximate';

/**
 * What a run's memory came to, per line, and how well that is known.
 *
 * The accuracy travels with the figures because nothing downstream could work
 * it out otherwise, and a spread figure read as a measured one is the one
 * mistake this account must not invite.
 */
export interface AllocationAccount {
  /** Bytes per line, greatest first is the reader's job; zero lines absent. */
  lines: LineAllocation[];
  accuracy: AllocationAccuracy;
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
  /**
   * Which lines the run's memory went to, or null when no reading was ever
   * taken. An empty `lines` is a different answer: readings were taken, and no
   * line took anything the machine's own figure could see.
   */
  allocations: AllocationAccount | null;
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

/** A line's measured memory, and what fraction of the run's it accounts for. */
export interface AllocationShare {
  line: number;
  /** Bytes of BASIC RAM charged to the line. */
  bytes: number;
  /** `bytes` over the bytes the run charged in total, 0…1. */
  share: number;
}

/** A named routine or jump destination, with the run's bytes summed over it. */
export interface RoutineAllocation {
  title: string;
  lineNo: number;
  through: number;
  bytes: number;
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
  const out = routineExtents(source, caps).map((r) => ({
    title: r.title,
    lineNo: r.lineNo,
    through: r.through,
    share: sumOver(shares, r, (s) => s.share),
  }));
  return out.sort((a, b) => b.share - a.share || a.lineNo - b.lineNo);
}

/** A routine's entry line and the extent of the program charged to it. */
interface RoutineExtent {
  title: string;
  lineNo: number;
  /** Inclusive last line, for display. */
  through: number;
  /** Exclusive: the next entry line, or Infinity for the last routine. */
  to: number;
}

/**
 * Where each routine the outline can identify starts and stops, in line order.
 *
 * Shared by the time and memory roll-ups so a routine covers the same lines in
 * both: two walks of the same outline would be two chances to disagree about
 * which lines a routine owns, and a user reading the two lists side by side
 * would have no way to tell which was right.
 */
function routineExtents(
  source: string,
  caps: OutlineCapabilities,
): RoutineExtent[] {
  const entries = new Map<number, string>();
  for (const section of buildOutline(source, caps)) {
    for (const item of section.items) {
      // The first name wins: a line that is both a PROC definition and a GOSUB
      // target is one routine, and the outline lists the named form first.
      if (!entries.has(item.lineNo)) entries.set(item.lineNo, item.title);
    }
  }
  const starts = [...entries.keys()].sort((a, b) => a - b);
  return starts.map((from, i) => {
    const to = starts[i + 1] ?? Infinity;
    return {
      title: entries.get(from)!,
      lineNo: from,
      through: Number.isFinite(to) ? to - 1 : from,
      to,
    };
  });
}

/** Add up one field of every measured line that falls inside a routine. */
function sumOver<T extends { line: number }>(
  measured: readonly T[],
  extent: RoutineExtent,
  of: (m: T) => number,
): number {
  let total = 0;
  for (const m of measured) {
    if (m.line >= extent.lineNo && m.line < extent.to) total += of(m);
  }
  return total;
}

/** Bytes the run charged to lines in total, the figure shares are taken of. */
export function totalAllocated(allocations: readonly LineAllocation[]): number {
  let total = 0;
  for (const a of allocations) total += a.bytes;
  return total;
}

/**
 * Each line's memory, greediest first.
 *
 * Bytes rather than shares, unlike the time side: a share is what "where did
 * the time go" asks because a cycle count means nothing without the machine's
 * clock rate, and a byte has no such problem. The share rides along so a bar
 * can be drawn against the greediest line, not to be read on its own.
 *
 * Lines that took nothing are absent, not zero - the same reading the gutter
 * gives time. A line that took no memory is a fact about the line, and listing
 * it among the ones that did would bury them.
 */
export function lineAllocations(
  allocations: readonly LineAllocation[],
): AllocationShare[] {
  const total = totalAllocated(allocations);
  if (total <= 0) return [];
  return allocations
    .filter((a) => a.bytes > 0)
    .map((a) => ({ ...a, share: a.bytes / total }))
    .sort((a, b) => b.bytes - a.bytes || a.line - b.line);
}

/**
 * The run's memory summed over each routine and jump destination, greediest
 * first.
 *
 * Flat, exactly as {@link routineShares} is: a routine's figure is what its own
 * lines took, and the routines it calls are counted against themselves.
 *
 * Unlike {@link routineShares}, routines that took nothing are left out rather
 * than listed at zero. The time roll-up lists every routine because a program's
 * time is spread over all of them and a 0% routine is a real reading; memory is
 * usually taken in one or two places, and padding the ranking with the routines
 * that took none would bury them - the same reason a line that took nothing is
 * absent from {@link lineAllocations}.
 */
export function routineAllocations(
  source: string,
  caps: OutlineCapabilities,
  allocations: readonly LineAllocation[],
): RoutineAllocation[] {
  const total = totalAllocated(allocations);
  if (total <= 0) return [];
  const out = routineExtents(source, caps)
    .map((r) => {
      const bytes = sumOver(allocations, r, (a) => a.bytes);
      return {
        title: r.title,
        lineNo: r.lineNo,
        through: r.through,
        bytes,
        share: bytes / total,
      };
    })
    .filter((r) => r.bytes > 0);
  return out.sort((a, b) => b.bytes - a.bytes || a.lineNo - b.lineNo);
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
  private readonly allocated = new Map<number, number>();
  /** True once the machine has charged anything, so no costs reads as "none". */
  private measuredLineCosts = false;
  /** True once the machine has priced a line in bytes, on the same reasoning. */
  private attributedMemory = false;
  /**
   * Cycles each line has run since the last memory sample, and the bytes the
   * fallback has spread over them - see {@link spreadOverWindow}.
   */
  private windowCycles = new Map<number, number>();
  private readonly approximated = new Map<number, number>();
  /** The in-use figure at the previous sample; null when there is none. */
  private lastUsed: number | null = null;
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
  /** {@link measuredLines} as a set, for the check on every drained cost. */
  private readonly programLines: ReadonlySet<number>;

  constructor(
    /** The buffer this run belongs to; a scratch buffer's id, or null. */
    readonly bufferId: string | null,
    /** The BASIC line numbers the measured program had. */
    readonly measuredLines: readonly number[],
  ) {
    this.programLines = new Set(measuredLines);
  }

  /**
   * Whether a line the machine named is a line of the program being measured.
   *
   * A machine names the line its BASIC is executing by reading the ROM's own
   * cell, and between the typed RUN and the program's first line that cell has
   * not been set to anything meaningful yet. Commodore BASIC V2 reads as line 0
   * across that gap - measured at around 3,000 cycles on both the C64 and the
   * VIC-20, enough to show up in a short run's ranking as a line the program
   * does not contain. (BASIC 4 on the PET does not, nor do the Sinclair, Acorn
   * or Amstrad ROMs.)
   *
   * Checked against the program rather than against a list of known transients,
   * because the question "is this a line of the program" is the one actually
   * being asked, and it has an answer that needs no per-machine table. It keeps
   * a legitimate line 0, which CBM BASIC allows and which would be lost by
   * dropping the number itself.
   *
   * Dropped rather than parked on a neighbour, for the reason
   * {@link ../emulator/lineCostRecorder.LineCostRecorder.sample} drops the time
   * spent outside any BASIC line: it belongs to no line of this program, and
   * charging it somewhere would make some line read as costing more than it did.
   *
   * A program with no numbered lines is not something the IDE can run, so an
   * empty set means the caller had nothing to check against rather than that
   * every line is foreign - and everything is charged, as it was before.
   */
  private chargeable(line: number): boolean {
    return this.programLines.size === 0 || this.programLines.has(line);
  }

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
        if (!this.chargeable(c.line)) continue;
        this.lines.set(c.line, (this.lines.get(c.line) ?? 0) + c.cost);
        this.windowCycles.set(
          c.line,
          (this.windowCycles.get(c.line) ?? 0) + c.cost,
        );
        // Bytes come attached to the costs, and are absent rather than zero on
        // a machine that cannot attribute its memory - so the first entry
        // carrying them is what says this run has a memory breakdown at all.
        if (c.allocated === undefined) continue;
        this.attributedMemory = true;
        if (c.allocated > 0) {
          this.allocated.set(
            c.line,
            (this.allocated.get(c.line) ?? 0) + c.allocated,
          );
        }
      }
    }
    if (++this.sinceSample < MEMORY_SAMPLE_FRAMES) return;
    this.sinceSample = 0;
    const stats = readMemory();
    if (!stats) {
      // Mid-boot, mid-injection, or a machine that can't say. The next figure
      // has nothing to be compared against, and the cycles run across the gap
      // cannot be priced - charging them once a figure returns would land the
      // whole gap on whichever lines happen to follow it.
      this.lastUsed = null;
      this.windowCycles.clear();
      return;
    }
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
    this.spreadOverWindow(stats.used);
  }

  /**
   * The fallback account: charge this sampling window's rise to the lines that
   * ran in it, in proportion to the cycles each spent.
   *
   * Kept whatever the machine reported per line, and used only when that
   * reported nothing (see {@link snapshot}). What it is for is the case the
   * exact reading cannot cover at all: pricing a line needs the machine to
   * *leave* it, and a loop written on one line - `10 A$=A$+"X":GOTO 10`, which
   * BASIC invites and which is written that way precisely where speed matters -
   * never does. Such a program can fill memory over a whole run and have
   * nothing charged for it.
   *
   * Weighted by cycles, which is a guess and is reported as one. In the case
   * above it happens to be exact, because only one line ran; where several did,
   * the line that took the memory is not necessarily the line that spent the
   * time, and the reading says so wherever it is shown.
   *
   * Rises only, and a fall re-baselines, exactly as the exact path does.
   */
  private spreadOverWindow(used: number): void {
    const from = this.lastUsed;
    this.lastUsed = used;
    const cycles = this.windowCycles;
    this.windowCycles = new Map();
    if (from === null) return; // the run's first figure is a baseline
    const grew = used - from;
    if (grew <= 0) return;
    let total = 0;
    for (const c of cycles.values()) total += c;
    // No BASIC line ran in this window: on a machine that cannot report its
    // executing line, or across one spent entirely at the ROM's prompt. The
    // memory went somewhere, but to no line of this program.
    if (total <= 0) return;
    for (const [line, c] of cycles) {
      this.approximated.set(
        line,
        (this.approximated.get(line) ?? 0) + (grew * c) / total,
      );
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

  /**
   * Emulated seconds the run has lasted, as the run clock stands right now.
   *
   * The reading a timing is taken from (see `runTiming.ts`). Offered as its own
   * getter rather than through {@link snapshot} because a stopwatch reads it
   * every frame and has no use for the rest of the profile.
   */
  get elapsedSeconds(): number {
    return this.elapsed;
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
      allocations: this.allocationAccount(),
      elapsed: this.elapsed,
    };
  }

  /**
   * Which lines the run's memory went to, and how well that is known.
   *
   * Four readings, and they are four different answers:
   *
   * - the machine priced lines itself, so the figures are the memory those
   *   lines took;
   * - it priced none, but the run's own account moved and can be spread over
   *   the lines that were running - approximate, and marked as such;
   * - a figure was read and nothing moved, so no line took memory this machine
   *   can see. Empty, which is a measurement;
   * - no figure was ever read. Null, which is the absence of one.
   *
   * Never mixed: a ranking of some measured figures and some spread ones gives
   * the reader no way to tell which is which, and the spread would credit a
   * line that genuinely took nothing for the cycles it happened to burn.
   */
  private allocationAccount(): AllocationAccount | null {
    if (this.allocated.size > 0) {
      return {
        lines: [...this.allocated].map(([line, bytes]) => ({ line, bytes })),
        accuracy: 'measured',
      };
    }
    // Rounded here rather than as it accumulates, so a line charged a fraction
    // of a byte per window is not rounded away window by window.
    const spread = [...this.approximated]
      .map(([line, bytes]) => ({ line, bytes: Math.round(bytes) }))
      .filter((a) => a.bytes > 0);
    if (spread.length > 0) return { lines: spread, accuracy: 'approximate' };
    if (this.attributedMemory || this.measuredMemory) {
      return { lines: [], accuracy: 'measured' };
    }
    return null;
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
