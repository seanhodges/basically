// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from '../tokenizer';
import { COLS, ROWS } from './terminal';
import { Ge235InterpreterMachine } from './machine';

/** As in the interpreter's own tests: enough frames to cover a compile pause. */
const MAX_FRAMES = 3000;

function load(source: string): Ge235InterpreterMachine {
  const machine = new Ge235InterpreterMachine();
  machine.loadProgram(tokenizeProgram(source).image);
  return machine;
}

describe('Ge235InterpreterMachine', () => {
  it('reads blank paper as blanks rather than as no answer', () => {
    // null is reserved for "cannot determine", which is unreachable here: there
    // is no ROM to boot and the roll exists from construction.
    const machine = new Ge235InterpreterMachine();
    const screen = machine.readScreenText()!;
    expect(screen).not.toBeNull();
    expect(screen.lines).toHaveLength(ROWS);
    for (const line of screen.lines) expect([...line]).toHaveLength(COLS);
    expect(screen.lines.join('').trim()).toBe('');
    machine.dispose();
  });

  it('answers whether a program is running, and stops saying so', () => {
    const machine = load('10 PRINT "HI"\n20 END\n');
    // The compile counts: the machine has the program from the moment the tape
    // is in, and reporting "finished" through the pause would be a lie.
    expect(machine.isProgramRunning()).toBe(true);
    let frames = 0;
    while (frames < MAX_FRAMES && machine.isProgramRunning()) {
      machine.runFrame();
      frames++;
    }
    expect(machine.isProgramRunning()).toBe(false);
    expect(frames).toBeLessThan(MAX_FRAMES);
    expect(machine.readScreenText()!.lines[0]!.trimEnd()).toBe('HI');
    machine.dispose();
  });

  it('pauses before any output, because the program is being compiled', () => {
    const machine = load('10 PRINT "HI"\n20 END\n');
    machine.runFrame();
    expect(machine.readScreenText()!.lines.join('').trim()).toBe('');
    expect(machine.isProgramRunning()).toBe(true);
    machine.dispose();
  });

  it('reports the fault a run stopped on, with its line', () => {
    const machine = load('10 PRINT 1/0\n20 END\n');
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    const report = machine.readReport()!;
    expect(report.isError).toBe(true);
    expect(report.message).toBe('division by zero');
    expect(report.line).toBe(10);
    machine.dispose();
  });

  it('reports a clean run with the line the machine closed it with', () => {
    const machine = load('10 PRINT "HI"\n20 END\n');
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    const report = machine.readReport()!;
    expect(report.isError).toBe(false);
    expect(report.message).toMatch(/^time\s+0\s+secs\.$/);
    machine.dispose();
  });

  it('feeds fresh paper and starts the same tape again on reset', () => {
    const machine = load('10 PRINT "HI"\n20 END\n');
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    machine.reset();
    expect(machine.readScreenText()!.lines.join('').trim()).toBe('');
    expect(machine.isProgramRunning()).toBe(true);
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    expect(machine.readScreenText()!.lines[0]!.trimEnd()).toBe('HI');
    machine.dispose();
  });

  it('takes typed characters from key events and virtual keys alike', () => {
    const machine = load('10 INPUT A\n20 PRINT A\n30 END\n');
    for (let i = 0; i < MAX_FRAMES; i++) {
      machine.runFrame();
      if (machine.interpreter.state === 'input') break;
    }
    machine.setKey('Digit7', true);
    machine.keyEvent({ key: 'Enter' } as KeyboardEvent, true);
    machine.releaseAllKeys();
    for (let i = 0; i < MAX_FRAMES && machine.isProgramRunning(); i++) {
      machine.runFrame();
    }
    expect(machine.readScreenText()!.lines[0]!.trimEnd()).toBe('? 7');
    machine.dispose();
  });
});
