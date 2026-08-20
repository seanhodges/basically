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

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/pmd85.rom')),
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

describe('pmd85 samples on the machine', () => {
  /**
   * Every sample is actually run, because tokenizing clean is not the same as
   * working: `PAUSE 400` tokenizes perfectly and stops the program with a
   * parameter error, which is exactly the failure this catches.
   */
  it.each(pmd85Samples.slice(0, 4).map((s) => [s.name, s.text] as const))(
    '%s runs without stopping on an error',
    (name, text) => {
      const pmd = new Pmd85Machine(splitRomImage(rom));
      pmd.loadProgram(pmd85.tokenize(text).image);
      for (let frame = 0; frame < 300; frame++) {
        pmd.runFrame();
        // The two games wait for a function key before they start.
        if (frame === 60) pmd.setKey('K1', true);
        if (frame === 70) pmd.setKey('K1', false);
      }
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
      const pmd = new Pmd85Machine(splitRomImage(rom));
      pmd.loadProgram(pmd85.tokenize(s.text).image);
      for (let frame = 0; frame < 300; frame++) {
        pmd.runFrame();
        if (frame === 60) pmd.setKey('K1', true);
        if (frame === 70) pmd.setKey('K1', false);
      }
      const video = pmd.mem.videoRam;
      let lit = 0;
      for (let i = 0; i < video.length; i++) {
        if (i % VIDEO_RAM_STRIDE < 48 && video[i]! & 0x3f) lit++;
      }
      expect(lit, `${s.name} put nothing on screen`).toBeGreaterThan(20);
    }
  }, 60_000);
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
