// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AtariMachine } from './atariMachine';
import { atariErrorMessage } from './reports';
import { atari800 } from '../../dialects/atari800/index';

/**
 * What the IDE reads back off a running Atari: the variable watcher, the memory
 * figures and the runtime report.
 *
 * Every case boots the committed ROM and runs a real program, because all three
 * readers describe structures Atari BASIC builds rather than ones this project
 * writes - and a table checked against another table would only say the two
 * agree. Booting costs about a second of emulated time apiece, so the cases are
 * grouped into as few programs as they can be.
 */

const ROM = new Uint8Array(readFileSync('public/roms/atari/atari.rom'));

/** Frames a program is given to start, run and finish. */
const RUN_FRAMES = 400;

function machine(model: '400' | '800' = '800'): AtariMachine {
  return new AtariMachine({ model, rom: ROM });
}

/** Load a program and run it to a standstill, or to the cap. */
function run(source: string, model: '400' | '800' = '800'): AtariMachine {
  const m = machine(model);
  const { image, errors } = atari800.tokenize(source);
  expect(errors, 'the probe should tokenize cleanly').toEqual([]);
  m.loadProgram(image);
  let started = false;
  for (let frame = 0; frame < RUN_FRAMES; frame++) {
    m.runFrame();
    const running = m.isProgramRunning();
    if (running === true) started = true;
    if (started && running === false) break;
  }
  return m;
}

describe('Atari variable readback', () => {
  it('reads scalars, strings and arrays out of the two tables', () => {
    const m = run(
      '10 DIM B$(10),C(4),E(2,3)\n' +
        '20 A=3.5\n' +
        '30 B$="HI"\n' +
        '40 C(2)=7\n' +
        '50 E(1,2)=9\n' +
        '60 UNSET=0\n' +
        '70 END\n',
    );
    const named = new Map(m.readVariables().map((v) => [v.name, v]));

    // In the order the program first mentions them, which is the order the
    // name table holds and the value table matches entry for entry.
    expect([...named.keys()]).toEqual(['B$', 'C()', 'E()', 'A', 'UNSET']);
    expect(named.get('A')).toMatchObject({ kind: 'number', value: '3.5' });
    expect(named.get('UNSET')).toMatchObject({ kind: 'number', value: '0' });
    expect(named.get('B$')).toMatchObject({ kind: 'string', value: '"HI"' });

    // A one-dimensional array shows the bound the user DIMed, not the count.
    expect(named.get('C()')).toMatchObject({
      kind: 'number-array',
      value: '[4] = 0, 0, 7, 0, 0',
    });
    // Two dimensions, with the elements running first-subscript-first: E(1,2)
    // is the eighth of the twelve, which is where the 9 shows up.
    expect(named.get('E()')?.value).toBe('[2,3] = 0, 0, 0, 0, 0, 0, 0, 9, …');
    m.dispose();
  });

  it('says a string or an array is undimensioned rather than reading a buffer', () => {
    // Naming one in a DIM the program never reaches leaves the entry in the
    // value table with nothing allocated behind it; a reader that followed the
    // offset anyway would print whatever happened to be in string space.
    const m = run('10 END\n20 DIM Z$(10),Y(3)\n');
    const named = new Map(m.readVariables().map((v) => [v.name, v]));
    expect(named.get('Z$')).toMatchObject({
      kind: 'string',
      value: 'undimensioned',
    });
    expect(named.get('Y()')).toMatchObject({
      kind: 'number-array',
      value: 'undimensioned',
    });
    m.dispose();
  });

  it('answers with nothing before a program has run', () => {
    const m = machine();
    expect(m.readVariables()).toEqual([]);
    m.dispose();
  });
});

