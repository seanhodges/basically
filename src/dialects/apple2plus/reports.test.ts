// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAtPrompt, readApple2plusReport } from './reports';
import { apple2plus } from './index';
import { Apple2Machine } from '../../emulator/apple2/apple2Machine';
import { applesoftSupport } from './machineSupport';
import { ERROR_TABLE } from './addresses';

const ROM = new Uint8Array(
  readFileSync(
    join(__dirname, '../../../public/roms/apple2plus/apple2plus.rom'),
  ),
);

/** Fields a program is given to fail in; each of these fails in the first few. */
const MAX_FIELDS = 900;

/** Run a listing to a stop and ask the machine what it says about itself. */
function reportOf(source: string) {
  const machine = new Apple2Machine({ rom: ROM, basic: applesoftSupport });
  const { image, errors } = apple2plus.tokenize(source);
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
  const CASES: readonly [string, string, number | undefined][] = [
    ['NEXT WITHOUT FOR', '10 NEXT I\n20 END', 10],
    ['RETURN WITHOUT GOSUB', '10 RETURN\n20 END', 10],
    ['OUT OF DATA', '10 READ A\n20 END', 10],
    ['ILLEGAL QUANTITY', '10 A = LOG(0)\n20 END', 10],
    ['OVERFLOW', '10 A = 1E38\n20 A = A * A\n30 END', 20],
    ['OUT OF MEMORY', '10 DIM A(20000)\n20 END', 10],
    ["UNDEF'D STATEMENT", '10 GOTO 999\n20 END', 10],
    ['BAD SUBSCRIPT', '10 DIM D(4)\n20 D(9) = 1\n30 END', 20],
    ["REDIM'D ARRAY", '10 DIM D(4)\n20 DIM D(4)\n30 END', 20],
    ['DIVISION BY ZERO', '10 A = 1 / 0\n20 END', 10],
    ['TYPE MISMATCH', '10 A = "X"\n20 END', 10],
    [
      'STRING TOO LONG',
      '10 A$ = "0123456789"\n20 FOR I = 1 TO 5\n30 A$ = A$ + A$\n40 NEXT I\n50 END',
      30,
    ],
    ["UNDEF'D FUNCTION", '10 A = FN Q(1)\n20 END', 10],
  ];

  it('names each one and the line it stopped on', () => {
    for (const [code, source, line] of CASES) {
      const report = reportOf(source);
      expect(report, code).toMatchObject({ isError: true, code });
      expect(report!.line, code).toBe(line);
      expect(report!.message, code).not.toBe('');
      // The sentence is this project's, so a code that fell through to the
      // printed line would still pass the check above.
      expect(report!.message, code).not.toContain('ERROR');
    }
  });

  it('carries a sentence for every message in the ROM’s own table', () => {
    // The provoked cases above are the ones a RUN can reach; ILLEGAL DIRECT and
    // CAN'T CONTINUE are raised only by a line typed at the prompt, and
    // FORMULA TOO COMPLEX by an expression the tokenizer will not build. So the
    // table itself is the check that none of the seventeen has been missed:
    // walked out of this ROM, as the keyword table is, and asked of the reader
    // through the line the interpreter would have printed.
    const at = (address: number) => ROM[address - 0xd000]!;
    const names: string[] = [];
    for (let a = ERROR_TABLE, text = ''; a < ERROR_TABLE + 0x100; a++) {
      const byte = at(a);
      // The names end on a bit-7 byte each; the ` ERROR` suffix that follows
      // them is a $00-terminated string instead, so the first $00 is the end of
      // the names whatever else the ROM keeps behind it.
      if (byte === 0x00) break;
      text += String.fromCharCode(byte & 0x7f);
      if ((byte & 0x80) === 0) continue;
      names.push(text);
      text = '';
    }
    expect(names).toHaveLength(17);
    for (const name of names) {
      const report = readApple2plusReport(screenOf([`?${name} ERROR IN 10`]));
      expect(report, name).toMatchObject({ isError: true, code: name });
      expect(report!.message, `${name} has no sentence`).not.toContain('ERROR');
    }
  });

  it('says the machine is idle when a program simply finishes', () => {
    // Applesoft has no report for running off the last line - the sibling's
    // *** NO END ERR has no counterpart here, and both listings below just
    // return to the prompt.
    expect(reportOf('10 PRINT "HI"\n20 END')).toEqual({
      isError: false,
      message: ']',
    });
    expect(reportOf('10 PRINT "HI"')).toEqual({
      isError: false,
      message: ']',
    });
  });

  it('says nothing at all before the interpreter has signed on', () => {
    // The post-run check in `src/app/aiRunCheck.ts` counts a machine that says
    // nothing as one that never started, and on the first field this one has
    // not printed its prompt yet.
    const machine = new Apple2Machine({ rom: ROM, basic: applesoftSupport });
    expect(machine.readReport()).toBeNull();
  });

  it('reads a break as a stop rather than as a failure', () => {
    // CTRL-C is the one key that stops a running program on this machine, and
    // the interpreter prints BREAK IN <line> with no ? and no ERROR - which is
    // why it cannot be folded into the error pattern.
    const machine = new Apple2Machine({ rom: ROM, basic: applesoftSupport });
    const { image } = apple2plus.tokenize(
      '10 FOR I = 1 TO 30000\n20 NEXT I\n30 END',
    );
    machine.loadProgram(image);
    for (let field = 0; field < 200; field++) machine.runFrame();
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
  it('takes the line number off the same line as the report', () => {
    // Not the sibling's shape: that one prints STOPPED AT 40 underneath, and a
    // reader ported across would find no line at all here.
    expect(
      readApple2plusReport(screenOf(['?BAD SUBSCRIPT ERROR IN 40', ']'])),
    ).toMatchObject({ isError: true, code: 'BAD SUBSCRIPT', line: 40 });
  });

  it('finds a report that did not start its own line', () => {
    // The interpreter does break the line first, but the screen wraps at 40
    // columns without one, so the pattern is not anchored to column 0.
    expect(
      readApple2plusReport(screenOf(['SCORE=12?SYNTAX ERROR IN 30', ']'])),
    ).toMatchObject({ isError: true, code: 'SYNTAX', line: 30 });
  });

  it('reads a report with no line, as a direct-mode failure has none', () => {
    const report = readApple2plusReport(screenOf(['?SYNTAX ERROR', ']']));
    expect(report).toEqual({
      isError: true,
      message: 'Syntax error',
      code: 'SYNTAX',
    });
  });

  it('carries an unknown name through as its own message', () => {
    // A different build of the interpreter still reports; what it loses is the
    // sentence, not the fact that the program failed.
    expect(readApple2plusReport(screenOf(['?WHAT ERROR IN 10', ']']))).toEqual({
      isError: true,
      message: '?WHAT ERROR IN 10',
      code: 'WHAT',
      line: 10,
    });
  });

  it('says nothing when the text page is not on screen', () => {
    // Full-screen HGR: the interpreter still prints into the page, and nobody
    // can see it. Reading it anyway would report whatever was there before.
    expect(readApple2plusReport(null)).toBeNull();
  });

  it('takes the prompt only as the last thing on screen', () => {
    expect(isAtPrompt([']', ''])).toBe(true);
    expect(isAtPrompt([']', 'STILL GOING'])).toBe(false);
    expect(isAtPrompt(['] AND MORE'])).toBe(false);
    // The sign-on banner carries a ] in the middle of APPLE ][, which is
    // exactly what anchoring to the whole row keeps out.
    expect(isAtPrompt(['               APPLE ]['])).toBe(false);
    expect(isAtPrompt([])).toBe(false);
  });
});
