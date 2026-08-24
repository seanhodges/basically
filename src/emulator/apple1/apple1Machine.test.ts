// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Apple1Machine, CYCLES_PER_FIELD } from './apple1Machine';
import { CLEAR_SCREEN_TOKEN, RESET_TOKEN } from './keyboard';
import { apple1 } from '../../dialects/apple1';
import { fitRomImage } from '../../app/romImage';
import {
  FIRMWARE_BYTES,
  HIMEM,
  LOMEM,
  MONITOR_BYTES,
  PP,
} from '../../dialects/apple1/addresses';

/**
 * The firmware ships, so these read it rather than skipping when it is absent -
 * the arrangement the Altair needs does not apply here (see
 * `public/roms/ATTRIBUTION.md`). Everything below is the machine's own answer
 * to a question asked at its keyboard, not an expectation about the adapter.
 */
const ROM = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/apple1.rom')),
);

/** WozMon's prompt; Integer BASIC's is `>`. */
const MONITOR_PROMPT = '\\';

/** Tokens for the characters these tests type at the virtual keyboard. */
const TOKENS: Record<string, string> = { ' ': 'Space', '\r': 'Enter' };

function tokenFor(ch: string): string {
  return TOKENS[ch] ?? (/[0-9]/.test(ch) ? `Digit${ch}` : `Key${ch}`);
}

/** Type at the virtual keyboard, then give the machine time to answer. */
function type(machine: Apple1Machine, text: string, fields: number): void {
  for (const ch of text) {
    const token = tokenFor(ch);
    machine.setKey(token, true);
    machine.setKey(token, false);
  }
  for (let i = 0; i < fields; i++) machine.runFrame();
}

/** Run until `done`, returning the fields it took, or -1 if it never did. */
function runUntil(
  machine: Apple1Machine,
  done: () => boolean,
  cap: number,
): number {
  for (let field = 0; field < cap; field++) {
    machine.runFrame();
    if (done()) return field + 1;
  }
  return -1;
}

function tokenize(source: string): Uint8Array {
  const { image, errors } = apple1.tokenize(source);
  expect(errors).toEqual([]);
  return image;
}

/** A machine with a program loaded and its `RUN` typed, run to completion. */
function ran(source: string, cap = 600): Apple1Machine {
  const machine = new Apple1Machine({ rom: ROM });
  machine.loadProgram(tokenize(source));
  runUntil(machine, () => machine.isProgramRunning() === false, cap);
  return machine;
}

