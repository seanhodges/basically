// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { splitRomImage } from '../../dialects/sorcerer/romImage';
import { sorcererCharset } from '../../dialects/sorcerer/charset';
import { tokenizeProgram } from '../../dialects/sorcerer/tokenizer';
import { buildBasicImage } from '../../dialects/sorcerer/basicImage';
import {
  CHARGEN_RAM_BASE,
  CURLIN,
  PROGRAM_BASE,
  SCREEN_BASE,
  STANDARD_GRAPHICS_FIRST,
  VARTAB,
} from '../../dialects/sorcerer/addresses';
import { HeadlessCanvas } from '../../dialects/headless/headlessCanvas';
import { SorcererMachine } from './sorcererMachine';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './display';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/sorcerer/sorcerer.rom')),
);

function machine(image = rom): SorcererMachine {
  return new SorcererMachine(splitRomImage(image));
}

/** The screen as lines, right-trimmed, with the blank tail dropped. */
function screen(sorcerer: SorcererMachine): string[] {
  const lines = sorcerer.readScreenText()!.lines.map((l) => l.trimEnd());
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Build a program the way the dialect's `tokenize` does. */
function program(source: string): Uint8Array {
  const { program: bytes, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return buildBasicImage(bytes);
}

/**
 * Frames given to a program that should finish quickly. A cap on a predicate
 * costs nothing when the predicate trips early, and every program here does.
 */
const MAX_RUN_FRAMES = 300;

function runUntil(
  sorcerer: SorcererMachine,
  done: () => boolean,
  frames = MAX_RUN_FRAMES,
): boolean {
  for (let i = 0; i < frames; i++) {
    sorcerer.runFrame();
    if (done()) return true;
  }
  return false;
}

describe('SorcererMachine', () => {
  /**
   * One boot, then several things asserted against it: the machine reaches the
   * BASIC prompt through the Monitor's own cold start, and everything the
   * dialect claims about the machine's shape is read back off it rather than
   * assumed.
   */
  it('boots the ROM set to the Exidy Standard BASIC prompt', () => {
    const sorcerer = machine();
    sorcerer.bootToReady();

    // The Monitor sized RAM, entered the ROM PAC at 0xDFFD, and BASIC signed
    // on. The free-memory figure is the machine's own arithmetic on the 32K it
    // found, and is what the dialect's `programRamBytes` is read from.
    expect(screen(sorcerer)).toEqual([
      '',
      'EXIDY STANDARD BASIC VER 1.0',
      'COPYRIGHT (C) 1978 BY EXIDY INC.',
      '31976 BYTES FREE',
      '',
      'READY',
      '_',
    ]);

    // The boot mirror is gone: the CPU reached the Monitor's own window with
    // its opening jump, long before it needed the RAM underneath.
    expect(sorcerer.mem.inBootMirror).toBe(false);

    // The interpreter's own pointers, which is where an injected program's have
    // to agree with it: an empty program is a two-byte null link at the program
    // base, and VARTAB the byte after it.
    expect(sorcerer.mem.rawReadWord(VARTAB)).toBe(PROGRAM_BASE + 2);
    // Not in a program, which is the direct-mode marker rather than a line.
    expect(sorcerer.currentLine()).toBeNull();

    // The Monitor copied the standard graphics set into generator RAM, which is
    // why those shapes exist at all and why a program can overwrite them. Code
    // 0x80 is the charset's one-pixel rule down the leftmost column.
    const graphics = sorcerer.mem.charGenRam;
    expect([...graphics.subarray(0, 8)]).toEqual([
      0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
    ]);
    // The user-definable band above it is left as it was found: no shape until
    // a program pokes one in.
    expect([...graphics.subarray(0x40 * 8, 0x40 * 8 + 8)]).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0,
    ]);

    sorcerer.dispose();
  });

  /**
   * The whole hand-over: bytes at the program base, the interpreter pointers
   * fixed to describe them, and RUN typed at the emulated keyboard - which is
   * the only thing that sets up the variable and string space from the program
   * now in place.
   */
  it('injects a program, runs it, and reports when it has finished', () => {
    const sorcerer = machine();
    sorcerer.loadProgram(
      program('10 FOR I=1 TO 50\n20 NEXT I\n30 PRINT "DONE"\n'),
    );

    // Handed over and started: the interpreter is on the program's first line.
    expect(sorcerer.isProgramRunning()).toBe(true);
    expect(sorcerer.currentLine()).toBe(10);
    expect(sorcerer.mem.peek(PROGRAM_BASE + 2)).toBe(10);

    const finished = runUntil(
      sorcerer,
      () => sorcerer.isProgramRunning() === false,
    );
    expect(finished).toBe(true);
    expect(screen(sorcerer).slice(-5)).toEqual([
      'READY',
      'RUN',
      'DONE',
      'READY',
      '_',
    ]);
    // The run ended in direct mode, which is what the latch read.
    expect(sorcerer.mem.rawReadWord(CURLIN) & 0xff00).toBe(0xff00);

    sorcerer.dispose();
    expect(sorcerer.isProgramRunning()).toBeNull();
  });

  /**
   * The screen holds character codes, so what the video circuit draws and what
   * `readScreenText` reports come from the same byte - including the graphics
   * band, whose codes the dialect's charset spells as the Unicode the editor
   * shows.
   */
  it('reads the graphics band back through the dialect charset', () => {
    const sorcerer = machine();
    sorcerer.loadProgram(program('10 PRINT CHR$(151);CHR$(162)\n'));
    runUntil(sorcerer, () => sorcerer.isProgramRunning() === false);
    expect(screen(sorcerer)).toContain(
      sorcererCharset.glyph(0x97) + sorcererCharset.glyph(0xa2),
    );
    sorcerer.dispose();
  });

  /**
   * A program that redefines a generator entry changes what is already drawn,
   * because the video circuit scans the same RAM the POKE went into. This is
   * the one thing the split character generator buys, so it is checked through
   * the painted frame rather than through the bytes.
   */
  it('paints a redefined character from generator RAM', () => {
    const sorcerer = machine();
    // POKE takes a signed 16-bit address on this interpreter, so everything
    // above 0x7FFF is written as a negative number; the positive form answers
    // ?FC ERROR. Both of these are, which is the whole top of the address map.
    const generator = CHARGEN_RAM_BASE - 0x10000;
    const screenCell = SCREEN_BASE - 0x10000;
    sorcerer.loadProgram(
      program(
        `10 FOR I=0 TO 7:POKE ${generator}+I,255:NEXT I\n` +
          `20 POKE ${screenCell},${STANDARD_GRAPHICS_FIRST}\n`,
      ),
    );
    runUntil(sorcerer, () => sorcerer.isProgramRunning() === false);

    const canvas = new HeadlessCanvas(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    sorcerer.renderTo(canvas.renderContext);
    const pixels = canvas.rgba;
    // Every dot of the top-left cell's first eight rows is lit.
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        expect(pixels[(y * DISPLAY_WIDTH + x) * 4]).toBeGreaterThan(0);
      }
    }
    sorcerer.dispose();
  });

  /**
   * The debug path and the plain path are one walk over one budget, so a run
   * measured through `debugStep` reaches the same state as one through
   * `runFrame` - and a breakpoint stops on the line it names.
   */
  it('runs and debugs the same program the same way', () => {
    const source = '10 A=1\n20 A=A+1\n30 IF A<50 THEN 20\n40 PRINT A\n';
    const plain = machine();
    plain.loadProgram(program(source));
    runUntil(plain, () => plain.isProgramRunning() === false);

    const debugged = machine();
    debugged.loadProgram(program(source));
    for (let i = 0; i < MAX_RUN_FRAMES; i++) {
      const result = debugged.debugStep({
        breakpoints: new Set(),
        mode: 'run',
        fromLine: null,
      });
      expect(result.paused).toBe(false);
      if (debugged.isProgramRunning() === false) break;
    }
    expect(screen(debugged)).toEqual(screen(plain));

    const stopping = machine();
    stopping.loadProgram(program(source));
    expect(
      stopping.debugStep({
        breakpoints: new Set([30]),
        mode: 'run',
        fromLine: null,
      }),
    ).toEqual({ paused: true, line: 30 });

    plain.dispose();
    debugged.dispose();
    stopping.dispose();
  });

  /**
   * Arming the profiler must not change what the program does, and what it
   * charges must be the program's own lines: the loop body dominates, and the
   * line that ran before recording was armed is not charged retrospectively.
   */
  it('charges a run to the lines that ran it', () => {
    const sorcerer = machine();
    sorcerer.loadProgram(program('10 A=0\n20 A=A+1\n30 GOTO 20\n'));
    runUntil(sorcerer, () => sorcerer.currentLine() === 30, 60);

    sorcerer.setProfileRecording(true);
    for (let i = 0; i < 20; i++) sorcerer.runFrame();
    const costs = sorcerer.drainProfile()!;
    const byLine = new Map(costs.map((c) => [c.line, c.cost]));
    expect(byLine.has(10)).toBe(false);
    expect(byLine.get(20)!).toBeGreaterThan(0);
    expect(byLine.get(30)!).toBeGreaterThan(0);

    sorcerer.setProfileRecording(false);
    expect(sorcerer.drainProfile()).toBeNull();
    sorcerer.dispose();
  });

  /**
   * A machine handed no image stays constructible and says what is missing on
   * its own screen - the images with no redistribution grant are meant to be
   * removable, and on this machine the character generator is *in* the one that
   * would be gone.
   */
  it('draws a notice rather than running with no ROM image', () => {
    const sorcerer = machine(new Uint8Array(0));
    expect(sorcerer.hasRom).toBe(false);
    expect(sorcerer.readScreenText()).toBeNull();
    expect(sorcerer.isProgramRunning()).toBeNull();

    // Both paths are inert rather than throwing, and neither advances the CPU.
    sorcerer.runFrame();
    sorcerer.loadProgram(program('10 PRINT "HI"\n'));
    expect(sorcerer.processor.getPC()).toBe(0);

    const canvas = new HeadlessCanvas(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    expect(() => sorcerer.renderTo(canvas.renderContext)).not.toThrow();
    expect(canvas.distinctColours()).toBeGreaterThan(1);
    sorcerer.dispose();
  });
});
