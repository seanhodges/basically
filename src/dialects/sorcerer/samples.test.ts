// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sorcererSamples } from './samples';
import { sorcerer } from './index';
import { sorcererKeywords } from './keywords';
import { sorcererKeyboardLayout } from './keyboardLayout';
import { sorcererMemoryBlocks } from './memoryBlocks';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { splitRomImage } from './romImage';
import { SorcererMachine } from '../../emulator/sorcerer/sorcererMachine';
import { SCREEN_BASE, SCREEN_COLUMNS, SCREEN_ROWS } from './addresses';
import type { Block } from '../types';

const ROM_PATH = join(__dirname, '../../../public/roms/sorcerer/sorcerer.rom');
const hasRom = existsSync(ROM_PATH);
const onMachine = hasRom ? it : it.skip;

const sample = (name: string) => sorcererSamples.find((s) => s.name === name)!;

describe('sorcerer sample programs', () => {
  it('ships the canonical sample set in the canonical order', () => {
    expect(sorcererSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('offers hello as the starter for a fresh document', () => {
    expect(sorcerer.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes and lints every sample clean', () => {
    for (const s of sorcererSamples) {
      const { errors } = sorcerer.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(sorcerer.lint(s.text), s.name).toEqual([]);
    }
  });

  it('never assigns to a name that is a keyword', () => {
    // A variable spelled like a reserved word tokenizes to the keyword byte and
    // the ROM mis-runs the line without complaining, so this is the collision
    // no error message would catch. Assignments only: a comparison may name one.
    const words = new Set(sorcererKeywords.map((k) => k.word));
    const assignment = /(?:^\d+ |:)\s*(?:LET )?([A-Z][A-Z0-9]*)\s*=/gm;
    for (const s of sorcererSamples) {
      for (const [, name] of s.text.matchAll(assignment)) {
        expect(words.has(name!), `${s.name}: ${name}`).toBe(false);
      }
    }
  });

  it('drives both games through the key-scanner block', () => {
    // There is no INKEY$ here, and a BASIC port poll cannot be trusted: the
    // interpreter asks the Monitor for a break key between statements, which
    // leaves keyboard line 0 selected whatever line the program asked for. So
    // the games call the scanner and read the byte it leaves behind.
    for (const name of ['breakout.bas', 'maze.bas']) {
      expect(sample(name).text, name).toContain('USR(0)');
      expect(sample(name).text, name).toContain('PEEK(28672)');
      expect(sample(name).blocks?.[0]?.name, name).toBe('keys');
    }
  });

  it('assembles every bundled block into a range a block may use', () => {
    for (const s of sorcererSamples) {
      for (const block of materializeSampleBlocks(sorcerer, s)) {
        const end = block.address + block.bytes.length - 1;
        expect(block.bytes.length, `${s.name} ${block.name}`).toBeGreaterThan(
          0,
        );
        expect(
          sorcererMemoryBlocks.validRanges.some(
            (r) => block.address >= r.start && end <= r.end,
          ),
          `${s.name} ${block.name}: ${block.bytes.length} bytes at 0x${block.address.toString(16)}`,
        ).toBe(true);
      }
    }
  });

  it('points each block entry at the instruction after its parameters', () => {
    const [keys] = materializeSampleBlocks(sorcerer, sample('maze.bas'));
    expect(keys!.address).toBe(0x7000);
    expect(keys!.entry).toBe(0x7001);
    const [kaleido] = materializeSampleBlocks(sorcerer, sample('kaleido.bas'));
    expect(kaleido!.address).toBe(0x7000);
    expect(kaleido!.entry).toBe(0x7003);
  });
});

/**
 * Frame budgets, in the machine's own ~60 Hz frames.
 *
 * This interpreter is slow enough that the numbers matter: a `POKE` whose
 * address is worked out with a multiply costs about a fiftieth of a second, so
 * the pictures below are seconds of emulated time rather than a few frames.
 */
/** Long enough for the slowest sample, `circles`, to finish its three rings. */
const DRAW_FRAMES = 700;
/** Long enough for a program to print its opening screen. */
const OPENING_FRAMES = 120;
/** A key held long enough for the scanner to see it, and the gap after it. */
const KEY_HOLD_FRAMES = 14;
const KEY_GAP_FRAMES = 60;

function machineFor(sampleName: string): SorcererMachine {
  const file = sample(sampleName);
  const machine = new SorcererMachine(
    splitRomImage(new Uint8Array(readFileSync(ROM_PATH))),
  );
  const blocks: Block[] = materializeSampleBlocks(sorcerer, file);
  machine.loadProgram(sorcerer.tokenize(file.text).image, { blocks });
  return machine;
}

function runFrames(machine: SorcererMachine, frames: number): void {
  for (let i = 0; i < frames; i++) machine.runFrame();
}

function tap(
  machine: SorcererMachine,
  token: string,
  hold = KEY_HOLD_FRAMES,
  after = KEY_GAP_FRAMES,
): void {
  machine.setKey(token, true);
  runFrames(machine, hold);
  machine.setKey(token, false);
  runFrames(machine, after);
}

/** The screen as text, which is what a person at the machine reads. */
const screenText = (machine: SorcererMachine): string =>
  machine.readScreenText()!.lines.join('\n');

/** The character code in one screen cell. */
const cell = (machine: SorcererMachine, col: number, row: number): number =>
  machine.mem.peek(SCREEN_BASE + row * SCREEN_COLUMNS + col);

/** Every cell holding `code`, as [column, row] pairs. */
function cellsWith(machine: SorcererMachine, code: number): [number, number][] {
  const found: [number, number][] = [];
  for (let row = 0; row < SCREEN_ROWS; row++) {
    for (let col = 0; col < SCREEN_COLUMNS; col++) {
      if (cell(machine, col, row) === code) found.push([col, row]);
    }
  }
  return found;
}

describe('sorcerer samples on the machine', () => {
  onMachine(
    'runs every sample without stopping on an error',
    () => {
      for (const s of sorcererSamples) {
        const machine = machineFor(s.name);
        runFrames(machine, OPENING_FRAMES);
        // The two games wait to be started; the kaleidoscope waits for its
        // three answers. Everything else is already drawing.
        tap(machine, 'Space');
        expect(screenText(machine), `${s.name} reported an error`).not.toContain('ERROR'); // prettier-ignore
        // The three that loop are still executing rather than having fallen
        // off the end; `hello` and `circles` are pictures and do end.
        if (s.name !== 'hello.bas' && s.name !== 'circles.bas') {
          expect(machine.isProgramRunning(), `${s.name} stopped`).toBe(true);
        }
        machine.dispose();
      }
    },
    60_000,
  );

  onMachine(
    'hello greets the machine by name and signs off on the banner',
    () => {
      // Read off the screen rather than out of the listing: a line printed past
      // the bottom of a 30-row display passes every static check and reaches
      // nobody.
      const machine = machineFor('hello.bas');
      runFrames(machine, DRAW_FRAMES);
      const text = screenText(machine);
      expect(text).toContain('HELLO FROM THE SORCERER');
      expect(text).toContain('* BASICALLY *');
      machine.dispose();
    },
    30_000,
  );

  onMachine(
    'circles draws three closed rings, round in the pixels the canvas shows',
    () => {
      // A cell is 8x8 dots, so a ring of R cells is 8R canvas pixels across and
      // down: plotting it 1:1 in cells is what makes it round here, and the
      // aspect below is what would catch a fudge factor copied from a machine
      // whose pixels are not square.
      const machine = machineFor('circles.bas');
      runFrames(machine, DRAW_FRAMES);
      expect(machine.isProgramRunning(), 'the rings should be drawn by now').toBe(false); // prettier-ignore

      const ink = cellsWith(machine, 0x84);
      const cols = ink.map(([col]) => col);
      const rows = ink.map(([, row]) => row);
      const width = Math.max(...cols) - Math.min(...cols) + 1;
      const height = Math.max(...rows) - Math.min(...rows) + 1;
      expect(width / height).toBeGreaterThan(0.97);
      expect(width / height).toBeLessThan(1.03);

      // Three rings, each closed: every one of the 30 rows the outer ring spans
      // carries ink on both sides of the centre, so an arc with a gap in it
      // fails here rather than looking nearly right.
      const centre = 32;
      for (let row = Math.min(...rows); row <= Math.max(...rows); row++) {
        const inRow = ink.filter(([, r]) => r === row).map(([c]) => c);
        expect(
          inRow.some((c) => c < centre) && inRow.some((c) => c > centre),
          `row ${row} of the outer ring is open`,
        ).toBe(true);
      }
      machine.dispose();
    },
    30_000,
  );

  onMachine(
    'breakout starts on the pad’s fire key and follows its left and right',
    () => {
      // Which key means which is not the sample's to choose: the on-screen
      // controller sends these, so a game reading any other arrangement answers
      // the pad with the wrong move.
      const { left, right, fire1 } =
        sorcererKeyboardLayout.controller!.bindings;
      const machine = machineFor('breakout.bas');
      runFrames(machine, OPENING_FRAMES);
      expect(screenText(machine)).toContain('PRESS SPACE TO START');

      tap(machine, fire1!);
      expect(screenText(machine), 'the score board').toContain('SCORE');
      const paddleAt = () =>
        Math.min(...cellsWith(machine, 0xa9).map(([col]) => col));
      // The wall is 42 bricks of three cells, and a POKE with a multiply in its
      // address costs about a fiftieth of a second, so the paddle is drawn a
      // few seconds after the game starts.
      for (let i = 0; i < DRAW_FRAMES && !Number.isFinite(paddleAt()); i++)
        machine.runFrame();
      const start = paddleAt();
      expect(Number.isFinite(start), 'no paddle on screen').toBe(true);

      tap(machine, right!, 30, 10);
      expect(paddleAt(), `${right} is the pad's right`).toBeGreaterThan(start);
      tap(machine, left!, 60, 10);
      expect(paddleAt(), `${left} is the pad's left`).toBeLessThan(start);
      machine.dispose();
    },
    60_000,
  );
});

describe('sorcerer maze', () => {
  /** The wall map as the sample's own DATA lines spell it. */
  const rows = [...sample('maze.bas').text.matchAll(/^\d+ DATA "(.*)"$/gm)].map(
    (m) => m[1]!,
  );

  it('is a rectangle with a walkable start and an exit', () => {
    expect(rows.length).toBeGreaterThan(4);
    for (const row of rows) expect(row.length).toBe(rows[0]!.length);
    // The marker starts at (1, 1), which has to be a corridor.
    expect(rows[1]![1]).toBe(' ');
    expect(rows.join('')).toContain('E');
  });

  it('is solvable from the start cell', () => {
    // Breadth-first from (1, 1). A maze whose exit cannot be reached is not a
    // broken test, it is a sample nobody can finish.
    const width = rows[0]!.length;
    const seen = new Set([1 * width + 1]);
    const queue: [number, number][] = [[1, 1]];
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
        if (seen.has(ny * width + nx)) continue;
        seen.add(ny * width + nx);
        queue.push([nx, ny]);
      }
    }
    expect(escaped).toBe(true);
  });

  onMachine(
    'moves the marker one cell per press and repaints nothing else',
    () => {
      // The map is printed once and a move repaints two cells, so the marker
      // has to land on the row the map was printed on: `PRINT CHR$(12);` keeps
      // the cursor at the top-left, and without the semicolon the whole map
      // would sit one row below where the POKEs put the marker. That
      // off-by-one still runs, still draws and still moves.
      const machine = machineFor('maze.bas');
      runFrames(machine, DRAW_FRAMES);
      expect(screenText(machine)).toContain('REACH E');
      expect(cell(machine, 1, 1), 'no marker on the start cell').toBe(0x4f);

      const before = Array.from(
        { length: SCREEN_ROWS * SCREEN_COLUMNS },
        (_, i) => machine.mem.peek(SCREEN_BASE + i),
      );
      tap(machine, sorcererKeyboardLayout.controller!.bindings.down!);
      expect(cell(machine, 1, 1), 'the cell left behind').toBe(0x20);
      expect(cell(machine, 1, 2), 'the cell arrived at').toBe(0x4f);

      const repainted = before.filter(
        (byte, i) => byte !== machine.mem.peek(SCREEN_BASE + i),
      ).length;
      expect(repainted, 'a move should not redraw the map').toBe(2);
      machine.dispose();
    },
    60_000,
  );
});

describe('sorcerer kaleidoscope', () => {
  onMachine(
    'draws a four-way mirror over the whole screen',
    () => {
      // Driven by POKE and USR rather than through the sample's own prompts, so
      // the test needs no keyboard scripting: the routine is what is under
      // test, the prompts are not.
      const machine = new SorcererMachine(
        splitRomImage(new Uint8Array(readFileSync(ROM_PATH))),
      );
      const blocks = materializeSampleBlocks(sorcerer, sample('kaleido.bas'));
      machine.loadProgram(
        sorcerer.tokenize(
          '10 POKE 260,3:POKE 261,112\n' +
            '20 POKE 28672,7:POKE 28673,3:POKE 28674,2\n' +
            '30 A=USR(0)\n' +
            '40 GOTO 40\n',
        ).image,
        { blocks },
      );
      runFrames(machine, DRAW_FRAMES);
      expect(machine.isProgramRunning()).toBe(true);

      // A drawn pattern rather than a blanked screen...
      const distinct = new Set<number>();
      for (let row = 0; row < SCREEN_ROWS; row++) {
        for (let col = 0; col < SCREEN_COLUMNS; col++)
          distinct.add(cell(machine, col, row));
      }
      expect(distinct.size).toBeGreaterThan(2);

      // ...mirrored four ways over all 64x30 cells.
      for (let row = 0; row < SCREEN_ROWS / 2; row++) {
        for (let col = 0; col < SCREEN_COLUMNS / 2; col++) {
          const code = cell(machine, col, row);
          expect(cell(machine, 63 - col, row), `${col},${row} across`).toBe(code); // prettier-ignore
          expect(cell(machine, col, 29 - row), `${col},${row} down`).toBe(code);
          expect(cell(machine, 63 - col, 29 - row), `${col},${row} both`).toBe(code); // prettier-ignore
        }
      }
      machine.dispose();
    },
    30_000,
  );
});
