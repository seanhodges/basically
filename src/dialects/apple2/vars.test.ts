// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readApple2Variables } from './vars';
import { apple2 } from './index';
import { LOMEM, PV } from './addresses';
import { Apple2Machine } from '../../emulator/apple2/apple2Machine';
import { integerBasicSupport } from './machineSupport';

const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple2/apple2.rom')),
);

/**
 * Fields a program is given before the read is taken. Every program below runs
 * a few dozen statements and stops, so this only bounds a machine that never
 * started - the loop leaves as soon as the interpreter is back at its prompt.
 */
const MAX_FIELDS = 2000;

/** Load and run to a stop. */
function ran(source: string): Apple2Machine {
  const machine = new Apple2Machine({ rom: ROM, basic: integerBasicSupport });
  const { image, errors } = apple2.tokenize(source);
  expect(errors).toEqual([]);
  machine.loadProgram(image);
  for (let field = 0; field < MAX_FIELDS; field++) {
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
      '95 LONGNAME=7\n' +
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

  it('spells a name of any length, which is where this machine parts from the Apple I', () => {
    // The Apple I stores one letter and at most one digit in a fixed four-byte
    // header; this interpreter writes the name out, one byte a character, and
    // a reader assuming the other layout would name this variable "L".
    expect(named.get('LONGNAME')).toMatchObject({ value: '7' });
  });

  it('reads a string back through the machine’s own charset', () => {
    expect(named.get('C$')).toEqual({
      kind: 'string',
      name: 'C$',
      value: '"HI"',
    });
  });

  it('reads an array, zero-based as the interpreter dimensions it', () => {
    // DIM D(4) reserves five elements and D(0) is a real one, so the preview
    // starts at the element the FOR loop never assigned.
    expect(named.get('D()')).toEqual({
      kind: 'number-array',
      name: 'D()',
      value: '0, 11, 22, 33, 44',
    });
  });

  it('lists the variables in the order the interpreter created them', () => {
    expect(vars.map((v) => v.name)).toEqual([
      'A',
      'B',
      'Q1',
      'C$',
      'D()',
      'I',
      'LONGNAME',
    ]);
  });

  it('walks the table the interpreter’s own pointers describe', () => {
    // The walk is bounded by LOMEM and PV rather than by a count, so a reading
    // that ignored either would run into the free space above the table.
    const mem = machine.mem;
    expect(mem.peekWord(LOMEM)).toBeLessThan(mem.peekWord(PV));
    expect(vars.length).toBeGreaterThan(0);
  });
});

describe('a scalar and its own subscript', () => {
  it('shows one variable, because A and A(0) are one cell', () => {
    // `DIM A(3)` after `A=1` grows the existing entry rather than creating a
    // second one, which is why the value field's length is the only thing that
    // says whether an entry is an array.
    const vars = ran('10 A=1\n20 DIM A(3)\n30 A(2)=9\n40 END').readVariables();
    expect(vars.map((v) => v.name)).toEqual(['A()']);
    // Four elements, and A is the first of them. The two the program never
    // assigned read back as whatever the workspace held: DIM reserves the
    // space without clearing it, so a fresh array is not a zeroed one.
    const shown = vars[0]!.value.split(', ');
    expect(shown).toHaveLength(4);
    expect([shown[0], shown[2]]).toEqual(['1', '9']);
  });

  it('truncates a long array to a readable preview', () => {
    const vars = ran(
      '10 DIM A(9)\n20 FOR I=0 TO 9\n30 A(I)=I\n40 NEXT I\n50 END',
    ).readVariables();
    expect(vars[0]!.value).toBe('0, 1, 2, 3, 4, 5, 6, 7, …');
  });
});

describe('a table that does not hold together', () => {
  it('reads nothing from a machine still at the monitor', () => {
    // Before the cold start lays LOMEM and PV down they are both zero, and a
    // walk from zero would report the 6502's own vectors as variables.
    const machine = new Apple2Machine({ rom: ROM, basic: integerBasicSupport });
    expect(machine.readVariables()).toEqual([]);
  });

  it('stops at a link that leaves the table rather than looping', () => {
    const ram = new Uint8Array(0x10000);
    const put = (a: number, v: number) => {
      ram[a] = v & 0xff;
      ram[a + 1] = v >> 8;
    };
    put(LOMEM, 0x0800);
    put(PV, 0x0820);
    // One good entry, then a link pointing back at itself.
    ram.set([0xc1, 0x00, 0x06, 0x08, 0x05, 0x00], 0x0800);
    ram.set([0xc2, 0x00, 0x06, 0x08, 0x01, 0x00], 0x0806);
    expect(readApple2Variables(ram).map((v) => v.name)).toEqual(['A']);
  });

  it('stops on a name byte no interpreter would have written', () => {
    const ram = new Uint8Array(0x10000);
    ram[LOMEM] = 0x00;
    ram[LOMEM + 1] = 0x08;
    ram[PV] = 0x20;
    ram[PV + 1] = 0x08;
    // A digit where the first character belongs: not a name this ROM stores.
    ram.set([0xb1, 0x00, 0x06, 0x08, 0x05, 0x00], 0x0800);
    expect(readApple2Variables(ram)).toEqual([]);
  });
});
