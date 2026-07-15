/** A memory access that touched an address since the last drain: a read. */
export const READ_BIT = 1;
/** A memory access that touched an address since the last drain: a write. */
export const WRITE_BIT = 2;

/**
 * A per-CPU-address "touched since last drain" set for the live memory-activity
 * overlay. One byte per address, saturating rather than counted: bit0 marks a
 * read, bit1 a write. Duplicate touches in a frame collapse to the same byte, so
 * the buffer is bounded at exactly `size` bytes no matter how many million
 * accesses the CPU makes.
 *
 * Shared across dialects: any machine that routes every CPU read/write through a
 * single seam can own one and stamp `hits` inline on the hot path. `hits` is
 * public so that seam indexes it directly with no method-call overhead - the
 * whole point is that recording, when enabled, costs a branch plus one indexed
 * `|=` and nothing more.
 */
export class MemoryActivityBuffer {
  /** When false, the hot path must not stamp. Off by default. */
  enabled = false;
  /** Touched-address set; index = address, value = READ_BIT | WRITE_BIT bits. */
  hits: Uint8Array;

  constructor(readonly size = 0x10000) {
    this.hits = new Uint8Array(size);
  }

  /**
   * Hand the filled buffer to the caller (who transfers it to the worker) and
   * install a zeroed buffer as the new fill target. Reuses `recycle` when its
   * length matches - the caller passes back a previously-drained buffer to form
   * a ping-pong pool and avoid a `size`-byte allocation every frame - otherwise
   * allocates a fresh one. Zeroing happens here, on the emulator thread, so the
   * consumer never has to touch a live buffer and there is no aliasing window.
   */
  drain(recycle?: Uint8Array | null): Uint8Array {
    const filled = this.hits;
    const next =
      recycle && recycle.length === this.size
        ? recycle
        : new Uint8Array(this.size);
    next.fill(0);
    this.hits = next;
    return filled;
  }

  /** Drop all recorded activity in place (e.g. when recording is disabled). */
  clear(): void {
    this.hits.fill(0);
  }
}
