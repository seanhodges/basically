// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitRomImage } from './romImage';
import { tokenizeProgram } from './tokenizer';
import { Pmd85Machine } from './emulator/pmd85Machine';
import {
  FRETOP,
  PROGRAM_BASE,
  STACK_TOP,
  STREND,
  STRING_BASE,
  STRING_TOP,
} from './addresses';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85/pmd85.rom')),
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

// The four-byte float itself is pinned in `emulator/microsoftBasicVars.test.ts`,
// with the decoder both 8080 machines share. What is left here is this
// machine's own readback: its pointers, its table, its charset.
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

describe('pmd85 memory activity', () => {
  it('records what the program touches, and only while armed', () => {
    const pmd = new Pmd85Machine(splitRomImage(rom));
    pmd.loadProgram(tokenizeProgram("10 POKE '7000,42\n20 GOTO 20\n").program);
    for (let frame = 0; frame < 60; frame++) pmd.runFrame();
    expect(pmd.drainMemoryActivity()).toBeNull();

    pmd.setMemoryActivityRecording(true);
    for (let frame = 0; frame < 60; frame++) pmd.runFrame();
    const hits = pmd.drainMemoryActivity()!;
    expect(hits.length).toBe(0x10000);
    // The interpreter is a copy in RAM at address 0, so a running program
    // touches the bottom of memory constantly - that is the machine, not an
    // artefact of the probe.
    expect(hits.subarray(0, 0x2400).some((byte) => byte !== 0)).toBe(true);
  });

  it('does not stamp what the IDE itself reads', () => {
    // The watcher, the memory figures and the profiler's line sampling all poll
    // this bus while the program runs. Recording their reads would paint the
    // overlay with accesses the program never made, which is why the machine
    // reads through `peek` and `rawReadWord` rather than through the CPU path.
    const pmd = new Pmd85Machine(splitRomImage(rom));
    pmd.loadProgram(tokenizeProgram('10 A=1\n20 END\n').program);
    for (let frame = 0; frame < 200 && pmd.isProgramRunning(); frame++) {
      pmd.runFrame();
    }
    pmd.setMemoryActivityRecording(true);
    pmd.drainMemoryActivity();

    // No frames run: nothing but the IDE's own reading happens here.
    expect(pmd.readVariables().length).toBeGreaterThan(0);
    expect(pmd.readMemoryStats()).not.toBeNull();
    pmd.currentLine();
    pmd.readScreenText();

    const hits = pmd.drainMemoryActivity()!;
    expect(hits.some((byte) => byte !== 0)).toBe(false);
  });
});

describe('pmd85 memory figures', () => {
  /** Builds a 30-character string a character at a time, then stops. */
  const BUILDS_A_STRING =
    '10 A$=""\n20 FOR I=1 TO 30\n30 A$=A$+"X"\n40 NEXT I\n50 END\n';

  it('counts the string pool as well as the program area', () => {
    // FRETOP (see addresses.ts) was read out of the shipped interpreter, and a
    // pointer read out of a ROM is exactly the fact a future ROM swap breaks
    // silently. What pins it is behaviour: only strings move it, and only a
    // built string moves it at all - a literal assignment points the descriptor
    // at the program text and takes no pool at all.
    const pmd = run(BUILDS_A_STRING);
    const stats = pmd.readMemoryStats()!;
    const programArea = pmd.mem.rawReadWord(STREND) - PROGRAM_BASE;
    expect(stats.used - programArea).toBeGreaterThanOrEqual(30);
    // The two pools are disjoint and neither can spill into the other, so the
    // total is the machine's, whatever the program has done with it.
    expect(stats.used + stats.free).toBe(
      STACK_TOP - PROGRAM_BASE + (STRING_TOP - STRING_BASE),
    );
  });

  it('leaves the program-area figures alone when the pointer is unreadable', () => {
    // A string pointer outside its own region is not a figure, and adding it
    // would report a machine with more or less RAM than it has.
    const pmd = run(BUILDS_A_STRING);
    const real = pmd.readMemoryStats()!;
    pmd.mem.writeWord(FRETOP, 0x1234);
    const fallback = pmd.readMemoryStats()!;
    expect(fallback.used).toBeLessThan(real.used);
    expect(fallback.used).toBe(pmd.mem.rawReadWord(STREND) - PROGRAM_BASE);
    expect(fallback.used + fallback.free).toBe(STACK_TOP - PROGRAM_BASE);
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
