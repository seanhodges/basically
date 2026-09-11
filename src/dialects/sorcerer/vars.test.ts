// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The variable watcher's readback on this machine.
 *
 * The four-byte float and the walk over the two stores are pinned once, for the
 * whole family, in `src/emulator/microsoftBasicVars.test.ts`. What is left here
 * is what is this machine's alone: that the three pointers in `addresses.ts`
 * are the right three, and that names and string contents come back through the
 * Sorcerer's own charset.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitRomImage } from './romImage';
import { tokenizeProgram } from './tokenizer';
import { buildBasicImage } from './basicImage';
import { sorcererVarsLayout } from './vars';
import { ARYTAB, PROGRAM_BASE, STREND, VARTAB } from './addresses';
import { SorcererMachine } from '../../emulator/sorcerer/sorcererMachine';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/sorcerer/sorcerer.rom')),
);

/** Frames a program that should stop quickly is given before it is called stuck. */
const MAX_RUN_FRAMES = 400;

/** Boot, load, and run to the end - or until it plainly is not going to end. */
function run(source: string): SorcererMachine {
  const sorcerer = new SorcererMachine(splitRomImage(rom));
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  sorcerer.loadProgram(buildBasicImage(program));
  for (let frame = 0; frame < MAX_RUN_FRAMES; frame++) {
    sorcerer.runFrame();
    if (sorcerer.isProgramRunning() === false) break;
  }
  return sorcerer;
}

describe('sorcerer variables', () => {
  it('reads scalars and arrays out of the interpreter’s stores', () => {
    const sorcerer = run(
      '10 AB=1\n20 XY$="HI"\n30 DIM D(3)\n40 FOR I=0 TO 3\n' +
        '50 D(I)=7+I*2\n60 NEXT I\n70 END\n',
    );
    const named = new Map(sorcerer.readVariables().map((v) => [v.name, v]));

    expect(named.get('AB')).toMatchObject({ kind: 'number', value: '1' });
    // The name bytes are stored second character first, so a reader taking them
    // in order would call this variable "BA".
    expect(named.has('BA')).toBe(false);
    expect(named.get('XY$')).toMatchObject({ kind: 'string', value: '"HI"' });
    expect(named.get('D()')).toMatchObject({
      kind: 'number-array',
      value: '7, 9, 11, 13',
    });
    sorcerer.dispose();
  });

  it('follows a built string into the pool at the top of memory', () => {
    // A literal assignment points the descriptor straight at the program text;
    // only a built string is copied into the pool, which is the half of the
    // four-byte descriptor a three-byte reader gets wrong.
    const sorcerer = run('10 A$="ZZ"+""\n20 END\n');
    const a = sorcerer.readVariables().find((v) => v.name === 'A$')!;
    expect(a.value).toBe('"ZZ"');
    sorcerer.dispose();
  });

  it('locates its pointers in the interpreter workspace, not the control area', () => {
    // The Software Manual's control area stops at 0x014E and these are above
    // it, a few dozen bytes below the program text - which is why they cannot
    // be quoted from the manual and are read off the machine instead. Checked
    // against a run rather than restated: the three pointers have to bracket
    // the variables of the program that just ran.
    const layout = sorcererVarsLayout();
    expect([layout.vartab, layout.arytab, layout.strend]).toEqual([
      VARTAB,
      ARYTAB,
      STREND,
    ]);

    const sorcerer = run('10 A=1\n20 DIM B(2)\n30 END\n');
    const vartab = sorcerer.mem.rawReadWord(VARTAB);
    const arytab = sorcerer.mem.rawReadWord(ARYTAB);
    const strend = sorcerer.mem.rawReadWord(STREND);
    expect(vartab).toBeGreaterThan(PROGRAM_BASE);
    // One 6-byte scalar between VARTAB and ARYTAB, and an array above it.
    expect(arytab - vartab).toBe(6);
    expect(strend).toBeGreaterThan(arytab);
    sorcerer.dispose();
  });

  it('answers with nothing before the ROM PAC has laid its workspace down', () => {
    // The pointers are ordinary RAM reading zero from reset, so a walk that
    // trusted them would report the bottom of memory as variables.
    const sorcerer = new SorcererMachine(splitRomImage(rom));
    expect(sorcerer.readVariables()).toEqual([]);
    sorcerer.dispose();
  });
});
