// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { Z80Core, Z80State } from '../z80/z80core.js';

/** The opcode has no P-flag divergence worth correcting. */
const P_NONE = 0;
/** Parity of the accumulator once the instruction has run. */
const P_ACCUMULATOR = 1;
/** Parity of the register (or byte at HL) selected by opcode bits 3-5. */
const P_DEST_REG = 2;
/** Parity of A minus the operand - a compare, whose result is discarded. */
const P_COMPARE = 3;

/**
 * The 8080's P flag is *always* the parity of the result. The Z80 reuses that
 * flag bit as P/V and fills it with signed overflow after arithmetic, which is
 * the one divergence that stops 8080 interpreters dead: Altair 8K BASIC's
 * floating-point code does `SBB A` then `JPO`, and on the Z80 `SBC A,A` leaves
 * P/V clear where the 8080 leaves P set, so the jump is taken and the
 * interpreter spins in FP forever - it prints the sign-on dialogue and never
 * reaches BYTES FREE.
 *
 * This table marks the instructions where the two differ, and says where the
 * result to take the parity of ends up. Deliberately absent:
 *
 *  - `ANA`/`XRA`/`ORA` and their immediate forms (0xA0-0xB7, 0xE6/0xEE/0xF6).
 *    The Z80's logic instructions already set P to parity, so there is nothing
 *    to correct and no reason to pay for a state read.
 *  - The rotates, `DAD`, `INX`/`DCX`, `IN A,(n)` and the rest: on both CPUs
 *    they either leave P alone or touch no flags at all.
 *  - Anything behind a CB/DD/ED/FD prefix. On an 8080 those bytes are
 *    undocumented instructions, not prefixes, and no 8080 assembler emitted
 *    them; an image containing one would already be executing a different
 *    instruction on this core, which no flag fix could rescue.
 */
function buildParitySources(): Uint8Array {
  const sources = new Uint8Array(256);
  // ADD/ADC/SUB/SBB r (0x80-0x9F) leave the result in A; CMP r (0xB8-0xBF)
  // discards it. 0xA0-0xB7 in between is the logic block, which needs no help.
  for (let op = 0x80; op <= 0x9f; op++) sources[op] = P_ACCUMULATOR;
  for (let op = 0xb8; op <= 0xbf; op++) sources[op] = P_COMPARE;
  // INR r / DCR r: 0x04, 0x05, 0x0C, 0x0D … 0x3C, 0x3D.
  for (let op = 0x04; op <= 0x3d; op += 8) {
    sources[op] = P_DEST_REG;
    sources[op + 1] = P_DEST_REG;
  }
  sources[0x27] = P_ACCUMULATOR; // DAA
  for (const op of [0xc6, 0xce, 0xd6, 0xde]) sources[op] = P_ACCUMULATOR;
  sources[0xfe] = P_COMPARE; // CPI
  return sources;
}

const P_SOURCE = buildParitySources();

/** 1 when the byte has an even number of set bits, which is the 8080's P. */
function buildParityTable(): Uint8Array {
  const table = new Uint8Array(256);
  for (let value = 0; value < 256; value++) {
    let bits = 0;
    for (let bit = 0; bit < 8; bit++) bits += (value >> bit) & 1;
    table[value] = bits % 2 === 0 ? 1 : 0;
  }
  return table;
}

const PARITY = buildParityTable();

/**
 * Intel 8080 instruction semantics on top of the vendored Z80 core.
 *
 * The Z80 was designed to be binary compatible with the 8080, so the core in
 * `src/emulator/z80/` executes 8080 object code directly and this project needs
 * no second CPU. Two flag divergences survive that compatibility, and both are
 * corrected here rather than in the core, which six shipped Z80 machines share:
 *
 *  1. **The P flag.** Corrected, because 8080 interpreters do not boot
 *     otherwise. {@link buildParitySources} carries the argument and the
 *     instruction list; {@link Intel8080.step} does the work.
 *  2. **DAA after a subtraction.** The Z80 consults its N flag and adjusts
 *     downwards; the 8080 has no N flag and always adjusts as if for an
 *     addition. Corrected by clearing N before a DAA executes, which is safe
 *     precisely because no 8080 instruction can observe N. What is *not*
 *     corrected is the half-carry a Z80 `SUB` leaves behind - a borrow, where
 *     the 8080's AC is its complement - so a DAA straight after a subtraction
 *     can still differ in the bottom digit. Recorded rather than fixed because
 *     no caller has yet run an image whose arithmetic depends on it.
 *
 * A machine supplies its own opcode fetch: the correction has to read the
 * instruction stream and, for `CPI`, the immediate byte after it, and only the
 * machine knows what its bus returns at a given address.
 */
export class Intel8080 {
  constructor(
    private readonly cpu: Z80Core,
    private readonly readByte: (address: number) => number,
  ) {}

  /**
   * Run one instruction, then give the 8080 its P flag back.
   *
   * The CPU state is read only for the instructions that need it, and written
   * back only when the Z80's answer actually differs. Everything the fix needs
   * is available *after* the instruction has run: a compare leaves its operand
   * registers untouched, and an immediate operand is still sitting in memory
   * where it was fetched from.
   */
  step(): number {
    const pc = this.cpu.getPC();
    const opcode = this.readByte(pc);
    const source = P_SOURCE[opcode]!;
    if (source === P_NONE) return this.cpu.run_instruction();

    if (opcode === 0x27) this.clearSubtractFlag();

    const cycles = this.cpu.run_instruction();
    const state = this.cpu.getState();
    const parity = PARITY[this.parityOperand(opcode, source, pc, state)]!;
    if (state.flags.P !== parity) {
      state.flags.P = parity;
      this.cpu.setState(state);
    }
    return cycles;
  }

  /** The byte whose parity the 8080 would have left in P. */
  private parityOperand(
    opcode: number,
    source: number,
    pc: number,
    state: Z80State,
  ): number {
    if (source === P_ACCUMULATOR) return state.a;
    if (source === P_DEST_REG) return this.register((opcode >> 3) & 7, state);
    // A compare: the result is A minus the operand, thrown away by the CPU but
    // not by the flags. CPI takes its operand from the byte after the opcode,
    // CMP r from a register, and neither that byte nor A has moved.
    const operand =
      opcode === 0xfe
        ? this.readByte((pc + 1) & 0xffff)
        : this.register(opcode & 7, state);
    return (state.a - operand) & 0xff;
  }

  /** One of the 8080's register slots: B C D E H L M A, where M is (HL). */
  private register(index: number, state: Z80State): number {
    switch (index) {
      case 0:
        return state.b;
      case 1:
        return state.c;
      case 2:
        return state.d;
      case 3:
        return state.e;
      case 4:
        return state.h;
      case 5:
        return state.l;
      case 6:
        return this.readByte(state.l | (state.h << 8));
      default:
        return state.a;
    }
  }

  /**
   * Clear the Z80's N flag ahead of a DAA, so that the Z80's own DAA adjusts
   * upwards the way the 8080's always did. Safe precisely because nothing on an
   * 8080 can observe N: the flag does not exist there.
   */
  private clearSubtractFlag(): void {
    const state = this.cpu.getState();
    if (!state.flags.N) return;
    state.flags.N = 0;
    this.cpu.setState(state);
  }
}
