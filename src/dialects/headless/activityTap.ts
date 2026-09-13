// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Sampling which addresses a run's machine is touching, for something that is
 * watching its memory.
 *
 * The counterpart of `./frameTap.ts`, and shaped like it for the same reasons:
 * a sink it asks whether anybody is watching and whether the far end is free, a
 * per-frame call, a settle once a request is over, and an accumulated cost the
 * runner subtracts. Two properties it shares with the display's tap:
 *
 * - **It spends none of the machine's frames.** Draining takes the set of
 *   addresses the machine already stamped; it does not advance anything. So
 *   every measurement taken in the machine's own time is the same whether or
 *   not a map is open.
 * - **It knows what it cost.** The tap runs from the same per-frame fold a
 *   runner reports as `runMs`, so {@link ActivityTap.costMs} is accumulated for
 *   the runner to subtract, or every mapped run would look slower than the same
 *   run unmapped.
 *
 * And one property it does not share, which is what makes it the simpler of the
 * two. A picture is a moment, so a sample the display's tap drops is a moment
 * nobody ever sees. Memory activity is not a moment: what a machine records is
 * everything it has touched since it was last drained, so a drain that is
 * skipped - for the rate, or for a far end that is behind - widens the next
 * drain's window rather than losing anything. Sampling here is a rate control
 * and nothing else.
 *
 * Recording is armed from whether anything is watching, so a machine nobody is
 * mapping records nothing and pays for the map exactly nothing.
 */

/**
 * Addresses to a cell.
 *
 * What crosses is the touched set reduced to cells, because the raw set is one
 * byte per address of the whole address space and handing that over per sample
 * is the same order of traffic as an uncompressed picture. Sixteen is at or
 * below one cell per device pixel for any column a map is drawn in - a 64K
 * machine reduces to four thousand cells - so the picture cannot distinguish
 * anything this throws away.
 */
export const ADDRESSES_PER_CELL = 16;

/**
 * Frames between samples.
 *
 * The display's rate, for the display's reason: every machine here runs at 50
 * or 60Hz, so this is ten samples a second of machine time. Unlike the
 * display's it costs nothing to raise or lower beyond the work itself, since a
 * skipped drain merges into the next one.
 */
export const SAMPLE_EVERY_FRAMES = 5;

/** One drain, reduced to cells and compressed, on its way to a watcher. */
export interface MapActivity {
  /** Addresses to a cell; cell `i` covers `i * this` upwards. */
  addressesPerCell: number;
  /**
   * One byte per cell - the bits of every access in it, as
   * `READ_BIT | WRITE_BIT` - raw-deflated. Left as bytes rather than text for
   * the reason a sampled picture is: they cross a thread boundary before they
   * cross anything that needs them written down.
   */
  cells: Uint8Array;
}

/** Where a tap's samples go. */
export interface ActivitySink {
  /**
   * Whether anybody is watching at all. False until a map has been asked for,
   * which is most of the time, and the tap then costs a run nothing.
   */
  watching(): boolean;
  /**
   * Whether a sample handed over now would reach a watcher, rather than queue
   * behind one still on its way. A sink that says no has its drain deferred to
   * the next one, which is the same addresses and more.
   */
  free(): boolean;
  /**
   * One sample of what the machine has touched. Consumed before this returns:
   * the cells it carries are compressed here and the buffer behind them is the
   * tap's own, reused for the next sample.
   */
  send(activity: MapActivity): void;
}

export interface ActivityTap {
  /** One frame has run; sample it if this is the Nth and the sink is free. */
  frame(): void;
  /** The request is over: send what it left, whether or not a sample was due. */
  settle(): void;
  /** Stop recording; the machine is going, or nothing is watching it any more. */
  disarm(): void;
  /** Milliseconds spent draining, reducing and compressing for the map. */
  readonly costMs: number;
  /**
   * Whether this machine can report what its processor touches at all. False
   * for a machine with no bus to tap, which is a different answer from a
   * program that touched nothing and is given as one.
   */
  readonly taps: boolean;
}

export interface ActivityTapDeps {
  sink: ActivitySink;
  /** The machine's address space, which is what a drain is one byte per. */
  addressSpace: number;
  /**
   * Turn the machine's recording on and off. Absent where the machine has no
   * bus to tap, which is what {@link ActivityTap.taps} reports.
   */
  record?: (enabled: boolean) => void;
  /** Drain the touched set, reusing `recycle` as the next fill target. */
  drain?: (recycle?: Uint8Array | null) => Uint8Array | null;
  /**
   * Compress one reduced sample, or answer null where it is the last one over
   * again. Injected rather than imported for the reason `encodePng` is: this
   * layer holds nothing of node's.
   */
  encode: (cells: Uint8Array, addressesPerCell: number) => MapActivity | null;
  /** Frames between samples; {@link SAMPLE_EVERY_FRAMES} by default. */
  every?: number;
  /** Addresses to a cell; {@link ADDRESSES_PER_CELL} by default. */
  cellSize?: number;
}

export function createActivityTap(deps: ActivityTapDeps): ActivityTap {
  const every = deps.every ?? SAMPLE_EVERY_FRAMES;
  const cellSize = deps.cellSize ?? ADDRESSES_PER_CELL;
  const record = deps.record;
  const drain = deps.drain;
  const taps = record !== undefined && drain !== undefined;
  const cells = new Uint8Array(Math.ceil(deps.addressSpace / cellSize));
  let frames = 0;
  let costMs = 0;
  let armed = false;
  // The buffer the last drain handed back, offered as the next drain's fill
  // target so a mapped run does not allocate an address-space-sized buffer per
  // sample: the machine installs this one and hands back the one it filled,
  // and the two ping-pong for the life of the tap.
  let spare: Uint8Array | null = null;

  const arm = (wanted: boolean): void => {
    if (!taps || wanted === armed) return;
    armed = wanted;
    record(wanted);
  };

  const sample = (): void => {
    const at = performance.now();
    const hits = drain!(spare);
    if (hits) {
      spare = hits;
      cells.fill(0);
      for (let address = 0; address < hits.length; address++) {
        const bits = hits[address]!;
        if (bits !== 0) cells[(address / cellSize) | 0]! |= bits;
      }
      const activity = deps.encode(cells, cellSize);
      if (activity) deps.sink.send(activity);
    }
    costMs += performance.now() - at;
  };

  return {
    frame() {
      // Arming follows the sink rather than the machine's life, so a map
      // opened mid-run starts recording on the next frame and one given up
      // stops the machine recording for nobody.
      const watching = deps.sink.watching();
      arm(watching);
      // Counted before the test, so the first frame of a run is sampled: a
      // watcher that has just been given an address should see something.
      if (frames++ % every !== 0) return;
      if (!watching || !taps || !deps.sink.free()) return;
      sample();
    },
    // Not subject to `free`: what a request left the machine having touched is
    // what a watcher will be looking at until the next request, so it is the
    // one sample worth waiting for.
    settle() {
      const watching = deps.sink.watching();
      arm(watching);
      if (!watching || !taps) return;
      sample();
    },
    disarm() {
      arm(false);
    },
    get costMs() {
      return costMs;
    },
    taps,
  };
}
