// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isAtPrompt, readApple1Report } from './reports';
import { apple1 } from './index';
import { Apple1Machine } from '../../emulator/apple1/apple1Machine';

const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple1/apple1.rom')),
);

/** Load, run to a stop, and let the terminal catch up with what was printed. */
function ran(source: string): Apple1Machine {
  const machine = new Apple1Machine({ rom: ROM });
  const { image, errors } = apple1.tokenize(source);
  expect(errors).toEqual([]);
  machine.loadProgram(image);
  for (let field = 0; field < 4000; field++) {
    machine.runFrame();
    if (machine.isProgramRunning() === false) break;
  }
  // The report is printed a character a field after the run ends, so the
  // machine is given the time the display needs before it is read.
  for (let field = 0; field < 200; field++) machine.runFrame();
  return machine;
}

describe('readApple1Report', () => {
  it('names the error and the line the interpreter stopped at', () => {
    expect(
      readApple1Report(['>RUN', '*** RANGE ERR', 'STOPPED AT 20', '>']),
    ).toEqual({
      isError: true,
      code: 'RANGE',
      message: 'Subscript outside the DIM',
      line: 20,
    });
  });

  it('reports a name it does not know, rather than dropping the error', () => {
    // A different build of the interpreter is still reporting an error, and an
    // unrecognised name is no reason to tell the IDE the run went fine.
    expect(readApple1Report(['*** WHAT ERR', 'STOPPED AT 5'])).toEqual({
      isError: true,
      code: 'WHAT',
      message: '*** WHAT ERR',
      line: 5,
    });
  });

  it('leaves the line out when the interpreter names none', () => {
    // Running past the last line is the one error reached by *not* stopping,
    // so there is no line to print under it.
    expect(readApple1Report(['HI', '*** END ERR', '>'])).toEqual({
      isError: true,
      code: 'END',
      message: 'The program ran past its last line',
    });
  });

  it('finds a report printed onto the end of the program’s own output', () => {
    // `PRINT "X";` leaves the carriage mid-line, and the interpreter only
    // breaks the line when its column counter says it has moved - so the
    // report is not anchored to column 0.
    expect(readApple1Report(['SCORE: 12*** BAD NEXT ERR'])).toEqual({
      isError: true,
      code: 'BAD NEXT',
      message: 'NEXT with no FOR to continue',
    });
  });

  it('calls the bare prompt a report, so a finished machine is not silence', () => {
    expect(readApple1Report(['>RUN', 'HI', '>'])).toEqual({
      isError: false,
      message: '>',
    });
    // Mid-run there is neither a report nor a prompt.
    expect(readApple1Report(['>RUN', 'HI'])).toBeNull();
  });

  it('takes only the last non-blank row as the prompt', () => {
    expect(isAtPrompt(['>RUN', '>', '', ''])).toBe(true);
    expect(isAtPrompt(['>', '>RUN'])).toBe(false);
    expect(isAtPrompt(['> 5'])).toBe(false);
    expect(isAtPrompt([])).toBe(false);
  });
});

describe('what the machine itself reports', () => {
  it('reads a runtime error and its line back off the terminal', () => {
    const report = ran('10 DIM D(4)\n20 D(9)=1\n30 END').readReport();
    expect(report).toEqual({
      isError: true,
      code: 'RANGE',
      message: 'Subscript outside the DIM',
      line: 20,
    });
  });

  it('reports running past the last line, which this BASIC calls an error', () => {
    expect(ran('10 PRINT "HI"').readReport()).toMatchObject({
      isError: true,
      code: 'END',
    });
  });

  it('says a clean run is not an error', () => {
    expect(ran('10 PRINT "HI"\n20 END').readReport()).toEqual({
      isError: false,
      message: '>',
    });
  });

  it('has nothing to say with no interpreter fitted', () => {
    // A monitor-only image: there is no BASIC to report anything, and the
    // notice on the terminal must not read as one.
    const monitorOnly = new Uint8Array(ROM.length).fill(0xff);
    monitorOnly.set(ROM.subarray(0, 0x100));
    expect(new Apple1Machine({ rom: monitorOnly }).readReport()).toBeNull();
  });
});
