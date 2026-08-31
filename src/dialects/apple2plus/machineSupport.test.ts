// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The interpreter fitted to the shared Apple II board, checked on the ROM.
 *
 * Everything here is about the half of the machine that is Applesoft's: where
 * it lands out of reset, what a load has to write, and what it says about the
 * line it is on and the memory it has left. The board's own behaviour - the
 * display, the keyboard encoder, the speaker, the paddles - is the sibling's
 * and is tested under `src/emulator/apple2/`.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { apple2plus } from './index';
import { applesoftSupport } from './machineSupport';
import {
  BASIC_COMMAND_LOOP,
  CURLIN,
  DEFAULT_MEMSIZ,
  MEMSIZ,
  PROGRAM_BASE,
  STREND,
  TXTTAB,
  VARTAB,
} from './addresses';
import {
  bootMachine,
  hasRom,
  runFrames,
  runUntil,
  screenText,
} from '../bootHarness';
import type { MachineEmulator } from '../types';

const word = (m: MachineEmulator, address: number): number => {
  const mem = (m as unknown as { mem: { mem: Uint8Array } }).mem.mem;
  return mem[address]! | (mem[address + 1]! << 8);
};

/** Type a line at the prompt the way an owner would, and let it be read. */
async function type(m: MachineEmulator, text: string): Promise<void> {
  for (const ch of text) {
    const token =
      ch === '\r'
        ? 'Enter'
        : ch === ' '
          ? 'Space'
          : /[0-9]/.test(ch)
            ? `Digit${ch}`
            : `Key${ch}`;
    m.setKey(token, true);
    await runFrames(m, 2);
    m.setKey(token, false);
    await runFrames(m, 5);
  }
}

describe('the Applesoft support object', () => {
  it('declares itself autostart, and names its own machine and image', () => {
    // The Autostart Monitor runs Applesoft's cold start out of reset, so
    // nothing may be typed at this machine to start BASIC - and a missing or
    // wrong image must name apple2plus.rom rather than the sibling's.
    expect(applesoftSupport.autostart).toBe(true);
    expect(applesoftSupport.machineName).toBe('Apple II Plus');
    expect(applesoftSupport.romPath).toBe('public/roms/apple2plus.rom');
    expect(applesoftSupport.prompt).toBe(']');
  });

  it('watches the address the warm start jumps to', () => {
    // $E003 is `JMP $D43C` and nothing else, which is the ROM's own statement
    // that $D43C is where the interpreter waits between programs.
    const rom = new Uint8Array(readFileSync('public/roms/apple2plus.rom'));
    const at = (address: number) => rom[address - 0xd000]!;
    expect(at(0xe003)).toBe(0x4c);
    expect(at(0xe004) | (at(0xe005) << 8)).toBe(BASIC_COMMAND_LOOP);
    expect(applesoftSupport.commandLoop).toBe(BASIC_COMMAND_LOOP);
  });
});

const describeOnRom = hasRom(apple2plus) ? describe : describe.skip;

