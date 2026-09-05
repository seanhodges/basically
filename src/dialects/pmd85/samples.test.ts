// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { pmd85Samples } from './samples';
import { pmd85 } from './index';
import { pmd85Keywords } from './keywords';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { pmd85MemoryBlocks } from './memoryBlocks';
import { splitRomImage } from './romImage';
import { tokenizeProgram } from './tokenizer';
import { Pmd85Machine } from './emulator/pmd85Machine';
import { VIDEO_RAM_STRIDE } from './emulator/display';
import { pmd85KeyboardLayout } from './keyboardLayout';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85/pmd85.rom')),
);

const sample = (name: string) => pmd85Samples.find((s) => s.name === name)!;

describe('pmd85 sample programs', () => {
  it('ships the canonical sample set in the canonical order', () => {
    expect(pmd85Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('offers hello as the starter for a fresh document', () => {
    expect(pmd85.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes every sample without errors', () => {
    for (const s of pmd85Samples) {
      const { errors } = pmd85.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('lints every sample clean, so no name hides a keyword', () => {
    // The trap this machine punishes hardest: a name containing a reserved word
    // is a hard Syntax err here, not the silent mis-run other Microsoft BASICs
    // give, so a sample with one would not run at all.
    for (const s of pmd85Samples) {
      expect(pmd85.lint(s.text), s.name).toEqual([]);
    }
  });

  it('never assigns to a name that is a keyword', () => {
    // Assignments only - the name at the head of a statement. A comparison
    // (`IF INKEY=255`) legitimately names a keyword and is not a collision.
    const words = new Set(pmd85Keywords.map((k) => k.word));
    const assignment = /(?:^\d+ |:)\s*(?:LET )?([A-Z][A-Z0-9]*)\s*=/gm;
    for (const s of pmd85Samples) {
      for (const [, name] of s.text.matchAll(assignment)) {
        expect(words.has(name!), `${s.name}: ${name}`).toBe(false);
      }
    }
  });

  it('drives the games from the function keys, which is all INKEY sees', () => {
    for (const name of ['breakout.bas', 'maze.bas']) {
      expect(sample(name).text, name).toContain('INKEY');
    }
  });
});

/** Boot on the shipped ROM with `text` loaded, ready to run. */
function machineFor(text: string): Pmd85Machine {
  const pmd = new Pmd85Machine(splitRomImage(rom));
  pmd.loadProgram(pmd85.tokenize(text).image);
  return pmd;
}

function runFrames(pmd: Pmd85Machine, frames: number): void {
  for (let frame = 0; frame < frames; frame++) pmd.runFrame();
}

/** Hold a function key long enough for the Monitor's matrix scan to see it. */
function tap(pmd: Pmd85Machine, key: string, hold = 12, after = 40): void {
  pmd.setKey(key, true);
  runFrames(pmd, hold);
  pmd.setKey(key, false);
  runFrames(pmd, after);
}

/** The lit pixel bits of the character cell at (column, scanline). */
function cell(pmd: Pmd85Machine, col: number, line: number): number {
  return pmd.mem.videoRam[line * VIDEO_RAM_STRIDE + col]! & 0x3f;
}

/** Every lit pixel's bounding box, in screen pixels. */
function inkBounds(pmd: Pmd85Machine) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < 256; y++) {
    for (let col = 0; col < 48; col++) {
      const bits = cell(pmd, col, y);
      if (bits === 0) continue;
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (let bit = 0; bit < 6; bit++) {
        if (bits & (1 << bit)) {
          x0 = Math.min(x0, col * 6 + bit);
          x1 = Math.max(x1, col * 6 + bit);
        }
      }
    }
  }
  return { width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

describe('pmd85 samples on the machine', () => {
  /**
   * Every sample is actually run, because tokenizing clean is not the same as
   * working. Two of this machine's statements are spelled like Microsoft's and
   * are not: `INPUT "SEED";S` and `PAUSE 400` both tokenize perfectly and both
   * stop the program dead, which is exactly what this catches.
   */
  it.each(pmd85Samples.map((s) => [s.name, s.text] as const))(
    '%s runs without stopping on an error',
    (name, text) => {
      const pmd = machineFor(text);
      runFrames(pmd, 60);
      // The two games wait for a function key before they start.
      tap(pmd, 'K4', 12, 230);
      const report = pmd.readReport();
      expect(report?.isError ?? false, `${name}: ${report?.message}`).toBe(
        false,
      );
      // ...and it is still executing rather than having fallen off the end.
      expect(pmd.currentLine(), name).not.toBeNull();
    },
    30_000,
  );

  it('draws something on every sample that draws', () => {
    for (const s of pmd85Samples.slice(0, 4)) {
      const pmd = machineFor(s.text);
      runFrames(pmd, 60);
      tap(pmd, 'K4', 12, 230);
      const video = pmd.mem.videoRam;
      let lit = 0;
      for (let i = 0; i < video.length; i++) {
        if (i % VIDEO_RAM_STRIDE < 48 && video[i]! & 0x3f) lit++;
      }
      expect(lit, `${s.name} put nothing on screen`).toBeGreaterThan(20);
    }
  }, 60_000);
});

describe('pmd85 circles', () => {
  it('draws rings that are round, not oval', () => {
    // SCALE maps its window onto 256x243 pixels, so a window that is square in
    // its own units draws ovals - the one failure of this sample that no amount
    // of tokenizing or error-checking can see.
    const pmd = machineFor(sample('circles.bas').text);
    runFrames(pmd, 1400);
    expect(pmd.currentLine(), 'the rings should all be drawn by now').toBe(220);
    const { width, height } = inkBounds(pmd);
    expect(width / height).toBeGreaterThan(0.97);
    expect(width / height).toBeLessThan(1.03);
  }, 60_000);
});

describe('pmd85 breakout', () => {
  /**
   * Which function key means which direction is not the sample's to choose:
   * the on-screen controller sends these, so a game that reads any other
   * arrangement answers the pad's arrows with the wrong move.
   */
  const { left, right } = pmd85KeyboardLayout.controller!.bindings;

  /** The columns the paddle occupies, read off its top scanline. */
  function paddleColumns(pmd: Pmd85Machine): number[] {
    const cols: number[] = [];
    for (let col = 0; col < 48; col++) if (cell(pmd, col, 228)) cols.push(col);
    return cols;
  }

  it('moves the paddle the way the on-screen controller points', () => {
    const pmd = machineFor(sample('breakout.bas').text);
    runFrames(pmd, 60);
    tap(pmd, 'K4', 10, 60);
    const start = paddleColumns(pmd)[0];
    expect(start, 'no paddle on screen').not.toBeUndefined();

    for (let i = 0; i < 6; i++) tap(pmd, right, 12, 12);
    expect(
      paddleColumns(pmd)[0],
      `${right} is the pad's right, so the paddle must go right`,
    ).toBeGreaterThan(start!);

    for (let i = 0; i < 10; i++) tap(pmd, left, 12, 12);
    expect(
      paddleColumns(pmd)[0],
      `${left} is the pad's left, so the paddle must go left`,
    ).toBeLessThan(start!);
  }, 120_000);
});

describe('pmd85 maze', () => {
  /** The wall map as the sample's own DATA lines spell it. */
  const rows = [...sample('maze.bas').text.matchAll(/^\d+ DATA "(.*)"$/gm)].map(
    (m) => m[1]!,
  );

  it('is a rectangle with a start and an exit', () => {
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
    const seen = new Set<number>();
    const queue: [number, number][] = [[1, 1]];
    seen.add(1 * width + 1);
    let escaped = false;
    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      if (rows[y]![x] === 'E') {
        escaped = true;
        break;
      }
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

  /**
   * The map is printed once and a move repaints one cell, so the marker must
   * land on the cell the map is on: the first PRINT after GCLEAR lands on text
   * row 1, which puts map row Y at row 3+Y and its top scanline at 28+9*Y. An
   * off-by-one here still runs, still draws, and still moves - it just draws
   * the marker into the wrong row.
   */
  const markerCell = (pmd: Pmd85Machine, x: number, y: number) =>
    Array.from({ length: 8 }, (_, j) => cell(pmd, x, 28 + 9 * y + j));

  it('moves the marker one cell and repaints nothing else', () => {
    const pmd = machineFor(sample('maze.bas').text);
    runFrames(pmd, 250);
    expect(markerCell(pmd, 1, 1), 'no marker on the start cell').toEqual(
      new Array(8).fill(0x3f),
    );

    const before = Uint8Array.from(pmd.mem.videoRam);
    tap(pmd, pmd85KeyboardLayout.controller!.bindings.down);
    expect(markerCell(pmd, 1, 1), 'the cell left behind').toEqual(
      new Array(8).fill(0),
    );
    expect(markerCell(pmd, 1, 2), 'the cell arrived at').toEqual(
      new Array(8).fill(0x3f),
    );

    // Sixteen bytes of the displayed 48 columns: eight erased, eight drawn.
    let repainted = 0;
    for (let i = 0; i < before.length; i++) {
      if (i % VIDEO_RAM_STRIDE < 48 && before[i] !== pmd.mem.videoRam[i]) {
        repainted++;
      }
    }
    expect(repainted, 'a move should not redraw the map').toBe(16);
  }, 60_000);
});

describe('pmd85 kaleidoscope', () => {
  const kaleido = sample('kaleido.bas');

  it('assembles into its block, inside a range a block may use', () => {
    const [block] = materializeSampleBlocks(pmd85, kaleido);
    expect(block).toBeTruthy();
    expect(block!.address).toBe(0x7000);
    expect(block!.entry).toBe(0x7003);
    expect(block!.bytes.length).toBeGreaterThan(0);
    const end = block!.address + block!.bytes.length - 1;
    expect(
      pmd85MemoryBlocks.validRanges.some(
        (r) => block!.address >= r.start && end <= r.end,
      ),
      `${block!.bytes.length} bytes at 0x7000 must fit a valid range`,
    ).toBe(true);
  });

  it('draws a four-way mirror into the frame buffer', () => {
    // Driven by POKE and USR rather than through the sample's own INPUT
    // prompts, so the test needs no keyboard scripting. The routine is the
    // thing under test; the prompts are not.
    const blocks = materializeSampleBlocks(pmd85, kaleido);
    const { program, errors } = tokenizeProgram(
      "10 POKE '7000,3\n20 POKE '7001,5\n30 POKE '7002,2\n" +
        "40 A=USR('7003)\n50 GOTO 50\n",
    );
    expect(errors).toEqual([]);

    const pmd = new Pmd85Machine(splitRomImage(rom));
    pmd.loadProgram(program, { blocks });
    for (let frame = 0; frame < 400; frame++) pmd.runFrame();
    // The trailing GOTO keeps BASIC busy so the OK prompt never prints over the
    // bottom rows - the dialogue line sits on scanlines 246-254, which is
    // inside the last two rows of cells the mirror is checked over.
    expect(pmd.isProgramRunning()).toBe(true);

    const video = pmd.mem.videoRam;
    /** The pixel bits of the cell at (column, row of eight scanlines). */
    const cell = (col: number, row: number) =>
      video[row * 8 * VIDEO_RAM_STRIDE + col]! & 0x3f;

    // A drawn pattern, not a blanked screen.
    const distinct = new Set<number>();
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 48; col++) distinct.add(cell(col, row));
    }
    expect(distinct.size).toBeGreaterThan(2);

    // ...mirrored four ways over the whole 48x32 grid of cells.
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 24; col++) {
        const v = cell(col, row);
        expect(cell(47 - col, row), `${col},${row} horizontal`).toBe(v);
        expect(cell(col, 31 - row), `${col},${row} vertical`).toBe(v);
        expect(cell(47 - col, 31 - row), `${col},${row} both`).toBe(v);
      }
    }
  }, 30_000);
});
