// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { hb10p } from './index';
import { hb10pKeywords } from './keywords';
import { hb10pKeyboardLayout } from './keyboardLayout';
import { hb10pMemoryBlocks } from './memoryBlocks';
import { hb10pSamples } from './samples';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import {
  bootMachine,
  hasRom,
  runFrames,
  runUntil,
  screenText,
} from '../bootHarness';
import type { MsxMachine } from '../../emulator/msx/msxMachine';
import type { SampleFile } from '../types';

/**
 * The bundled programs, and what they do on the real ROM.
 *
 * Every sample here is booted and run, because tokenizing clean says nothing
 * about whether the machine agrees: MSX BASIC's PRINT draws nothing at all in
 * SCREEN 2 without raising an error, its text screens open at WIDTH 39 and 29
 * rather than 40 and 32, and its string space is 200 bytes whatever the free
 * memory figure says - three ways a listing that tokenizes perfectly puts
 * nothing readable on screen.
 *
 * One boot per sample, and each test asks that machine everything it can: an
 * MSX boot is nearly three hundred frames whatever the host does, because MSX
 * BASIC's own start-up delay is about three seconds of emulated time.
 */

const sample = (name: string): SampleFile =>
  hb10pSamples.find((s) => s.name === name)!;

const romSuite = hasRom(hb10p) ? describe : describe.skip;

/** Boot on the shipped ROM with `name` loaded and running. */
async function machineFor(name: string): Promise<MsxMachine> {
  const file = sample(name);
  const machine = (await bootMachine(hb10p)) as MsxMachine;
  machine.loadProgram(hb10p.tokenize(file.text).image, {
    blocks: materializeSampleBlocks(hb10p, file),
  });
  return machine;
}

/** Hold a key long enough for the BIOS's own matrix scan to see it. */
async function tap(
  machine: MsxMachine,
  token: string,
  hold = 8,
  after = 40,
): Promise<void> {
  machine.setKey(token, true);
  await runFrames(machine, hold);
  machine.setKey(token, false);
  await runFrames(machine, after);
}

/** Answer the control menu with the keyboard and press start. */
async function startGame(machine: MsxMachine): Promise<void> {
  await runFrames(machine, 40);
  await tap(machine, 'Digit1', 8, 30);
  await tap(machine, 'Space', 8, 30);
}

/** The character codes on screen, straight off the VDP's name table. */
function nameTable(machine: MsxMachine): Uint8Array {
  const base = machine.video.nameTable;
  const cols = machine.video.mode === 'text' ? 40 : 32;
  return Uint8Array.from(machine.video.vram.subarray(base, base + cols * 24));
}

