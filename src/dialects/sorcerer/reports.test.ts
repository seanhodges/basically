// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The runtime-report reader, checked twice over: against hand-written screens,
 * which is where the awkward shapes can be posed at all, and against real runs
 * on the real ROM, which is what says the hand-written screens are the ones
 * this machine actually draws.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAtReadyPrompt, readSorcererReport } from './reports';
import { splitRomImage } from './romImage';
import { tokenizeProgram } from './tokenizer';
import { buildBasicImage } from './basicImage';
import { SorcererMachine } from '../../emulator/sorcerer/sorcererMachine';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/sorcerer/sorcerer.rom')),
);

/** Frames a program that should stop quickly is given before it is called stuck. */
const MAX_RUN_FRAMES = 400;

function run(source: string): SorcererMachine {
  const sorcerer = new SorcererMachine(splitRomImage(rom));
  const { program, errors } = tokenizeProgram(source);
  expect(errors.filter((e) => e.fatal !== false)).toEqual([]);
  sorcerer.loadProgram(buildBasicImage(program));
  for (let frame = 0; frame < MAX_RUN_FRAMES; frame++) {
    sorcerer.runFrame();
    if (sorcerer.isProgramRunning() === false) break;
  }
  return sorcerer;
}

describe('sorcerer report reader', () => {
  it('spells out the code the interpreter printed', () => {
    expect(
      readSorcererReport(['RUN', '?SN ERROR IN 100', 'READY', '_']),
    ).toEqual({
      isError: true,
      message: 'Syntax error',
      code: 'SN',
      line: 100,
    });
    // The two codes a `[A-Z]{2}` reader would miss: the one that is not two
    // letters, and the one the Altair's ROM does not have.
    expect(readSorcererReport(['?/0 ERROR IN 10'])).toMatchObject({
      code: '/0',
      message: 'Division by zero',
    });
    expect(readSorcererReport(['?MO ERROR IN 10'])).toMatchObject({
      code: 'MO',
      message: 'Missing operand',
    });
  });

  it('still reports a code it has no sentence for', () => {
    // The table says what a code means; it is not what detects one. A different
    // ROM's addition still stops the run, and the IDE still has to say so.
    expect(readSorcererReport(['?ZZ ERROR IN 40'])).toEqual({
      isError: true,
      message: '?ZZ ERROR IN 40',
      code: 'ZZ',
      line: 40,
    });
  });

  it('finds an error that did not start its own line', () => {
    // BASIC breaks the line first only when its column counter says the
    // carriage has moved, so an error after a PRINT with a trailing semicolon
    // lands on the end of the program's own output.
    expect(readSorcererReport(['SCORE: 12?FC ERROR IN 70'])).toMatchObject({
      code: 'FC',
      line: 70,
    });
  });

  it('does not call a STOP an error', () => {
    const report = readSorcererReport(['A', 'BREAK IN 20', 'READY', '_'])!;
    expect(report.isError).toBe(false);
    expect(report.message).toBe('BREAK IN 20');
    expect(report.line).toBe(20);
  });

  it('prefers the error to the prompt printed after it', () => {
    // Both are on screen once a failed run is over, and only one of them is
    // what the IDE should offer to fix.
    expect(readSorcererReport(['?OM ERROR IN 30', 'READY', '_'])!.isError).toBe(
      true,
    );
  });

  it('has nothing to say while a program is still running', () => {
    expect(readSorcererReport(['RUN', 'ROW 1', 'ROW 2_'])).toBeNull();
  });

  it('looks past the cursor’s own row to find the prompt', () => {
    // The caret is a real byte in screen RAM, so the row under the prompt is
    // never blank; a reader taking the last non-blank row would never see a
    // prompt at all.
    expect(isAtReadyPrompt(['READY', '_'])).toBe(true);
    expect(isAtReadyPrompt(['READY', '_', '', ''])).toBe(true);
    expect(isAtReadyPrompt(['READY', 'STILL PRINTING'])).toBe(false);
    expect(isAtReadyPrompt([])).toBe(false);
  });
});

describe('sorcerer reports, off the booted ROM', () => {
  it('reads back a real runtime error and the line it stopped on', () => {
    const sorcerer = run('10 GOTO 999\n');
    expect(sorcerer.readReport()).toEqual({
      isError: true,
      message: 'Undefined line number',
      code: 'UL',
      line: 10,
    });
    sorcerer.dispose();
  });

  it('reports a clean end as the prompt, and a STOP as a break', () => {
    const done = run('10 PRINT "HI"\n20 END\n');
    expect(done.readReport()).toEqual({ isError: false, message: 'READY' });
    done.dispose();

    // Printed in the same frame an error is, and CONT would resume it - so a
    // reader matching the shape alone would offer to fix a working program.
    const stopped = run('10 PRINT "A";\n20 STOP\n');
    expect(stopped.readReport()).toMatchObject({ isError: false, line: 20 });
    stopped.dispose();
  });

  it('answers nothing at all without a ROM, or after disposal', () => {
    const empty = new SorcererMachine({
      monitor: new Uint8Array(0),
      romPac: new Uint8Array(0),
      charGen: new Uint8Array(0),
    });
    expect(empty.readReport()).toBeNull();
    expect(empty.readMemoryStats()).toBeNull();
    expect(empty.readVariables()).toEqual([]);

    const sorcerer = run('10 END\n');
    sorcerer.dispose();
    expect(sorcerer.readReport()).toBeNull();
    expect(sorcerer.readMemoryStats()).toBeNull();
    expect(sorcerer.readVariables()).toEqual([]);
  });
});
