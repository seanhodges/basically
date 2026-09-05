// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apple2plus } from './index';
import { Apple2Machine } from '../../emulator/apple2/apple2Machine';
import { applesoftSupport } from './machineSupport';
import { ARYTAB, VARTAB } from './addresses';

const ROM = new Uint8Array(
  readFileSync(
    join(__dirname, '../../../public/roms/apple2plus/apple2plus.rom'),
  ),
);

/**
 * Fields a program is given before the read is taken. Every program below runs
 * a few dozen statements and stops, so this only bounds a machine that never
 * started - the loop leaves as soon as the interpreter is back at its prompt.
 */
const MAX_FIELDS = 3000;

/** Load and run to a stop. */
function ran(source: string): Apple2Machine {
  const machine = new Apple2Machine({ rom: ROM, basic: applesoftSupport });
  const { image, errors } = apple2plus.tokenize(source);
  expect(errors, source).toEqual([]);
  machine.loadProgram(image);
  for (let field = 0; field < MAX_FIELDS; field++) {
    machine.runFrame();
    if (machine.isProgramRunning() === false) break;
  }
  return machine;
}

/**
 * One run holding every shape the table can take, since booting the
 * interpreter and running a program at it is the expensive part and the
 * assertions are not.
 */
describe('the variable table, off a real run', () => {
  const machine = ran(
    '10 A = 5\n' +
      '20 B = -3.5\n' +
      '30 C% = 42\n' +
      // Concatenated rather than assigned from a literal: a string taken
      // straight out of the program text is described in place and never
      // reaches the string space, so this is the case that exercises both.
      '40 N$ = "HI" + "!"\n' +
      '50 L$ = "PLAIN"\n' +
      '60 DIM D(4)\n' +
      '70 FOR I = 0 TO 4\n' +
      '80 D(I) = I * 11\n' +
      '90 NEXT I\n' +
      '100 DIM E$(2)\n' +
      '110 DEF FN F(X) = X + 1\n' +
      '120 G = FN F(2)\n' +
      '130 END\n',
  );
  const vars = machine.readVariables();
  const named = new Map(vars.map((v) => [v.name, v]));

  it('reads the three scalar types the interpreter distinguishes', () => {
    // Real, integer and string are the bit-7 flags on the two name bytes, and
    // a real is the five-byte MFLPT float the Commodores use - not the 8080
    // BASIC's four-byte one, which would read every entry short.
    expect(named.get('A')).toMatchObject({ kind: 'number', value: '5' });
    expect(named.get('B')).toMatchObject({ kind: 'number', value: '-3.5' });
    expect(named.get('C%')).toMatchObject({ kind: 'number', value: '42' });
  });

  it('reads a string from the string space and one left in the program text', () => {
    expect(named.get('N$')).toMatchObject({ kind: 'string', value: '"HI!"' });
    expect(named.get('L$')).toMatchObject({ kind: 'string', value: '"PLAIN"' });
  });

  it('reads an array with its DIM bounds, zero-based as it is dimensioned', () => {
    // DIM D(4) reserves five elements, D(0) to D(4), and the shape shown is the
    // subscript the listing wrote rather than the count stored.
    expect(named.get('D()')).toMatchObject({
      kind: 'number-array',
      value: '[4] = 0, 11, 22, 33, 44',
    });
    expect(named.get('E$()')).toMatchObject({
      kind: 'string-array',
      value: '[2]',
    });
  });

  it('skips the DEF FN definition and keeps the variable it defines over', () => {
    // A definition lives in this same table with bit 7 on the first name byte
    // only. It is not user data, and showing it would name a function `F` with
    // a pointer for a value. Its dummy argument X is a real variable, though:
    // the interpreter creates it on the DEF and leaves it behind.
    expect(named.has('F')).toBe(false);
    expect(named.get('X')).toMatchObject({ kind: 'number' });
    expect(named.get('G')).toMatchObject({ value: '3' });
  });

  it('lists the scalars in creation order, with the arrays behind them', () => {
    // Two stores rather than one linked list: VARTAB..ARYTAB then
    // ARYTAB..STREND, so an array always sorts after every scalar however
    // early it was dimensioned.
    expect(vars.map((v) => v.name)).toEqual([
      'A',
      'B',
      'C%',
      'N$',
      'L$',
      'I',
      'X',
      'G',
      'D()',
      'E$()',
    ]);
  });
});

describe('the bytes behind a string', () => {
  it('reads them through the machine’s charset, whichever way bit 7 is set', () => {
    // Applesoft stores string content with bit 7 clear and the screen stores
    // the same characters with it set; the interpreter ORs it in on the way to
    // COUT, and so does the watcher. A byte with no glyph - a control code, or
    // the lower case this machine cannot display - is a dot.
    const vars = ran(
      '10 P$ = "AB" + "C"\n' +
        '20 H$ = CHR$(200) + CHR$(201)\n' +
        '30 Z$ = CHR$(7) + CHR$(97)\n' +
        '40 END\n',
    ).readVariables();
    const named = new Map(vars.map((v) => [v.name, v.value]));
    expect(named.get('P$')).toBe('"ABC"');
    expect(named.get('H$')).toBe('"HI"');
    expect(named.get('Z$')).toBe('".."');
  });
});

describe('a machine with no table to read', () => {
  it('reads nothing before the cold start has laid the pointers down', () => {
    // At the first field VARTAB and ARYTAB are still zero, and a walk from
    // there would report the interpreter's own zero page as variables.
    const machine = new Apple2Machine({ rom: ROM, basic: applesoftSupport });
    expect(machine.readVariables()).toEqual([]);
  });

  it('reads nothing from a booted machine that has run nothing', () => {
    const machine = new Apple2Machine({ rom: ROM, basic: applesoftSupport });
    for (let field = 0; field < 600; field++) {
      machine.runFrame();
      if (machine.mem.peekWord(VARTAB) !== 0) break;
    }
    expect(machine.mem.peekWord(VARTAB)).toBe(machine.mem.peekWord(ARYTAB));
    expect(machine.readVariables()).toEqual([]);
  });
});