describe('Atari memory figures', () => {
  it('reports the free bytes FRE(0) does', () => {
    const m = run('10 PRINT FRE(0)\n20 END\n');
    const printed = Number(
      /\b(\d{4,5})\b/.exec(m.readScreenText()?.lines.join('\n') ?? '')?.[1],
    );
    const stats = m.readMemoryStats();
    expect(stats).not.toBeNull();
    // The same subtraction the function performs, so the panel and the program
    // cannot disagree about how much room is left.
    expect(stats!.free).toBe(printed);
    m.dispose();
  });

  it('counts the string and array space, not just the program text', () => {
    const small = run('10 DIM A(1)\n20 END\n');
    const large = run('10 DIM A(500)\n20 END\n');
    const grew = large.readMemoryStats()!.used - small.readMemoryStats()!.used;
    // 499 more elements of six BCD bytes each; the figure moves with what the
    // program allocated at run time, which a program-text measure could not see.
    expect(grew).toBe(499 * 6);
    expect(large.readMemoryStats()!.free).toBeLessThan(
      small.readMemoryStats()!.free,
    );
    small.dispose();
    large.dispose();
  });

  it('gives the 400 less room than the 800, from the same program', () => {
    const small = run('10 END\n', '400');
    const big = run('10 END\n', '800');
    expect(small.readMemoryStats()!.used).toBe(big.readMemoryStats()!.used);
    expect(big.readMemoryStats()!.free - small.readMemoryStats()!.free).toBe(
      0xa000 - 0x4000,
    );
    small.dispose();
    big.dispose();
  });

  it('has no figure to give with no ROM installed', () => {
    const m = new AtariMachine({ model: '800', rom: new Uint8Array(0) });
    expect(m.readMemoryStats()).toBeNull();
    m.dispose();
  });

  it('charges the bytes a line takes to that line', () => {
    const m = machine();
    m.loadProgram(atari800.tokenize('10 A=1\n20 DIM B(500)\n30 END\n').image);
    m.setProfileRecording(true);
    for (let frame = 0; frame < 120; frame++) m.runFrame();
    const costs = m.drainProfile()!;
    const allocated = (line: number) =>
      costs.find((c) => c.line === line)?.allocated ?? 0;
    expect(allocated(20)).toBe(501 * 6);
    expect(allocated(10)).toBe(0);
    m.setProfileRecording(false);
    m.dispose();
  });
});

describe('Atari runtime report', () => {
  it('reads an error, its message and the line it happened on', () => {
    const m = run('10 A=1\n20 PRINT 1/0\n30 END\n');
    expect(m.readReport()).toEqual({
      isError: true,
      message: 'Floating point overflow or underflow',
      code: '11',
      line: 20,
    });
    m.dispose();
  });

  it('reports a clean end as no error', () => {
    const m = run('10 PRINT "DONE"\n20 END\n');
    expect(m.readReport()).toEqual({ isError: false, message: 'OK' });
    m.dispose();
  });

  it('does not call a STOP an error', () => {
    const m = run('10 A=1\n20 STOP\n');
    expect(m.readReport()).toEqual({
      isError: false,
      message: 'Stopped',
      line: 20,
    });
    m.dispose();
  });

  it('reads the BREAK key stopping a program as a stop, not a failure', () => {
    const m = machine();
    m.loadProgram(atari800.tokenize('10 A=A+1\n20 GOTO 10\n').image);
    for (let frame = 0; frame < 60; frame++) m.runFrame();
    expect(m.isProgramRunning(), 'the loop should still be going').toBe(true);
    m.setKey('Break', true);
    for (let frame = 0; frame < 20; frame++) m.runFrame();
    m.setKey('Break', false);
    for (let frame = 0; frame < 40; frame++) m.runFrame();
    // The same printed line a STOP statement leaves, and the line the program
    // was on when the key went down.
    expect(m.readReport()).toEqual({
      isError: false,
      message: 'Stopped',
      line: 10,
    });
    m.dispose();
  });

  it('does not call a TRAPped error one either', () => {
    // The cells alone cannot tell this from the untrapped case above: BASIC
    // leaves the code and the line in place for the program to PEEK at, which
    // is what TRAP is for. Only the absence of a printed report separates them.
    const m = run(
      '10 TRAP 40\n20 PRINT 1/0\n30 END\n40 PRINT "CAUGHT"\n50 END\n',
    );
    expect(m.readScreenText()?.lines.join('\n')).toContain('CAUGHT');
    expect(m.readReport()).toEqual({ isError: false, message: 'OK' });
    m.dispose();
  });

  it('finds the report in the text window a graphics mode leaves', () => {
    // GRAPHICS 1 keeps its own screen and prints into the four rows at the
    // foot, so the report is nowhere near where readScreenText looks.
    const m = run('10 GRAPHICS 1\n20 GOTO 500\n');
    expect(m.readReport()).toMatchObject({
      isError: true,
      code: '12',
      line: 20,
    });
    m.dispose();
  });

  it('answers a READ past the end of DATA the way the cartridge does', () => {
    // The manual documents 6 for this; Altirra BASIC answers 8, the INPUT
    // statement error. Pinned so that a change of cartridge is noticed here
    // rather than as a wrong message in front of a user.
    const m = run('10 DATA 1\n20 READ A,B\n');
    expect(m.readReport()).toMatchObject({
      isError: true,
      code: '8',
      line: 20,
    });
    m.dispose();
  });

  it('names the codes it knows and falls back to the number for the rest', () => {
    expect(atariErrorMessage(9)).toBe('Array or string DIM error');
    expect(atariErrorMessage(138)).toBe('Device timeout');
    expect(atariErrorMessage(200)).toBe('Error 200');
  });
});
