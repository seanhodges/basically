// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { atari800 } from './index';
import { atariSamples } from './samples';
import { atariKeywords } from './keywords';
import { atariKeyboardLayout } from './keyboardLayout';
import { atari800MemoryBlocks } from './memoryBlocks';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { AtariMachine } from '../../emulator/atari/atariMachine';
import { ATARI_PALETTE } from '../../emulator/atari/palette';
import type { SampleFile } from '../types';

const ROM_PATH = join(__dirname, '../../../public/roms/atari/atari.rom');
const hasRom = existsSync(ROM_PATH);

const sample = (name: string): SampleFile =>
  atariSamples.find((s) => s.name === name)!;

describe('Atari sample programs', () => {
  it('ships the canonical sample set in the canonical order', () => {
    expect(atariSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('offers hello as the starter for a fresh document', () => {
    expect(atari800.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes and lints every sample clean', () => {
    for (const s of atariSamples) {
      const { errors } = atari800.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(atari800.lint(s.text), s.name).toEqual([]);
    }
  });

  it('never assigns to a name that is a keyword', () => {
    // A name that spells a keyword tokenizes to the keyword's byte and the ROM
    // mis-runs the line without reporting anything, so this is the one
    // collision no other check here would see. Assignments only: a comparison
    // may legitimately name one.
    const words = new Set(atariKeywords.map((k) => k.word));
    const assignment = /(?:^\d+ |:)\s*(?:LET )?([A-Z][A-Z0-9]*)\s*=/gm;
    for (const s of atariSamples) {
      for (const [, name] of s.text.matchAll(assignment)) {
        expect(words.has(name!), `${s.name}: ${name}`).toBe(false);
      }
    }
  });

  it('offers the games both of the machine’s controls', () => {
    // The Atari's own game interface is its joystick port, so both games read
    // STICK/STRIG as well as the keyboard - and the keyboard half reads the
    // OS's own key cell, which is the only non-blocking read this BASIC has.
    for (const name of ['breakout.bas', 'maze.bas']) {
      expect(sample(name).text, name).toContain('PEEK(764)');
      expect(sample(name).text, name).toContain('STICK(0)');
    }
  });

  it('prints nothing in the last column of the screen', () => {
    // The screen editor reads a character written to column 39 as the end of a
    // logical line and pushes everything below it down a row, which would tear
    // the maze's map and leave a second paddle behind in breakout. Both games
    // therefore stop one column short - and this is the guard that says so,
    // because the damage only shows up several moves later.
    expect(sample('breakout.bas').text).toContain('PX<34');
    expect(sample('breakout.bas').text).toContain('NX>38');
    expect(sample('maze.bas').text).toContain('NX>38');
  });
});

const ROM = hasRom ? new Uint8Array(readFileSync(ROM_PATH)) : new Uint8Array(0);

/** Boot the 800 on the shipped ROM with `s` loaded and running. */
function machineFor(s: SampleFile): AtariMachine {
  const machine = new AtariMachine({ model: '800', rom: ROM });
  const { image, errors } = atari800.tokenize(s.text);
  expect(errors, `${s.name} should tokenize cleanly`).toEqual([]);
  machine.loadProgram(image, { blocks: materializeSampleBlocks(atari800, s) });
  return machine;
}

function runFrames(machine: AtariMachine, frames: number): void {
  for (let frame = 0; frame < frames; frame++) machine.runFrame();
}

/**
 * Press and release one key. Twelve frames rather than one: the OS reads the
 * keyboard from its vertical-blank routine, and a program that is drawing
 * between polls has to be given a scan it can see.
 */
function tap(machine: AtariMachine, token: string, after = 30): void {
  machine.setKey(token, true);
  runFrames(machine, 12);
  machine.setKey(token, false);
  runFrames(machine, after);
}

const screen = (machine: AtariMachine): string =>
  (machine.readScreenText()?.lines ?? []).join('\n');

/**
 * The machine's RAM. Private on the class, as every chip on this machine is;
 * reached the way the emulator's own tests reach ANTIC's frame buffer, because
 * the two things worth asserting here - the solid blocks the games draw, and
 * how many cells one move repaints - are invisible to `readScreenText`: it
 * decodes inverse video to the glyph underneath, and a solid block is an
 * inverse space.
 */
const ram = (machine: AtariMachine): Uint8Array =>
  (machine as unknown as { memory: { mem: Uint8Array } }).memory.mem;

/** The 40x24 text screen's base address, from the OS's own SAVMSC. */
const screenBase = (machine: AtariMachine): number => {
  const mem = ram(machine);
  return mem[0x58]! | (mem[0x59]! << 8);
};

/** The screen code in one cell. A solid block - an inverse space - is `$80`. */
const cell = (machine: AtariMachine, x: number, y: number): number =>
  ram(machine)[(screenBase(machine) + y * 40 + x) & 0xffff]!;

const frameBuffer = (machine: AtariMachine): Uint8ClampedArray =>
  (machine as unknown as { antic: { rgba: Uint8ClampedArray } }).antic.rgba;

const gate = hasRom ? it : it.skip;

describe('the samples on the Atari', () => {
  gate(
    'run to the point each waits at, with nothing on the error channel',
    () => {
      for (const s of atariSamples) {
        const machine = machineFor(s);
        runFrames(machine, 240);
        // The games sit on their control menu until a choice and a start are
        // pressed; hello, circles and the kaleidoscope need no key to begin.
        tap(machine, 'Num1', 60);
        tap(machine, 'Space', 120);
        expect(screen(machine), `${s.name} stopped on an error`).not.toMatch(
          /ERROR/i,
        );
        machine.dispose();
      }
    },
    120_000,
  );

  gate(
    'greets and signs off where the screen can be read',
    () => {
      const machine = machineFor(sample('hello.bas'));
      runFrames(machine, 400);
      // Read off the screen rather than the listing: a greeting printed past the
      // last row, or over by the next line, passes every check but this one.
      const lines = machine.readScreenText()!.lines;
      expect(
        lines.filter((l) => l.includes('HELLO FROM THE ATARI')).length,
      ).toBeGreaterThan(10);
      expect(screen(machine)).toContain('* BASICALLY *');
      machine.dispose();
    },
    60_000,
  );
});

describe('Atari circles', () => {
  gate(
    'draws rings that are round and closed',
    () => {
      const machine = machineFor(sample('circles.bas'));
      runFrames(machine, 600);
      expect(
        machine.currentLine(),
        'the rings should all be drawn by now',
      ).toBe(160);

      // The lit pixels are the one colour the sample asks for: hue 8 at
      // luminance 14, which GTIA draws from the palette's $8E.
      const [r, g, b] = ATARI_PALETTE[0x8e]!;
      const rgba = frameBuffer(machine);
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      let lit = 0;
      for (let y = 0; y < 240; y++) {
        for (let x = 0; x < 384; x++) {
          const i = (y * 384 + x) * 4;
          if (rgba[i] !== r || rgba[i + 1] !== g || rgba[i + 2] !== b) continue;
          lit++;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      }
      expect(lit, 'nothing was drawn').toBeGreaterThan(500);
      // A GRAPHICS 8 pixel is one television pixel each way, so equal radii draw
      // round. Full E instead of E/2 in the recurrence would integrate an
      // ellipse instead, and this is what would catch it.
      const aspect = (x1 - x0 + 1) / (y1 - y0 + 1);
      expect(aspect).toBeGreaterThan(0.97);
      expect(aspect).toBeLessThan(1.03);
      machine.dispose();
    },
    60_000,
  );
});

describe('Atari breakout', () => {
  /**
   * Which key means which way is not the sample's to choose: the on-screen
   * controller sends these, so a game reading any other arrangement answers the
   * pad's arrows with the wrong move.
   */
  const { left, right } = atariKeyboardLayout.controller!.bindings;

  /** The columns the paddle's solid blocks occupy on its row. */
  function paddleColumns(machine: AtariMachine): number[] {
    const cols: number[] = [];
    for (let x = 0; x < 40; x++)
      if (cell(machine, x, 18) === 0x80) cols.push(x);
    return cols;
  }

  /**
   * Start a game, tap `token` three times, and report where the paddle was
   * before and after.
   *
   * A machine of its own for each direction, because a ball nobody returns is
   * lost about two seconds after the serve - long enough to answer one
   * question about the paddle and not two.
   */
  function paddleUnder(token: string): { from: number; to: number } {
    const machine = machineFor(sample('breakout.bas'));
    try {
      runFrames(machine, 240);
      tap(machine, 'Num1', 30);
      tap(machine, 'Space', 20);
      // The wall is drawn a cell at a time, so wait for the paddle rather than
      // guessing how long that takes.
      for (let frame = 0; frame < 400; frame++) {
        machine.runFrame();
        if (paddleColumns(machine).length > 0) break;
      }
      expect(screen(machine), 'the score should be on screen').toContain(
        'SCORE',
      );
      const from = paddleColumns(machine)[0];
      expect(from, 'no paddle on screen').not.toBeUndefined();
      for (let i = 0; i < 3; i++) tap(machine, token, 4);
      return { from: from!, to: paddleColumns(machine)[0]! };
    } finally {
      machine.dispose();
    }
  }

  gate(
    'moves the paddle the way the on-screen controller points',
    () => {
      const rightward = paddleUnder(right!);
      expect(
        rightward.to,
        `${right} is the pad's right, so the paddle must go right`,
      ).toBeGreaterThan(rightward.from);
      const leftward = paddleUnder(left!);
      expect(
        leftward.to,
        `${left} is the pad's left, so the paddle must go left`,
      ).toBeLessThan(leftward.from);
    },
    120_000,
  );
});

describe('Atari maze', () => {
  /** The wall map as the sample's own PRINT lines spell it. */
  const rows = [
    ...sample('maze.bas').text.matchAll(/^\d+ PRINT "([#E ]{20,})"$/gm),
  ].map((m) => m[1]!);

  it('is a rectangle with a walkable start and an exit', () => {
    expect(rows.length).toBeGreaterThan(4);
    for (const row of rows) expect(row.length).toBe(rows[0]!.length);
    // The sample starts the marker at (1, 1), which has to be walkable.
    expect(rows[1]![1]).toBe(' ');
    expect(rows.join('')).toContain('E');
  });

  it('is solvable from the start cell', () => {
    // Breadth-first from (1, 1). A maze whose exit cannot be reached is not a
    // broken test, it is a sample nobody can finish.
    const width = rows[0]!.length;
    const seen = new Set<number>([1 * width + 1]);
    const queue: [number, number][] = [[1, 1]];
    let escaped = false;
    while (queue.length > 0 && !escaped) {
      const [x, y] = queue.shift()!;
      if (rows[y]![x] === 'E') escaped = true;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= rows.length) continue;
        if (rows[ny]![nx] === '#') continue;
        const key = ny * width + nx;
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push([nx, ny]);
      }
    }
    expect(escaped).toBe(true);
  });

  gate(
    'moves the marker one cell and repaints nothing else',
    () => {
      const machine = machineFor(sample('maze.bas'));
      runFrames(machine, 240);
      tap(machine, 'Num1', 60);
      tap(machine, 'Space', 200);
      expect(screen(machine)).toContain('REACH E');
      // The map is printed from the top of the screen, so map cell (x, y) is
      // screen cell (x, y) and the marker starts on (1, 1).
      expect(cell(machine, 1, 1), 'no marker on the start cell').toBe(0x2f);

      const base = screenBase(machine);
      const before = ram(machine).slice(base, base + 40 * 24);
      // Right, not down: the cell below the start is a wall, and a move into one
      // is refused - which the four-way check below proves separately.
      tap(machine, atariKeyboardLayout.controller!.bindings.right!, 40);
      const after = ram(machine).slice(base, base + 40 * 24);
      expect(cell(machine, 1, 1), 'the cell left behind').toBe(0x00);
      expect(cell(machine, 2, 1), 'the cell arrived at').toBe(0x2f);
      let repainted = 0;
      for (let i = 0; i < before.length; i++) {
        if (before[i] !== after[i]) repainted++;
      }
      expect(repainted, 'a move should not redraw the map').toBe(2);

      // The rest of the pad, on the same machine: each binding must move the
      // marker its own way, and a wall must refuse the move rather than let it
      // through. The cell below the start is a wall, which is the refusal here.
      const pad = atariKeyboardLayout.controller!.bindings;
      const marker = (x: number, y: number) => cell(machine, x, y) === 0x2f;
      tap(machine, pad.left!, 40);
      expect(marker(1, 1), 'left should come back').toBe(true);
      tap(machine, pad.down!, 40);
      expect(marker(1, 1), 'the wall below the start should refuse').toBe(true);
      for (let i = 0; i < 6; i++) tap(machine, pad.right!, 30);
      expect(marker(7, 1), 'six moves right').toBe(true);
      tap(machine, pad.down!, 40);
      expect(marker(7, 2), 'down through the gap').toBe(true);
      tap(machine, pad.up!, 40);
      expect(marker(7, 1), 'and up again').toBe(true);
      machine.dispose();
    },
    120_000,
  );
});

describe('Atari kaleidoscope', () => {
  const kaleido = sample('kaleido.bas');

  it('assembles into page 6, inside a range a block may use', () => {
    const [block] = materializeSampleBlocks(atari800, kaleido);
    expect(block).toBeTruthy();
    expect(block!.address).toBe(0x0600);
    expect(block!.entry).toBe(0x0603);
    // Page 6 is 256 bytes and nothing enlarges it, so a routine that outgrows
    // it would run into BASIC's own workspace.
    expect(block!.bytes.length).toBeGreaterThan(0);
    expect(block!.bytes.length).toBeLessThanOrEqual(0x100);
    const end = block!.address + block!.bytes.length - 1;
    expect(
      atari800MemoryBlocks.validRanges.some(
        (r) => block!.address >= r.start && end <= r.end,
      ),
      `${block!.bytes.length} bytes at $0600 must fit a valid range`,
    ).toBe(true);
  });

  gate(
    'asks for its three parameters and draws a four-way mirror',
    () => {
      const machine = machineFor(kaleido);
      runFrames(machine, 240);
      // The prompts are read off the screen, not the listing: this BASIC's INPUT
      // takes no prompt string, so the wording is a PRINT of its own and could
      // be printed where nobody sees it.
      expect(screen(machine)).toContain('SEED (0-255)');
      for (const token of ['Num7', 'Return']) tap(machine, token, 20);
      expect(screen(machine)).toContain('TWIST (0-255)');
      for (const token of ['Num3', 'Return']) tap(machine, token, 20);
      expect(screen(machine)).toContain('PASSES (1-9)');
      for (const token of ['Num1', 'Return']) tap(machine, token, 20);
      runFrames(machine, 200);

      // GRAPHICS 11 holds two pixels to a byte, each a four-bit hue.
      const mem = ram(machine);
      const base = screenBase(machine);
      const pixel = (x: number, y: number): number => {
        const byte = mem[(base + y * 40 + (x >> 1)) & 0xffff]!;
        return x & 1 ? byte & 0x0f : byte >> 4;
      };

      const hues = new Set<number>();
      for (let y = 0; y < 192; y += 4) {
        for (let x = 0; x < 80; x++) hues.add(pixel(x, y));
      }
      expect(hues.size, 'the screen is blank').toBeGreaterThan(3);

      for (let y = 0; y < 96; y += 3) {
        for (let x = 0; x < 40; x++) {
          const v = pixel(x, y);
          expect(pixel(79 - x, y), `${x},${y} horizontal`).toBe(v);
          expect(pixel(x, 191 - y), `${x},${y} vertical`).toBe(v);
          expect(pixel(79 - x, 191 - y), `${x},${y} both`).toBe(v);
        }
      }
      machine.dispose();
    },
    120_000,
  );
});
