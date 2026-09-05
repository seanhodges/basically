// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readApple1Variables } from './vars';
import { apple1 } from './index';
import { LOMEM, PV } from './addresses';
import { Apple1Machine } from '../../emulator/apple1/apple1Machine';

const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple1/apple1.rom')),
);

/** Load and run to a stop. */
function ran(source: string): Apple1Machine {
  const machine = new Apple1Machine({ rom: ROM });
  const { image, errors } = apple1.tokenize(source);
  expect(errors).toEqual([]);
  machine.loadProgram(image);
  for (let field = 0; field < 4000; field++) {
    machine.runFrame();
    if (machine.isProgramRunning() === false) break;
  }
  return machine;
}

/**
 * One run holding every shape the table can take, since booting the interpreter
 * and typing RUN at it is the expensive part and the assertions are not.
 */
describe('the variable table, off a real run', () => {
  const machine = ran(
    '10 A=5\n' +
      '20 B=-3\n' +
      '30 Q1=1000\n' +
      '40 DIM C$(10)\n' +
      '50 C$="HI"\n' +
      '60 DIM D(4)\n' +
      '70 FOR I=1 TO 4\n' +
      '80 D(I)=I*11\n' +
      '90 NEXT I\n' +
      '100 END',
  );
  const vars = machine.readVariables();
  const named = new Map(vars.map((v) => [v.name, v]));

  it('reads scalars, including the negative ones', () => {
    expect(named.get('A')).toEqual({ kind: 'number', name: 'A', value: '5' });
    // Integer BASIC computes in signed 16-bit, so $FFFD is -3 and not 65533.
    expect(named.get('B')).toMatchObject({ kind: 'number', value: '-3' });
    expect(named.get('Q1')).toMatchObject({ kind: 'number', value: '1000' });
  });

  it('spells a trailing digit, which lives in the second name byte', () => {
    // The letter is stored shifted left one bit and the digit is flagged into
    // the byte beside it, so a reader taking either as plain ASCII would name
    // this variable something else entirely.
    expect([...named.keys()]).toContain('Q1');
  });

  it('reads a string back through the machine’s own charset', () => {
    expect(named.get('C$')).toEqual({
      kind: 'string',
      name: 'C$',
      value: '"HI"',
    });
  });

  it('reads an array, one-based as the interpreter dimensions it', () => {
    expect(named.get('D()')).toEqual({
      kind: 'number-array',
      name: 'D()',
      value: '11, 22, 33, 44',
    });
  });

  it('lists the variables in the order the interpreter created them', () => {
    expect(vars.map((v) => v.name)).toEqual(['A', 'B', 'Q1', 'C$', 'D()', 'I']);
  });

  it('walks exactly the table the interpreter’s own pointers describe', () => {
    // The walk follows the links in the entries; the interpreter's PV says
    // where they stop. A reader that ran past it would read program text.
    const ram = machine.mem.mem;
    const lomem = ram[LOMEM]! | (ram[LOMEM + 1]! << 8);
    const pv = ram[PV]! | (ram[PV + 1]! << 8);
    expect(pv).toBeGreaterThan(lomem);
    const clipped = readApple1Variables(withWord(ram, PV, lomem));
    expect(clipped).toEqual([]);
  });
});

describe('the variable table, on its own', () => {
  it('shows a string shorter than the one it replaced', () => {
    // Assignment writes a $1E after the characters rather than clearing the
    // rest of the DIM, so the tail of the previous string is still there and a
    // reader that took the whole DIM would show "HIDE" for "HI".
    const ram = table([[0x86, 0x40, 0xc8, 0xc9, 0x1e, 0xc4, 0xc5, 0x1e]]);
    expect(readApple1Variables(ram)).toEqual([
      { name: 'C$', kind: 'string', value: '"HI"' },
    ]);
  });

  it('shows an empty string for a DIM that was never assigned', () => {
    expect(readApple1Variables(table([[0x86, 0x40, 0, 0, 0, 0]]))).toEqual([
      { name: 'C$', kind: 'string', value: '""' },
    ]);
  });

  it('truncates a long array rather than printing all of it', () => {
    const elements: number[] = [];
    for (let i = 1; i <= 12; i++) elements.push(i, 0);
    expect(readApple1Variables(table([[0x88, 0x00, ...elements]]))).toEqual([
      {
        name: 'D()',
        kind: 'number-array',
        value: '1, 2, 3, 4, 5, 6, 7, 8, …',
      },
    ]);
  });

  it('calls a one-element array a scalar, having nothing to tell them apart', () => {
    // `DIM D(1)` and `D=5` produce byte-identical entries: the interpreter
    // treats them as the same variable and records no element count.
    expect(readApple1Variables(table([[0x88, 0x00, 5, 0]]))).toEqual([
      { name: 'D', kind: 'number', value: '5' },
    ]);
  });

  it('stops on a link that does not advance, rather than looping', () => {
    const ram = new Uint8Array(0x10000);
    writeWord(ram, LOMEM, 0x0800);
    writeWord(ram, PV, 0x0810);
    ram.set([0x82, 0x00], 0x0800);
    writeWord(ram, 0x0802, 0x0800);
    expect(readApple1Variables(ram)).toEqual([]);
  });

  it('stops on a name no interpreter could have written', () => {
    // An odd first byte cannot be a letter shifted left, so the walk has lost
    // the entry boundaries and must stop rather than invent variables.
    expect(readApple1Variables(table([[0x83, 0x00, 1, 0]]))).toEqual([]);
  });

  it('has nothing to read before the cold start lays the pointers down', () => {
    // At the monitor LOMEM and PV are both zero.
    expect(readApple1Variables(new Uint8Array(0x10000))).toEqual([]);
  });
});

/** A 64K image holding `entries` as a linked table from a stock LOMEM. */
function table(entries: readonly (readonly number[])[]): Uint8Array {
  const ram = new Uint8Array(0x10000);
  let addr = 0x0800;
  writeWord(ram, LOMEM, addr);
  for (const [first, second, ...value] of entries) {
    const next = addr + 4 + value.length;
    ram.set([first!, second!], addr);
    writeWord(ram, addr + 2, next);
    ram.set(value, addr + 4);
    addr = next;
  }
  writeWord(ram, PV, addr);
  return ram;
}

function writeWord(ram: Uint8Array, addr: number, value: number): void {
  ram[addr] = value & 0xff;
  ram[addr + 1] = (value >> 8) & 0xff;
}

/** A copy of `ram` with one pointer moved, so the original is left alone. */
function withWord(ram: Uint8Array, addr: number, value: number): Uint8Array {
  const copy = new Uint8Array(ram);
  writeWord(copy, addr, value);
  return copy;
}
