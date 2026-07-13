// Hand-written types for the vendored 6502 core (`cpu6502.js`).
// Mirrors the precedent set by `../z80/z80core.d.ts` and the C64's
// `../c64/viciious/index.d.ts`: the implementation ships as a bundled ES module
// (kept out of the strict typechecker — no `allowJs`) and this declaration file
// describes only the surface consumers actually use. See LICENSE-6502.md for
// attribution and the exact vendoring command.
//
// The core is 6502ts/6502.ts's cycle-exact `StateMachineCpu`: it advances one
// clock cycle per `cycle()` call and passes Klaus Dormann's functional tests
// (full legal NMOS opcode set incl. BRK, RTI, `JMP (indirect)` and decimal
// mode). A frame-driven host budgets by clock cycles, not instructions.

/** 6502 processor status flag bit masks (the packed status byte, `State.flags`). */
export enum Flags {
  c = 0x01, // carry
  z = 0x02, // zero
  i = 0x04, // interrupt disable
  d = 0x08, // decimal mode
  b = 0x10, // break
  e = 0x20, // reserved (always set on the real chip)
  v = 0x40, // overflow
  n = 0x80, // sign / negative
}

/** Where the CPU is in its fetch/execute cycle. A full instruction boundary is `fetch`. */
export enum ExecutionState {
  boot = 0,
  fetch = 1,
  execute = 2,
}

/**
 * Live, mutable CPU register/state.
 *
 * NOTE the upstream naming quirk: `p` is the **program counter** and `flags` is
 * the **status register** — the opposite of the classic 6502 convention where
 * `P` is the status byte. Read `flags` (with {@link Flags}) for N/V/Z/C etc.
 */
export interface State {
  a: number; // accumulator (8-bit)
  x: number; // x index register (8-bit)
  y: number; // y index register (8-bit)
  s: number; // stack pointer (8-bit, implicit stack page 0x0100)
  p: number; // program counter (16-bit)
  flags: number; // packed status register (8-bit, see Flags)
  irq: boolean; // IRQ line asserted
  nmi: boolean; // NMI pending
}

/**
 * The single memory/IO bus the host supplies to the CPU. Address decoding,
 * memory mapping and memory-mapped IO all live in this object — the core has no
 * opinion about the memory map. `read`/`write` are the hot path; `peek`/`poke`
 * are side-effect-free variants and `readWord` a little-endian 16-bit read
 * (the host can derive all three from `read`/`write`).
 */
export interface BusInterface {
  read(address: number): number;
  write(address: number, value: number): void;
  peek(address: number): number;
  poke(address: number, value: number): void;
  readWord(address: number): number;
}

/**
 * Cycle-exact NMOS 6502. Construct it over a {@link BusInterface}, `reset()` it,
 * then drive it one clock at a time with `cycle()`. The optional `rng` seeds the
 * power-on register state; omit it (as this repo does) for deterministic zeros.
 */
export class StateMachineCpu {
  constructor(bus: BusInterface, rng?: unknown);

  /** Live register/state (see {@link State}). */
  readonly state: State;

  /** Current fetch/execute phase; `ExecutionState.fetch` marks an instruction boundary. */
  executionState: ExecutionState;

  /** Advance the CPU by exactly one clock cycle. */
  cycle(): this;

  /** Assert the reset line; the reset vector at 0xFFFC is loaded over the next several cycles. */
  reset(): this;

  /** Assert/deassert the (level-sensitive) IRQ line. Sampled at instruction boundaries. */
  setInterrupt(irq: boolean): this;

  /** Query whether the IRQ line is currently asserted. */
  isInterrupt(): boolean;

  /** Trigger a (edge-sensitive) NMI. */
  nmi(): this;

  /** Halt / resume the CPU (RDY line). */
  halt(): this;
  resume(): this;
  isHalt(): boolean;

  /** Address of the most recently fetched instruction. */
  getLastInstructionPointer(): number;
}