describeOnRom('the Apple II Plus on its own firmware', () => {
  it('signs on in Applesoft with nothing typed at it', async () => {
    const machine = await bootMachine(apple2plus);
    try {
      await runUntil(
        machine,
        () =>
          screenText(machine)
            .split('\n')
            .some((l) => l.startsWith(']')),
        600,
      );
      const lines = screenText(machine).split('\n');
      expect(lines.some((l) => l.includes('APPLE ]['))).toBe(true);
      expect(lines.some((l) => l.startsWith(']'))).toBe(true);
      // The banner carries a `]` of its own, which is exactly why the machine
      // waits for one at the left margin: the workspace is laid down after the
      // sign-on, and a load that believed the banner would be walked over.
      expect(word(machine, TXTTAB)).toBe(PROGRAM_BASE);
      expect(word(machine, MEMSIZ)).toBe(DEFAULT_MEMSIZ);
    } finally {
      machine.dispose();
    }
  });

  it('takes an injected program, runs it, and lists it back as typed', async () => {
    const machine = await bootMachine(apple2plus);
    try {
      const source =
        '10 FOR I = 1 TO 3\n20 PRINT "HI ";I\n30 NEXT I\n40 X$ = "DONE"\n50 PRINT X$\n';
      const { image, errors } = apple2plus.tokenize(source);
      expect(errors).toEqual([]);
      machine.loadProgram(image);
      await runUntil(machine, () => screenText(machine).includes('DONE'), 900);

      const screen = screenText(machine);
      for (const line of ['HI 1', 'HI 2', 'HI 3', 'DONE'])
        expect(screen, `missing ${line}`).toContain(line);

      // The pointers a load owes: VARTAB on the byte after the program's zero
      // link, and the scalars and arrays starting with it.
      expect(word(machine, VARTAB)).toBe(PROGRAM_BASE + image.length);
      expect(word(machine, STREND)).toBeGreaterThanOrEqual(
        word(machine, VARTAB),
      );

      // And the interpreter's own view of it: a LIST at the prompt gives the
      // listing back, which nothing but a correctly linked program does.
      await type(machine, 'LIST\r');
      await runUntil(
        machine,
        () => screenText(machine).includes('NEXT I'),
        600,
      );
      const listed = screenText(machine)
        .split('\n')
        .map((l) => l.trimEnd())
        .filter((l) => /^\d+ /.test(l))
        .join('\n');
      expect(listed).toContain('10  FOR I = 1 TO 3');
      expect(listed).toContain('20  PRINT "HI ";I');
      expect(listed).toContain('50  PRINT X$');
    } finally {
      machine.dispose();
    }
  });

  it('names the line it is executing, and says when none is', async () => {
    const machine = await bootMachine(apple2plus);
    try {
      // CURLIN holds the line NUMBER here, not a pointer as the sibling's PLINE
      // does, and $FF in its high byte is the ROM's own mark for direct mode.
      await runUntil(machine, () => machine.currentLine() === null, 600);
      expect(word(machine, CURLIN) >> 8).toBe(0xff);

      machine.loadProgram(
        apple2plus.tokenize('10 FOR I = 1 TO 4000\n20 NEXT I\n30 END\n').image,
      );
      const started = await runUntil(
        machine,
        () => machine.currentLine() !== null,
        600,
      );
      expect(started).toBe(true);
      expect([10, 20]).toContain(machine.currentLine());

      await runUntil(machine, () => machine.isProgramRunning() === false, 3600);
      // Still naming the line it stopped on: the ROM stamps the direct-mode
      // mark when a line is typed, not when a program ends, which is how CONT
      // knows where to resume. The run latch is what answers "still running".
      expect(machine.currentLine()).toBe(30);
      expect(machine.isProgramRunning()).toBe(false);
      await type(machine, 'PRINT 1\r');
      await runUntil(machine, () => machine.currentLine() === null, 600);
      expect(machine.currentLine()).toBeNull();
    } finally {
      machine.dispose();
    }
  });

  it('reports the workspace from both ends, as FRE(0) does', async () => {
    const machine = await bootMachine(apple2plus);
    try {
      await runUntil(machine, () => machine.readMemoryStats() !== null, 600);
      const bare = machine.readMemoryStats()!;
      // An empty machine has spent only the program's zero link.
      expect(bare.used + bare.free).toBe(DEFAULT_MEMSIZ - PROGRAM_BASE);

      // A program that fills a string array has to move the figure: the strings
      // grow down from MEMSIZ and the arrays up from the program, and a reading
      // that counted only the program text would not move at all.
      machine.loadProgram(
        apple2plus.tokenize(
          // Concatenated rather than assigned from a literal: a string taken
          // straight out of the program text is not copied into the string
          // space at all, and the figure would not move.
          '10 DIM A$(40)\n20 FOR I = 0 TO 40\n30 A$(I) = "0123456789" + "ABCDEFGHIJ"\n40 NEXT I\n50 END\n',
        ).image,
      );
      await runUntil(machine, () => machine.isProgramRunning() === false, 1800);
      const after = machine.readMemoryStats()!;
      expect(after.used).toBeGreaterThan(bare.used + 400);
      expect(after.used + after.free).toBe(DEFAULT_MEMSIZ - PROGRAM_BASE);
    } finally {
      machine.dispose();
    }
  });

  it('keeps the listing across RESET, which the Autostart Monitor re-enters', async () => {
    const machine = await bootMachine(apple2plus);
    try {
      machine.loadProgram(apple2plus.tokenize('10 PRINT "KEPT"\n').image);
      await runUntil(machine, () => screenText(machine).includes('KEPT'), 900);
      const vartab = word(machine, VARTAB);

      machine.setKey('Reset', true);
      await runFrames(machine, 4);
      machine.setKey('Reset', false);
      // The monitor checks PWREDUP against SOFTEV, re-enters Applesoft and
      // prints a fresh prompt; the old one is still on screen throughout, so
      // this waits out the dialogue rather than watching for a `]`.
      await runFrames(machine, 120);
      // Back at `]` rather than the sibling's `*`, with the program still
      // there: a cold start would have put VARTAB back at $0802.
      expect(word(machine, VARTAB)).toBe(vartab);

      // HOME first, so what the re-run prints is the only KEPT on the screen -
      // RESET clears nothing, and the machine has scrolled since.
      await type(machine, 'HOME\r');
      await runFrames(machine, 30);
      expect(screenText(machine)).not.toContain('KEPT');
      await type(machine, 'RUN\r');
      const ran = await runUntil(
        machine,
        () => screenText(machine).includes('KEPT'),
        900,
      );
      expect(ran, 'the listing did not survive RESET').toBe(true);
    } finally {
      machine.dispose();
    }
  });

  it('reads its own workspace without stamping the memory-map overlay', async () => {
    const machine = await bootMachine(apple2plus);
    try {
      machine.loadProgram(
        apple2plus.tokenize('10 A$ = "X" + "Y"\n20 B = 1\n30 END\n').image,
      );
      await runUntil(machine, () => machine.isProgramRunning() === false, 900);

      // Armed and drained, so what follows starts from a clean buffer. The
      // three readers then poll the machine the way the watcher, the status bar
      // and the post-run check do - and every one of them must go through
      // `peek`, or the overlay would report the IDE's own reads as the
      // program's.
      machine.setMemoryActivityRecording!(true);
      machine.drainMemoryActivity!();
      expect(machine.readVariables().length).toBeGreaterThan(0);
      expect(machine.readMemoryStats()).not.toBeNull();
      expect(machine.readReport()).not.toBeNull();
      expect(machine.drainMemoryActivity!()!.every((bit) => bit === 0)).toBe(
        true,
      );
    } finally {
      machine.dispose();
    }
  });

  it('says so with this machine’s own ROM path when the image is empty', async () => {
    const machine = await bootMachine(apple2plus, { rom: new Uint8Array(0) });
    try {
      expect(screenText(machine)).toContain('PUBLIC/ROMS/APPLE2PLUS.ROM');
    } finally {
      machine.dispose();
    }
  });
});