describe('hb10p sample programs', () => {
  it('ships the canonical sample set in the canonical order', () => {
    expect(hb10pSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('offers hello as the starter for a fresh document', () => {
    expect(hb10p.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes and lints every sample clean', () => {
    for (const s of hb10pSamples) {
      const { errors, image } = hb10p.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(image.length, s.name).toBeGreaterThan(2);
      expect(hb10p.lint(s.text), s.name).toEqual([]);
    }
  });

  it('never assigns to a name the ROM would read as a keyword', () => {
    // MSX BASIC crunches, so a name embedding a reserved word is stored as the
    // keyword and the line mis-runs without an error to show for it.
    const words = new Set(hb10pKeywords.map((k) => k.word));
    const assignment = /(?:^\d+ |:)\s*(?:LET )?([A-Z][A-Z0-9]*)[$%!#]?\s*=/gm;
    for (const s of hb10pSamples) {
      for (const [, name] of s.text.matchAll(assignment)) {
        expect(words.has(name!), `${s.name}: ${name}`).toBe(false);
      }
    }
  });

  it('drives both games from the cursor cluster the pad presses', () => {
    // STICK(0) is the cursor keys and STRIG(0) the space bar, which is exactly
    // what the on-screen controller binds to; the joystick option is the same
    // two statements with the argument changed.
    for (const name of ['breakout.bas', 'maze.bas']) {
      expect(sample(name).text, name).toContain('STICK(M-1)');
      expect(sample(name).text, name).toContain('STRIG(M-1)');
    }
  });
});

describe('hb10p maze map', () => {
  const rows = [...sample('maze.bas').text.matchAll(/^\d+ DATA "(.*)"$/gm)].map(
    (m) => m[1]!,
  );

  it('is a rectangle with a walkable start and an exit', () => {
    expect(rows).toHaveLength(21);
    for (const row of rows) expect(row.length).toBe(rows[0]!.length);
    // The sample starts the marker at (1, 1), which has to be walkable.
    expect(rows[1]![1]).toBe(' ');
    expect(rows.join('')).toContain('E');
  });

  it('is solvable from the start cell', () => {
    // Breadth-first from (1, 1). A maze whose exit cannot be reached is not a
    // broken test, it is a sample nobody can finish.
    const width = rows[0]!.length;
    const seen = new Set([width + 1]);
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
});

describe('hb10p kaleidoscope block', () => {
  it('assembles into a range a block may use', () => {
    const [block] = materializeSampleBlocks(hb10p, sample('kaleido.bas'));
    expect(block).toBeTruthy();
    expect(block!.address).toBe(0xe000);
    expect(block!.entry).toBe(0xe003);
    expect(block!.bytes.length).toBeGreaterThan(0);
    const end = block!.address + block!.bytes.length - 1;
    expect(
      hb10pMemoryBlocks.validRanges.some(
        (r) => block!.address >= r.start && end <= r.end,
      ),
      `${block!.bytes.length} bytes at 0xE000 must fit a valid range`,
    ).toBe(true);
    // The program lowers HIMEM to &HDFFF so the interpreter stays below it.
    expect(sample('kaleido.bas').text).toContain('CLEAR 200,&HDFFF');
    expect(end).toBeLessThan(0xf380);
  });
});

romSuite('hb10p samples on the machine', () => {
  it('greets and signs off, and keeps cycling', async () => {
    const machine = await machineFor('hello.bas');
    await runUntil(machine, () => machine.currentLine() === 90, 400);
    const screen = screenText(machine);
    expect(screen).toContain('HELLO FROM THE HB-10P');
    expect(screen).toContain('* BASICALLY *');
    // The cascade fills the display rather than printing one line.
    const greeted = screen
      .split('\n')
      .filter((l) => l.includes('HELLO FROM THE HB-10P'));
    expect(greeted.length).toBeGreaterThan(15);
    expect(machine.isProgramRunning()).toBe(true);
    machine.dispose();
  }, 30_000);

  it('draws rings that are round and closed, then waits for a key', async () => {
    const machine = await machineFor('circles.bas');
    const drawn = await runUntil(
      machine,
      () => machine.currentLine() === 170,
      1200,
    );
    expect(drawn, 'the rings should all be drawn inside 24 seconds').toBe(true);

    // The SCREEN 2 pattern table is linear: the byte for row r, column c,
    // pixel line l is r*256 + c*8 + l, and a set bit is a plotted pixel.
    const vram = machine.video.vram;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    let lit = 0;
    for (let r = 0; r < 24; r++) {
      for (let c = 0; c < 32; c++) {
        for (let l = 0; l < 8; l++) {
          const bits = vram[r * 256 + c * 8 + l]!;
          if (bits === 0) continue;
          y0 = Math.min(y0, r * 8 + l);
          y1 = Math.max(y1, r * 8 + l);
          for (let bit = 0; bit < 8; bit++) {
            if (!(bits & (0x80 >> bit))) continue;
            lit++;
            x0 = Math.min(x0, c * 8 + bit);
            x1 = Math.max(x1, c * 8 + bit);
          }
        }
      }
    }
    expect(lit, 'nothing was plotted').toBeGreaterThan(500);
    // Round, not oval: an aspect away from 1 is what a recurrence run with the
    // full E rather than E/2 draws, and it tokenizes exactly the same.
    const aspect = (x1 - x0 + 1) / (y1 - y0 + 1);
    expect(aspect).toBeGreaterThan(0.97);
    expect(aspect).toBeLessThan(1.03);
    // Closed, not an arc: the outermost ring reaches the top and the bottom of
    // its own bounding box on both sides of the centre.
    const midY = (y0 + y1) >> 1;
    const rowHasInk = (y: number) => {
      const r = y >> 3;
      const l = y & 7;
      for (let c = 0; c < 32; c++) if (vram[r * 256 + c * 8 + l]) return true;
      return false;
    };
    expect(rowHasInk(y0)).toBe(true);
    expect(rowHasInk(y1)).toBe(true);
    expect(rowHasInk(midY)).toBe(true);
    machine.dispose();
  }, 60_000);

  it('scores, follows the pad and ends on GAME OVER', async () => {
    const machine = await machineFor('breakout.bas');
    await startGame(machine);
    // The bricks are laid before the main loop starts, and the bat with them.
    await runUntil(machine, () => (machine.currentLine() ?? 0) >= 230, 400);
    expect(screenText(machine)).toContain('SCORE');

    // Which cursor key means which direction is not the sample's to choose:
    // the on-screen controller sends these, so a game reading any other
    // arrangement answers the pad's arrows with the wrong move.
    const { left, right } = hb10pKeyboardLayout.controller!.bindings;
    const paddle = (): number =>
      nameTable(machine).indexOf(219, 22 * 32) - 22 * 32;
    const start = paddle();
    expect(start, 'no paddle on screen').toBeGreaterThanOrEqual(0);
    await tap(machine, right!, 30, 10);
    expect(paddle(), `${right} is the pad's right`).toBeGreaterThan(start);
    await tap(machine, left!, 60, 10);
    expect(paddle(), `${left} is the pad's left`).toBeLessThan(start);

    // The ball is lost eventually with nobody at the bat.
    const over = await runUntil(
      machine,
      () => screenText(machine).includes('GAME OVER'),
      600,
    );
    expect(over, 'the ball should drop within twelve seconds').toBe(true);
    machine.dispose();
  }, 60_000);

  it('names the goal and moves the marker one cell at a time', async () => {
    const machine = await machineFor('maze.bas');
    await startGame(machine);
    await runUntil(machine, () => machine.currentLine() === 200, 400);
    const screen = screenText(machine);
    expect(screen).toContain('REACH E - CURSOR KEYS');
    // Map row 0 is screen row 2, so the marker starts at screen (1, 3).
    const MARKER = 'O'.charCodeAt(0);
    const cell = (col: number, row: number) =>
      nameTable(machine)[row * 40 + col];
    expect(cell(1, 3), 'no marker on the start cell').toBe(MARKER);

    // Right is the only way out of the start cell - the row below it is wall.
    const before = nameTable(machine);
    await tap(machine, hb10pKeyboardLayout.controller!.bindings.right!, 6, 30);
    expect(cell(1, 3), 'the cell left behind').toBe(0x20);
    expect(cell(2, 3), 'the cell arrived at').toBe(MARKER);
    const after = nameTable(machine);
    let repainted = 0;
    for (let i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) repainted++;
    }
    expect(repainted, 'a move should not redraw the map').toBe(2);
    machine.dispose();
  }, 60_000);

  it('asks for its three parameters and mirrors the picture four ways', async () => {
    const machine = await machineFor('kaleido.bas');
    await runUntil(machine, () => screenText(machine).includes('SEED'), 400);
    const prompt = screenText(machine);
    expect(prompt).toContain('SEED (0-255)');

    for (const digit of ['Digit7', 'Digit3', 'Digit2']) {
      await tap(machine, digit, 6, 10);
      await tap(machine, 'Return', 6, 20);
    }
    const drawn = await runUntil(
      machine,
      () => machine.currentLine() === 130,
      600,
    );
    expect(drawn, 'the routine should return to the key wait').toBe(true);

    // The colour table is what the routine paints: one byte per pixel row of a
    // cell, both nibbles the same colour, so a cell reads as one byte.
    const vram = machine.video.vram;
    const cell = (col: number, row: number) =>
      vram[machine.video.colourTable + row * 256 + col * 8]!;
    const distinct = new Set<number>();
    for (let row = 0; row < 24; row++) {
      for (let col = 0; col < 32; col++) distinct.add(cell(col, row));
    }
    expect(
      distinct.size,
      'a blank screen is not a kaleidoscope',
    ).toBeGreaterThan(2);
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 16; col++) {
        const value = cell(col, row);
        expect(cell(31 - col, row), `${col},${row} horizontal`).toBe(value);
        expect(cell(col, 23 - row), `${col},${row} vertical`).toBe(value);
        expect(cell(31 - col, 23 - row), `${col},${row} both`).toBe(value);
      }
    }
    machine.dispose();
  }, 60_000);
});
