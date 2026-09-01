import { describe, it, expect } from 'vitest';
import Z80 from './z80/z80core';

/**
 * When the block I/O instructions decrement B, and therefore which value the
 * top half of the address bus carries while the transfer happens.
 *
 * This is not a flag detail: a device that selects a register from the port's
 * high byte - the SAM Coupé's colour lookup table is one, and its ROM fills it
 * with a block output - reads that value directly. Getting the order wrong
 * writes every entry of such a table one slot along, which looks like a working
 * machine with the wrong colours rather than like a broken instruction.
 *
 * The two directions differ, which is the trap. `OUTI`/`OUTD` decrement B
 * first, so the write carries B-1; `INI`/`IND` read with B still at its old
 * value and decrement afterwards.
 */

/** Run one instruction on a bus that records the ports it touches. */
function blockIo(opcode: number, b: number): { ports: number[] } {
  const ports: number[] = [];
  const ram = new Uint8Array(0x10000);
  ram[0] = 0xed;
  ram[1] = opcode;
  const cpu = Z80({
    mem_read: (a) => ram[a]!,
    mem_write: (a, v) => {
      ram[a] = v;
    },
    io_read: (port) => {
      ports.push(port);
      return 0;
    },
    io_write: (port) => {
      ports.push(port);
    },
  });
  const state = cpu.getState();
  state.b = b;
  state.c = 0xf8;
  state.h = 0x40;
  state.l = 0x00;
  cpu.setState(state);
  cpu.run_instruction();
  return { ports };
}

const OUTI = 0xa3;
const OUTD = 0xab;
const INI = 0xa2;
const IND = 0xaa;

describe('Z80 block I/O port addressing', () => {
  it('puts the decremented B on the bus for OUTI and OUTD', () => {
    expect(blockIo(OUTI, 0x10).ports).toEqual([0x0ff8]);
    expect(blockIo(OUTD, 0x10).ports).toEqual([0x0ff8]);
    // B wraps rather than going negative, as the counter does.
    expect(blockIo(OUTI, 0x00).ports).toEqual([0xfff8]);
  });

  it('puts B unchanged on the bus for INI and IND', () => {
    expect(blockIo(INI, 0x10).ports).toEqual([0x10f8]);
    expect(blockIo(IND, 0x10).ports).toEqual([0x10f8]);
  });
});
