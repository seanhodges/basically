// Hand-written types for the vendored 6502 core (`cpu6502.js`).
// Mirrors the precedent set by `../z80/z80core.d.ts`: the implementation ships
// as plain JS (kept out of the strict typechecker) and this declaration file
// describes its public API. See LICENSE-6502.md for attribution and the local
// patches that this file reflects.

/** 6502 processor status flag bit masks. */
export enum ProcessorStatus {
  negative = 0b10000000,
  overflow = 0b01000000,
  const = 0b00100000,
  brk = 0b00010000,
  decimalMode = 0b00001000,
  disableIrqb = 0b00000100,
  zero = 0b00000010,
  carry = 0b00000001,
}

/** State of the optional internal async clock (`startClock`/`pauseClock`). */
export enum ClockMode {
  paused = 0,
  running = 1,
  waitForInterrupt = 2,
}

/** First argument to {@link AccessMemoryFunc}: whether the bus is reading or writing. */
export enum ReadWrite {
  read = 0,
  write = 1,
}

/**
 * The single memory/IO bus delegate the core calls for every access. On a
 * `read` it must return the byte (0–255) at `address`; on a `write` it stores
 * `value`. Address decoding, memory mapping and memory-mapped IO all live in
 * this callback — the core itself has no opinion about the memory map.
 */
export type AccessMemoryFunc = (
  readWrite: ReadWrite,
  address: number,
  value?: number,
) => number | void;

export interface Cpu6502Config {
  accessMemory?: AccessMemoryFunc;
  /** Log each executed instruction (async clock path only). */
  logInstructions?: boolean;
  /** Pause the async clock after this many instructions (async clock path only). */
  maxInstructions?: number;
}

export class CPU6502 {
  constructor(config: Cpu6502Config);

  // --- registers / state (public fields on the core) ---
  reg_a: number; // accumulator (8 bit)
  reg_x: number; // x index register (8 bit)
  reg_y: number; // y index register (8 bit)
  programCounter: number; // (16 bit)
  stackPointer: number; // (8 bit, implicit stack page 0x0100)
  processorStatus: number; // (8 bit, see ProcessorStatus)
  clockMode: ClockMode;
  instructionsExecuted: number;
  accessMemory: AccessMemoryFunc;

  /**
   * Assert the reset line. micro-basic-ide patch: this only sets pending state
   * (it no longer auto-runs the async clock). The reset vector at 0xFFFC is
   * loaded on the next {@link step} (or once the async clock runs).
   */
  reset(): void;

  /**
   * micro-basic-ide patch: execute exactly one instruction synchronously,
   * servicing any pending interrupt first. This is how a frame-driven host
   * (a machine's `runFrame`) advances the CPU. The core has no cycle counter,
   * so callers budget by instruction count.
   */
  step(): void;

  /** Assert IRQ (BRK sets `setBrk`); serviced on the next {@link step}. */
  triggerIRQB(setBrk: boolean): void;
  /** Assert NMI; serviced on the next {@link step}. */
  triggerNMIB(): void;

  /** Start the optional internal async (setTimeout-driven) clock. */
  startClock(): void;
  /** Pause the internal async clock. */
  pauseClock(): void;
}