describe('Apple1Machine', () => {
  it('boots the monitor and reaches its prompt', () => {
    const machine = new Apple1Machine({ rom: ROM });
    expect([machine.hasMonitor, machine.hasInterpreter]).toEqual([true, true]);
    expect(
      runUntil(machine, () => machine.display.contains(MONITOR_PROMPT), 30),
    ).toBeGreaterThan(0);
    // The monitor is waiting for a key, not running BASIC.
    expect(machine.display.contains('>')).toBe(false);
    expect(machine.currentLine()).toBeNull();
    expect(machine.isProgramRunning()).toBeNull();
  });

  it('cold-starts Integer BASIC and reaches its prompt', () => {
    const machine = new Apple1Machine({ rom: ROM });
    machine.bootToBasic();
    // `E000R` typed at the monitor, echoed by it, and answered with the
    // interpreter's prompt - the authentic way BASIC starts on this machine.
    expect(machine.display.contains('E000R')).toBe(true);
    expect(machine.display.contains('>')).toBe(true);
    // Cold start leaves the stock workspace the dialect quotes its RAM from.
    expect(machine.mem.peekWord(LOMEM)).toBe(0x0800);
    expect(machine.mem.peekWord(HIMEM)).toBe(0x1000);
  });

  it('runs a program it is handed, naming its lines and its end', () => {
    const machine = new Apple1Machine({ rom: ROM });
    machine.loadProgram(
      tokenize('10 FOR I=1 TO 3\n20 PRINT I\n30 NEXT I\n40 END\n'),
    );
    // Not answerable yet: the injected RUN has not been read.
    expect(machine.isProgramRunning()).toBeNull();

    // Through the profiler rather than a per-field sample of `currentLine`:
    // it reads the same cell every few cycles, so a line that runs for
    // microseconds between two of BASIC's field-long prints is still seen.
    machine.setProfileRecording(true);
    const fields = runUntil(
      machine,
      () => machine.isProgramRunning() === false,
      600,
    );
    expect(fields).toBeGreaterThan(0);
    const lines = (machine.drainProfile() ?? []).map((c) => c.line);
    expect([...lines].sort((a, b) => a - b)).toEqual([10, 20, 30, 40]);
    expect(machine.display.text()).toContain('1\n2\n3');
  });

  it('stores the program where the interpreter expects it', () => {
    // LIST is the machine's own answer to "did the injection land": it walks
    // the program from PP and prints what it finds.
    const machine = ran('10 FOR I=1 TO 3\n20 PRINT I\n30 NEXT I\n40 END\n');
    expect(machine.mem.peekWord(PP)).toBeLessThan(machine.mem.peekWord(HIMEM));
    type(machine, 'LIST\r', 400);
    const screen = machine.display.text();
    for (const line of [
      '10 FOR I=1 TO 3',
      '20 PRINT I',
      '30 NEXT I',
      '40 END',
    ]) {
      expect(screen).toContain(line);
    }
  });

  it('paces the display at one character a video field', () => {
    // The shift register takes a field to turn, so the monitor's echo loop and
    // BASIC's output both stall on the busy line. 30 numbers plus their
    // separators cannot reach the screen in fewer fields than characters.
    const machine = new Apple1Machine({ rom: ROM });
    machine.loadProgram(tokenize('10 FOR I=1 TO 30\n20 PRINT I\n30 NEXT I\n'));
    const fields = runUntil(
      machine,
      () => machine.isProgramRunning() === false,
      2000,
    );
    expect(fields).toBeGreaterThan(60);
  });

  it('stops a running program on CTRL-C, as the keyboard encoder sends it', () => {
    const machine = new Apple1Machine({ rom: ROM });
    machine.loadProgram(tokenize('10 A=A+1\n20 GOTO 10\n'));
    expect(
      runUntil(machine, () => machine.isProgramRunning() === true, 60),
    ).toBeGreaterThan(0);
    machine.setKey('Control', true);
    machine.setKey('KeyC', true);
    machine.setKey('KeyC', false);
    machine.setKey('Control', false);
    expect(
      runUntil(machine, () => machine.isProgramRunning() === false, 120),
    ).toBeGreaterThan(0);
    // Which line it stopped at depends on where the break landed; that it
    // reports one at all is the interpreter acknowledging the keystroke.
    expect(/STOPPED AT [123]0/.test(machine.display.text())).toBe(true);
  });

  it('starts the program even if every key is released as it does', () => {
    // The IDE releases every key whenever focus moves off the emulator, and one
    // of those moments lands a field or two into a run: on the tab layout the
    // on-screen keyboard is rebuilt for the emulator as Play switches to the
    // preview, and tearing the old one down releases the machine's keys. The
    // `RUN` this machine types goes in a character per field, so the release
    // used to arrive mid-command and leave the interpreter sitting at `>R`
    // waiting for the rest to be typed by hand.
    for (const fields of [0, 1, 2, 3, 4]) {
      const machine = new Apple1Machine({ rom: ROM });
      machine.loadProgram(tokenize('10 PRINT "HELLO"\n'));
      for (let i = 0; i < fields; i++) machine.runFrame();
      machine.releaseAllKeys();
      runUntil(machine, () => machine.isProgramRunning() === false, 600);
      expect(machine.display.text()).toContain('HELLO');
    }
  });

  it('keeps the program in RAM across the RESET button', () => {
    const machine = ran('10 FOR I=1 TO 3\n20 PRINT I\n30 NEXT I\n40 END\n');
    const pp = machine.mem.peekWord(PP);
    machine.setKey(RESET_TOKEN, true);
    machine.setKey(RESET_TOKEN, false);
    // Back at the monitor, with the listing still where it was: this is how an
    // owner escaped a runaway program without losing their work.
    expect(
      runUntil(machine, () => machine.display.contains(MONITOR_PROMPT), 30),
    ).toBeGreaterThan(0);
    expect(machine.mem.peekWord(PP)).toBe(pp);
    // `E2B3R` is the warm start, which comes back to BASIC without clearing.
    type(machine, 'E2B3R\r', 60);
    type(machine, 'LIST\r', 400);
    expect(machine.display.contains('20 PRINT I')).toBe(true);
  });

  it('clears the screen from the button without the CPU knowing', () => {
    const machine = new Apple1Machine({ rom: ROM });
    runUntil(machine, () => machine.display.contains(MONITOR_PROMPT), 30);
    machine.setKey(CLEAR_SCREEN_TOKEN, true);
    machine.setKey(CLEAR_SCREEN_TOKEN, false);
    expect(machine.display.text().trim()).toBe('');
  });

  it('reports a monitor-only image rather than running into the padding', () => {
    // What the seam hands a machine whose bundled file has been replaced with a
    // 256-byte WozMon: the interpreter half padded to length with 0xFF.
    const machine = new Apple1Machine({
      rom: fitRomImage(ROM.subarray(0, MONITOR_BYTES), FIRMWARE_BYTES),
    });
    expect([machine.hasMonitor, machine.hasInterpreter]).toEqual([true, false]);
    expect(machine.display.contains('NO BASIC FITTED.')).toBe(true);
    // The monitor still boots: this is an Apple I with no BASIC tape loaded.
    expect(
      runUntil(machine, () => machine.display.contains(MONITOR_PROMPT), 30),
    ).toBeGreaterThan(0);
    // And a program handed to it is declined rather than jumped into.
    machine.loadProgram(tokenize('10 END\n'));
    expect(machine.isProgramRunning()).toBeNull();
    expect(machine.display.contains('>')).toBe(false);
  });

  it('says so when the image carries no monitor either', () => {
    const machine = new Apple1Machine({
      rom: fitRomImage(new Uint8Array(0), FIRMWARE_BYTES),
    });
    expect(machine.hasMonitor).toBe(false);
    expect(machine.display.contains('NO FIRMWARE.')).toBe(true);
    // Nothing runs, and nothing throws.
    for (let i = 0; i < 10; i++) machine.runFrame();
    expect(machine.isProgramRunning()).toBeNull();
  });

  it('reads its screen back through the dialect’s own charset', () => {
    const machine = ran('10 PRINT "HI"\n20 END\n');
    const screen = machine.readScreenText();
    expect(screen?.cols).toBe(40);
    expect(screen?.rows).toBe(24);
    for (const line of screen!.lines) expect(line).toHaveLength(40);
    expect(screen!.lines.some((l) => l.startsWith('HI'))).toBe(true);
  });

  it('is stepped exactly as it is run', () => {
    // The registry-driven `debugEquivalence.test.ts` holds every machine to
    // this once the dialect registers; pinned here while it does not, because
    // the loop is what makes it true and the loop is built in this file.
    const machine = new Apple1Machine({ rom: ROM });
    machine.loadProgram(tokenize('10 A=A+1\n20 PRINT A\n30 GOTO 10\n'));
    runUntil(machine, () => machine.isProgramRunning() === true, 120);
    machine.setProfileRecording(true);

    const window = (advance: () => void): number => {
      machine.drainProfile();
      for (let i = 0; i < 30; i++) advance();
      const costs = machine.drainProfile() ?? [];
      return costs.reduce((sum, c) => sum + c.cost, 0);
    };
    const frames = window(() => machine.runFrame());
    const slices = window(() => {
      const step = machine.debugStep({
        breakpoints: new Set(),
        mode: 'run',
        fromLine: null,
      });
      expect(step.paused).toBe(false);
    });
    expect(frames).toBeGreaterThan(0);
    expect(Math.abs(slices - frames) / frames).toBeLessThan(0.05);
  });

  it('pauses a slice on a breakpoint', () => {
    const machine = new Apple1Machine({ rom: ROM });
    machine.loadProgram(tokenize('10 A=A+1\n20 PRINT A\n30 GOTO 10\n'));
    runUntil(machine, () => machine.isProgramRunning() === true, 120);
    for (let i = 0; i < 200; i++) {
      const step = machine.debugStep({
        breakpoints: new Set([20]),
        mode: 'run',
        fromLine: null,
      });
      if (step.paused) {
        expect(step.line).toBe(20);
        return;
      }
    }
    throw new Error('the slice never paused on line 20');
  });

  it('reports the workspace the cold start lays down, from both ends', () => {
    // The machine has no Ready prompt to read this at: left alone it stops in
    // the monitor with no interpreter running and no pointers to read, which is
    // why programRamBudget.test.ts excuses it and the figure is pinned here
    // instead. Once BASIC is up, the cold start fixes LOMEM and HIMEM at $0800
    // and $1000 whatever RAM is fitted, which is the 2048 the dialect declares.
    const machine = new Apple1Machine({ rom: ROM });
    expect(machine.readMemoryStats()).toBeNull();
    machine.bootToBasic();
    expect(machine.readMemoryStats()).toEqual({
      used: 0,
      free: apple1.programRamBytes,
    });

    // A loaded program is charged against the same 2048: the text goes in at
    // the top and the figure counts it from there, so used + free is the whole
    // workspace whatever is in it.
    const image = tokenize('10 A=1\n20 END\n');
    machine.loadProgram(image);
    const stats = machine.readMemoryStats()!;
    expect(stats.used).toBeGreaterThan(0);
    expect(stats.used + stats.free).toBe(apple1.programRamBytes);
  });

  it('stamps the addresses its CPU touches, only while asked to', () => {
    const machine = new Apple1Machine({ rom: ROM });
    // Off by default, and nothing to drain while off.
    expect(machine.drainMemoryActivity()).toBeNull();
    machine.setMemoryActivityRecording(true);
    machine.runFrame();
    const hits = machine.drainMemoryActivity()!;
    expect(hits).toHaveLength(0x10000);
    // The monitor is where the CPU is, so its page is the one being read.
    expect(hits.subarray(0xff00).some((b) => b !== 0)).toBe(true);
    // Reading a pointer back is the host's business, not the program's, so it
    // must not appear as activity.
    machine.readMemoryStats();
    expect(machine.drainMemoryActivity()!.some((b) => b !== 0)).toBe(false);
  });

  it('budgets a frame at one video field of CPU time', () => {
    expect(CYCLES_PER_FIELD).toBe(17045);
    const machine = new Apple1Machine({ rom: ROM });
    expect(machine.frameHz).toBeCloseTo(60, 1);
    expect([machine.displayWidth, machine.displayHeight]).toEqual([280, 192]);
    machine.dispose();
    // A disposed machine answers nothing and steps nothing.
    expect(machine.isProgramRunning()).toBeNull();
    expect(machine.readScreenText()).toBeNull();
    expect(machine.currentLine()).toBeNull();
    machine.runFrame();
  });
});
