// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import Z80 from '../z80/z80core.js';
import type { Z80Core } from '../z80/z80core.js';
import { Intel8080 } from './i8080';

/**
 * A bare 64K RAM and nothing else. The point of testing here rather than
 * through a machine is that the 8080 semantics belong to no machine: the Altair
 * and the PMD 85 both borrow them, and neither one's bus should be needed to
 * prove them.
 */
function harness(...program: number[]): {
  cpu: Z80Core;
  cpu8080: Intel8080;
  ram: Uint8Array;
  run: (instructions: number) => void;
} {
  const ram = new Uint8Array(0x10000);
  ram.set(program, 0);
  const cpu = Z80({
    mem_read: (address: number) => ram[address & 0xffff]!,
    mem_write: (address: number, value: number) => {
      ram[address & 0xffff] = value & 0xff;
    },
    io_read: () => 0xff,
    io_write: () => {},
  });
  const cpu8080 = new Intel8080(cpu, (address) => ram[address & 0xffff]!);
  return {
    cpu,
    cpu8080,
    ram,
    run: (instructions: number) => {
      for (let i = 0; i < instructions; i++) cpu8080.step();
    },
  };
}

describe('Intel8080 over the Z80 core', () => {
  it('leaves P set after SBB A, which is what boots an 8080 BASIC', () => {
    // The instruction pair from Altair 8K BASIC's floating-point code. On the
    // 8080 `SBB A` leaves P set - the result is 0, an even number of bits -
    // while the Z80 fills that flag with overflow, which is clear.
    const { cpu, run } = harness(
      0x3e,
      0x03, // MVI A,03h
      0x9f, // SBB A
    );
    run(2);
    expect(cpu.getState().flags.P).toBe(1);
  });

  it('clears P where the result is odd but the Z80 sees an overflow', () => {
    // 0x7F + 1 = 0x80: signed overflow, so the Z80 sets P/V, but a single set
    // bit, so the 8080's parity is odd and P is clear.
    const { cpu, run } = harness(
      0x3e,
      0x7f, // MVI A,7Fh
      0xc6,
      0x01, // ADI 01h
    );
    run(2);
    expect(cpu.getState().flags.P).toBe(0);
  });

  it('takes the parity of an incremented register, not of the accumulator', () => {
    const { cpu, run } = harness(
      0x3e,
      0x00, // MVI A,00h  - even parity, to prove A is not what is read
      0x06,
      0x7f, // MVI B,7Fh
      0x04, // INR B      - B = 0x80: odd parity
    );
    run(3);
    const state = cpu.getState();
    expect(state.b).toBe(0x80);
    expect(state.flags.P).toBe(0);
  });

  it('takes the parity of a compare, whose result the CPU throws away', () => {
    const { cpu, run } = harness(
      0x3e,
      0x80, // MVI A,80h
      0x06,
      0x01, // MVI B,01h
      0xb8, // CMP B      - 0x80-0x01 = 0x7F: odd parity
    );
    run(3);
    const state = cpu.getState();
    expect(state.a).toBe(0x80); // the compare discarded its result
    expect(state.flags.P).toBe(0);
  });

  it('fetches a CMP M operand back off the caller’s bus', () => {
    const { cpu, run } = harness(
      0x3e,
      0x80, // MVI A,80h
      0x21,
      0x00,
      0x01, // LXI H,0100h
      0x36,
      0x01, // MVI M,01h
      0xbe, // CMP M      - 0x80-0x01 = 0x7F: odd parity
    );
    run(4);
    expect(cpu.getState().flags.P).toBe(0);
  });

  it('fetches a CPI immediate from the byte after the opcode', () => {
    const { cpu, run } = harness(
      0x3e,
      0x80, // MVI A,80h
      0xfe,
      0x01, // CPI 01h    - 0x80-0x01 = 0x7F: odd parity
    );
    run(2);
    expect(cpu.getState().flags.P).toBe(0);
  });

  it('adjusts a DAA upwards after a subtraction, as the 8080 always did', () => {
    // 0x15 - 0x06 = 0x0F; the 8080's DAA adds 6 to the low nibble whatever came
    // before it, giving 0x15. The Z80 subtracts 6 instead - it has an N flag to
    // tell it a subtraction happened - and would leave 0x09.
    const { cpu, run } = harness(
      0x3e,
      0x15, // MVI A,15h
      0xd6,
      0x06, // SUI 06h
      0x27, // DAA
    );
    run(3);
    expect(cpu.getState().a).toBe(0x15);
  });

  it('leaves the logic instructions alone, which already set P to parity', () => {
    // XRA A zeroes the accumulator: even parity on both CPUs, so the correction
    // has nothing to do and the table deliberately skips the whole logic block.
    const { cpu, run } = harness(
      0x3e,
      0x03, // MVI A,03h
      0xaf, // XRA A
    );
    run(2);
    const state = cpu.getState();
    expect(state.a).toBe(0);
    expect(state.flags.P).toBe(1);
  });

  it('reports the cycles the instruction took, corrected or not', () => {
    const { cpu8080 } = harness(
      0x00, // NOP  - uncorrected path
      0x3c, // INR A - corrected path
    );
    expect(cpu8080.step()).toBeGreaterThan(0);
    expect(cpu8080.step()).toBeGreaterThan(0);
  });
});
