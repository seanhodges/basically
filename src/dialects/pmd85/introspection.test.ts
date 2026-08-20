// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitRomImage } from './romImage';
import { tokenizeProgram } from './tokenizer';
import { Pmd85Machine } from './emulator/pmd85Machine';
import { decodePmd85Float } from './vars';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85.rom')),
);

/** Run a program to its end (or until it plainly is not going to end). */
function run(source: string): Pmd85Machine {
  const pmd = new Pmd85Machine(splitRomImage(rom));
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  pmd.loadProgram(program);
  for (let frame = 0; frame < 400 && pmd.isProgramRunning(); frame++) {
    pmd.runFrame();
  }
  return pmd;
}

describe('pmd85 float decoding', () => {
  it('reads the interpreter’s own four-byte format', () => {
    // Mantissa low, mid, high, then the excess-129 exponent - the byte order
    // the variable table actually holds, which is the reverse of the Commodore
    // five-byte float this project also decodes.
    expect(decodePmd85Float([0x00, 0x00, 0x00, 0x81])).toBe(1);
    expect(decodePmd85Float([0x00, 0x00, 0x20, 0x82])).toBe(2.5);
    expect(decodePmd85Float([0x00, 0x00, 0x10, 0x84])).toBe(9);
    expect(decodePmd85Float([0x00, 0x00, 0x80, 0x81])).toBe(-1);
    expect(decodePmd85Float([0x00, 0x00, 0x00, 0x00])).toBe(0);
  });
});

describe('pmd85 variable readback', () => {
  it('reads scalars, strings and arrays off a run', () => {
    const pmd = run(
      '10 AB=1\n20 XY$="HI"\n30 DIM D(3)\n40 FOR I=0 TO 3\n' +
        '50 D(I)=7+I*2\n60 NEXT I\n70 END\n',
    );
    const vars = pmd.readVariables();
    const named = new Map(vars.map((v) => [v.name, v]));

    expect(named.get('AB')).toMatchObject({ kind: 'number', value: '1' });
    // The name bytes are stored second character first, so a reader that took
    // them in order would call this variable "BA".
    expect(named.has('BA')).toBe(false);
    expect(named.get('XY$')).toMatchObject({
      kind: 'string',
      value: '"HI"',
    });
    expect(named.get('D()')).toMatchObject({
      kind: 'number-array',
      value: '7, 9, 11, 13',
    });
  });

  it('follows a string into string space, not into the program', () => {
    // The descriptor is four bytes - length, an unused byte, then the address
    // low byte first. Read as the usual three it points 0x1300 low, which on
    // this machine lands inside the interpreter and reads as garbage.
    const pmd = run('10 A$="ZZ"+""\n20 END\n');
    expect(pmd.readVariables()[0]).toMatchObject({
      name: 'A$',
      value: '"ZZ"',
    });
  });

  it('answers with nothing before a program has run', () => {
    const pmd = new Pmd85Machine(splitRomImage(rom));
    expect(pmd.readVariables()).toEqual([]);
  });
});

describe('pmd85 runtime report', () => {
  it('reads an error, its message and its line', () => {
    const pmd = run('10 A=1/0\n20 END\n');
    expect(pmd.readReport()).toEqual({
      isError: true,
      message: 'Dv by zero',
      line: 10,
    });
  });

  it('reports a clean end as no error', () => {
    expect(run('10 A=1\n20 END\n').readReport()).toEqual({
      isError: false,
      message: 'OK',
    });
  });

  it('does not call a STOP an error', () => {
    // STOP prints in the same frame an error does, and CONT would resume it -
    // so a reader matching the frame alone would offer to fix a working
    // program.
    const report = run('10 A=1\n20 STOP\n')!.readReport();
    expect(report?.isError).toBe(false);
    expect(report?.message).toMatch(/^Stop/);
  });
});
