// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAtPrompt, readApple2Report } from './reports';
import { apple2 } from './index';
import { Apple2Machine } from '../../emulator/apple2/apple2Machine';
import { integerBasicSupport } from './machineSupport';

const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple2.rom')),
);

/** Fields a program is given to fail in; each of these fails in the first few. */
const MAX_FIELDS = 600;

/** Run a listing to a stop and ask the machine what it says about itself. */
function reportOf(source: string) {
  const machine = new Apple2Machine({ rom: ROM, basic: integerBasicSupport });
  const { image, errors } = apple2.tokenize(source);
  expect(errors, source).toEqual([]);
  machine.loadProgram(image);
  for (let field = 0; field < MAX_FIELDS; field++) {
    machine.runFrame();
    if (machine.isProgramRunning() === false) break;
  }
  return machine.readReport();
}

/** A screen of `lines`, padded as the machine's own reader hands them over. */
function screenOf(lines: string[]) {
  return {
    lines: lines.map((l) => l.padEnd(40, ' ')),
    cols: 40,
    rows: lines.length,
  };
}

/**
 * The reports the interpreter actually prints, provoked at the machine rather
 * than transcribed. One test with a table because the boot is the cost and the
 * assertions are not; the row is named in the failure so a wrong spelling says
 * which one it was.
 */
describe('reports provoked on the machine', () => {
  const CASES: readonly [string, string, string, number | undefined][] = [
    ['RANGE', '10 DIM D(4)\n20 D(9)=1\n30 END', 'RANGE', 20],
    ['BAD BRANCH', '10 GOTO 999\n20 END', 'BAD BRANCH', 10],
    ['16 GOSUBS', '10 GOSUB 10\n20 END', '16 GOSUBS', 10],
    ['BAD RETURN', '10 RETURN\n20 END', 'BAD RETURN', 10],
    ['BAD NEXT', '10 NEXT I\n20 END', 'BAD NEXT', 10],
    ['>32767', '10 A=32767\n20 A=A+A\n30 END', '>32767', 20],
    ['division by zero', '10 A=1/0\n20 END', '>32767', 10],
    ['>255', '10 POKE 768,300\n20 END', '>255', 10],
    ['STR OVFL', '10 DIM A$(3)\n20 A$="HELLO"\n30 END', 'STR OVFL', 20],
    [
      'STRING',
      '10 DIM A$(5)\n20 A$="ABC"\n30 PRINT A$(1,9)\n40 END',
      'STRING',
      30,
    ],
    // The one report with no line to name: the program reached it by not
    // stopping, so there is no statement to blame.
    ['NO END', '10 PRINT "HI"', 'NO END', undefined],
  ];

  it('names each one and the line it stopped on', () => {
    for (const [label, source, code, line] of CASES) {
      const report = reportOf(source);
      expect(report, label).toMatchObject({ isError: true, code });
      expect(report!.line, label).toBe(line);
      expect(report!.message, label).not.toBe('');
    }
  });

  it('reports sixteen FORs, which is not the eight the Apple I allows', () => {
    // The stack depth is this ROM's, and the message spells the number, so a
    // table ported from the Apple I would miss on both.
    let source = '';
    const names = 'ABCDEFGHIJKLMNOPQRS';
    for (let i = 0; i < names.length; i++) {
      source += `${10 + i} FOR ${names[i]}=1 TO 2\n`;
    }
    expect(reportOf(source + '900 END')).toMatchObject({
      isError: true,
      code: '16 FORS',
    });
  });

  it('says the machine is idle when a program simply finishes', () => {
    expect(reportOf('10 PRINT "HI"\n20 END')).toEqual({
      isError: false,
      message: '>',
    });
  });

  it('says nothing at all while the machine is still at the monitor', () => {
    // A `*` prompt is not this interpreter's, and the post-run check counts a
    // machine that says nothing as one that never started.
    const machine = new Apple2Machine({ rom: ROM, basic: integerBasicSupport });
    expect(machine.readReport()).toBeNull();
  });

  it('reads a break as a stop rather than as a failure', () => {
    // CTRL-C is the one key that stops a running program on this machine, and
    // the interpreter names the line without printing an error above it.
    const machine = new Apple2Machine({ rom: ROM, basic: integerBasicSupport });
    const { image } = apple2.tokenize('10 FOR I=1 TO 30000\n20 NEXT I\n30 END');
    machine.loadProgram(image);
    for (let field = 0; field < 60; field++) machine.runFrame();
    machine.setKey('Control', true);
    machine.setKey('KeyC', true);
    machine.setKey('KeyC', false);
    machine.setKey('Control', false);
    for (let field = 0; field < MAX_FIELDS; field++) {
      machine.runFrame();
      if (machine.isProgramRunning() === false) break;
    }
    expect(machine.readReport()).toMatchObject({ isError: false, line: 10 });
  });
});

describe('reading the screen the reports are printed on', () => {
  it('finds a report that did not start its own line', () => {
    // The interpreter breaks the line first only when its column counter says
    // the carriage has moved, so a PRINT ending in `;` leaves the report on the
    // end of the program's own output.
    expect(
      readApple2Report(
        screenOf(['SCORE=12*** RANGE ERR', 'STOPPED AT 40', '>']),
      ),
    ).toMatchObject({ isError: true, code: 'RANGE', line: 40 });
  });

  it('carries an unknown name through as its own message', () => {
    // A different build of the interpreter still reports; what it loses is the
    // sentence, not the fact that the program failed.
    expect(readApple2Report(screenOf(['*** WHAT ERR', '>']))).toEqual({
      isError: true,
      message: '*** WHAT ERR',
      code: 'WHAT',
    });
  });

  it('says nothing when the text page is not on screen', () => {
    // Full-screen GR: the interpreter still prints into the page, and nobody
    // can see it. Reading it anyway would report whatever was there before.
    expect(readApple2Report(null)).toBeNull();
  });

  it('takes the prompt only as the last thing on screen', () => {
    expect(isAtPrompt(['>', ''])).toBe(true);
    expect(isAtPrompt(['>', 'STILL GOING'])).toBe(false);
    expect(isAtPrompt(['> AND MORE'])).toBe(false);
    expect(isAtPrompt([])).toBe(false);
  });
});
