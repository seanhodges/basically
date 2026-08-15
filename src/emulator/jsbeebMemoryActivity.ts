import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from './memoryActivityBuffer';
import type { Cpu6502 } from 'jsbeeb/src/fake6502.js';

/**
 * Live memory-activity recorder for the jsbeeb-core machines (BBC Micro/Master,
 * Acorn Atom). Unlike the in-tree Z80 machines, which own their RAM array and
 * stamp {@link MemoryActivityBuffer.hits} inline on their own `read`/`write`
 * seam, these adapters route every access through jsbeeb's `cpu.readmem` /
 * `cpu.writemem`. jsbeeb exposes `debugRead` / `debugWrite` hooks that fire the
 * touched CPU address on each access, so this helper stamps from there.
 *
 * Recording is off by default and armed only while the memory-map panel is on
 * screen (the host calls {@link setRecording}). Installing either hook forces
 * jsbeeb onto its slower instruction-by-instruction loop, so the cost is paid
 * only while a panel is watching - matching the Z80 machines' behaviour. The
 * hook handlers return nothing (falsy) so they never halt the CPU (a truthy
 * return would stop it, as the filing-system trap relies on).
 *
 * Shared by {@link import('./bbc/bbcMachine').BbcMachine} and
 * {@link import('./atom/atomMachine').AtomMachine} since both wrap the same
 * jsbeeb `Cpu6502`.
 */
export class JsbeebMemoryActivity {
  /**
   * While true the hooks stay installed but stamp nothing.
   *
   * jsbeeb fires `debugRead` from `readmem` itself, so a host reading the
   * machine to introspect it - which BASIC line is executing, and the profiler
   * sampling that on the run hot path - would otherwise paint the overlay with
   * accesses the program never made. The C64 keeps its unwrapped bus function
   * for exactly this; jsbeeb offers no such accessor, so the recorder is made
   * blind for the duration of the read instead. Set and cleared around the
   * read, never left on.
   */
  suspended = false;
  private readonly buffer = new MemoryActivityBuffer(0x10000);
  /** Live hook registrations, present only while recording is enabled. */
  private hooks: { remove(): void }[] = [];

  constructor(private readonly cpu: Cpu6502) {}

  /**
   * Arm or disarm recording. Idempotent: re-arming with the current state is a
   * no-op, so the host can call it freely. Arming registers the read/write
   * hooks; disarming removes them and drops any accumulated hits so a reopened
   * overlay starts clean rather than flashing stale activity.
   */
  setRecording(enabled: boolean): void {
    if (enabled === this.buffer.enabled) return;
    this.buffer.enabled = enabled;
    if (enabled) {
      // Index `this.buffer.hits` freshly on every access: drain() swaps the
      // array out, so a captured local would stamp into the drained buffer.
      this.hooks = [
        this.cpu.debugRead.add((addr: number) => {
          if (!this.suspended) this.buffer.hits[addr & 0xffff]! |= READ_BIT;
        }),
        this.cpu.debugWrite.add((addr: number) => {
          if (!this.suspended) this.buffer.hits[addr & 0xffff]! |= WRITE_BIT;
        }),
      ];
    } else {
      this.removeHooks();
      this.buffer.clear();
    }
  }

  /**
   * Hand off the addresses touched since the last drain as a fresh, transferable
   * buffer (see {@link MemoryActivityBuffer.drain}), or null when recording is
   * off. Pass a previously-drained buffer as `recycle` to reuse it.
   */
  drain(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.buffer.enabled) return null;
    return this.buffer.drain(recycle);
  }

  /** Remove any live hooks (e.g. when the machine is disposed). */
  dispose(): void {
    this.removeHooks();
  }

  private removeHooks(): void {
    for (const hook of this.hooks) hook.remove();
    this.hooks = [];
  }
}
