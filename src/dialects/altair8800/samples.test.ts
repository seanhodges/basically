// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { altair8800 } from './index';
import { altair8800Samples, ALTAIR8800_KALEIDO_BLOCK } from './samples';
import { altair8800MemoryBlocks } from './memoryBlocks';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { altair8800Keywords } from './keywords';
import { altair8800VariableErrors } from '../../editor/variableLint';
import { COLS } from './emulator/terminal';
import { asmEngineFor } from '../../asm/registry';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { bootMachine, hasRom, runUntil } from '../bootHarness';
import type { MachineEmulator } from '../types';

/** BASIC's own default line width, which is narrower than the 80-column glass. */
const TERMINAL_WIDTH = 72;

const sample = (name: string) =>
  altair8800Samples.find((s) => s.name === name)!;

describe('altair8800 samples', () => {
  it('ships the canonical set in the canonical order', () => {
    // No `breakout.bas`: see the reason in samples.ts, which is the record of
    // why this machine's set is one short.
    expect(altair8800Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
    expect(altair8800Samples.map((s) => s.title)).toEqual([
      'Hello world',
      'Circles',
      'Maze',
      'Kaleidoscope',
    ]);
  });

  for (const s of altair8800Samples) {
    it(`${s.name} tokenizes and lists back unchanged`, () => {
      const { program, errors } = tokenizeProgram(s.text);
      expect(errors, s.name).toEqual([]);
      expect(program.length, s.name).toBeGreaterThan(0);
      // LIST is how a user checks what actually went in, so the sample has to
      // survive the round trip the interpreter itself would perform.
      const listed = detokenizeProgram(program);
      expect(tokenizeProgram(listed).program, s.name).toEqual(program);
    });

    it(`${s.name} uses no reserved keyword as a variable name`, () => {
      // A name embedding a keyword crunches to the keyword byte and the ROM
      // mis-runs the line without ever reporting an error.
      expect(
        altair8800VariableErrors(s.text, altair8800Keywords),
        s.name,
      ).toEqual([]);
    });

    it(`${s.name} numbers its lines flush-left, ascending, in tens`, () => {
      const numbers = s.text
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((line) => {
          expect(line, `${s.name}: "${line}"`).toMatch(/^[0-9]/);
          return Number(/^[0-9]+/.exec(line)![0]);
        });
      for (let i = 1; i < numbers.length; i++) {
        expect(numbers[i]!, s.name).toBe(numbers[i - 1]! + 10);
      }
    });
  }

  it('keeps every literal line of output inside the terminal width', () => {
    // 8K BASIC wraps at its TERMINAL WIDTH (72 by default, which is what the
    // machine's cold-start dialogue keeps), and the glass is 80 columns. A
    // banner or a maze row wider than that wraps into an unreadable mess.
    expect(TERMINAL_WIDTH).toBeLessThanOrEqual(COLS);
    for (const s of altair8800Samples) {
      for (const literal of s.text.matchAll(/"([^"\n]*)"/g)) {
        expect(
          literal[1]!.length,
          `${s.name}: ${literal[1]}`,
        ).toBeLessThanOrEqual(TERMINAL_WIDTH);
      }
    }
  });

  it('drives the maze from INPUT, the only key read this machine has', () => {
    // There is no INKEY$ in 8K BASIC. If this ever stops reading a line, the
    // on-screen keyboard can no longer play it at all.
    const code = sample('maze.bas')
      .text.split('\n')
      .filter((l) => !/^\d+ REM/.test(l))
      .join('\n');
    expect(code).toMatch(/\bINPUT\b/);
    expect(code).not.toMatch(/INKEY/);
  });

  it('ships the kaleidoscope routine as a block, and nothing else as one', () => {
    for (const s of altair8800Samples) {
      if (s.name === 'kaleido.bas') continue;
      expect(s.blocks, s.name).toBeUndefined();
    }
    expect(sample('kaleido.bas').blocks).toEqual([ALTAIR8800_KALEIDO_BLOCK]);
  });

  it('assembles the kaleidoscope block inside a legal range', () => {
    const engine = asmEngineFor(altair8800MemoryBlocks.cpu)!;
    const result = engine.assemble(
      ALTAIR8800_KALEIDO_BLOCK.asmSource,
      ALTAIR8800_KALEIDO_BLOCK.address,
    );
    expect(result.ok ? [] : result.errors).toEqual([]);
    if (!result.ok) return;
    const start = ALTAIR8800_KALEIDO_BLOCK.address;
    const end = start + result.bytes.length - 1;
    expect(
      altair8800MemoryBlocks.validRanges.some(
        (r) => start >= r.start && end <= r.end,
      ),
      `0x${start.toString(16)}-0x${end.toString(16)} must fit a valid range`,
    ).toBe(true);
    // The three POKEd parameter bytes come first, so the entry is address + 3.
    expect(ALTAIR8800_KALEIDO_BLOCK.entry).toBe(start + 3);
    // POKE converts its address as a signed 16-bit value, so a block a sample
    // has to POKE in decimal cannot sit at or above 32768.
    expect(end).toBeLessThan(0x8000);
  });

  it('pokes the kaleidoscope entry through the USR vector', () => {
    // USR calls one fixed vector and passes its argument as data, so the low
    // and high bytes of the entry have to be written to 73 and 74 by hand.
    const text = sample('kaleido.bas').text;
    const entry = ALTAIR8800_KALEIDO_BLOCK.entry;
    expect(text).toContain(`POKE 73,${entry & 0xff}`);
    expect(text).toContain(`POKE 74,${entry >> 8}`);
    for (const [i, name] of ['SEED', 'TWIST', 'PASSES'].entries()) {
      expect(text, name).toContain(
        `POKE ${ALTAIR8800_KALEIDO_BLOCK.address + i},`,
      );
    }
  });

  // The maze rows come from `DATA "…"` lines and the player starts at (1,1), so
  // a breadth-first walk over those rows must actually reach the exit.
  it('maze is a rectangle whose exit is reachable from the start', () => {
    const rows = sample('maze.bas')
      .text.split('\n')
      .filter((l) => /DATA "/.test(l))
      .map((l) => l.replace(/.*DATA "/, '').replace(/".*/, ''));
    expect(rows.length).toBeGreaterThan(0);
    const width = rows[0]!.length;
    for (const row of rows) expect(row.length).toBe(width);
    expect(rows[1]![1], 'the start cell must be walkable').toBe(' ');

    const seen = new Set(['1,1']);
    const queue: [number, number][] = [[1, 1]];
    let escaped = false;
    while (queue.length && !escaped) {
      const [x, y] = queue.shift()!;
      if (rows[y]![x] === 'E') escaped = true;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= rows.length) continue;
        if (rows[ny]![nx] === '#' || seen.has(`${nx},${ny}`)) continue;
        seen.add(`${nx},${ny}`);
        queue.push([nx, ny]);
      }
    }
    expect(escaped, 'the maze exit must be reachable').toBe(true);
    // The program's own bounds check, which must match the DATA it walks.
    expect(sample('maze.bas').text).toContain(`NX>${width - 1}`);
    expect(sample('maze.bas').text).toContain(`NY>${rows.length - 1}`);
  });

  it('circles keeps the Pitteway half-steps and closes each ring', () => {
    const text = sample('circles.bas').text;
    // Full E on the X half-steps integrates a sqrt(2):1 ellipse instead.
    expect(text).toContain('X=X-E/2*Y');
    expect(text).toContain('Y=Y+E*X');
    expect(text.match(/^\d+ X=X-E\/2\*Y$/gm)!.length).toBe(2);
    // Only a quarter turn is integrated - line 160 mirrors it into the other
    // three - so a ring closes at pi/2 radians rather than 2*pi. One step turns
    // by about E radians and E is 1/R, so the count is in units of R.
    expect(text).toContain('E=1/R');
    const steps = Number(/FOR A=1 TO ([0-9.]+)\*R/.exec(text)![1]);
    expect(steps).toBeGreaterThanOrEqual(Math.PI / 2);
  });
});

const describeOnRom = hasRom(altair8800) ? describe : describe.skip;

/**
 * Every sample run on the bundled 8K BASIC image, because nothing above proves
 * one works. All three of the faults this suite was written after tokenized and
 * linted clean: a picture that took forty-eight seconds to arrive and spent the
 * first twenty-five of them on a blank screen, a kaleidoscope with no machine
 * code in it at all, and a paddle game the machine cannot present.
 *
 * The frame counts are the machine's own, not wall clock, so they are the same
 * on every runner and can be pinned tightly. Divide by 50 for seconds.
 */
describeOnRom('what each sample actually does', () => {
  /** Boot, load and start `name`. */
  async function play(name: string): Promise<MachineEmulator> {
    const s = sample(name);
    const machine = await bootMachine(altair8800);
    const { image, errors } = altair8800.tokenize(s.text);
    expect(errors, name).toEqual([]);
    machine.loadProgram(image, {
      blocks: materializeSampleBlocks(altair8800, s),
    });
    return machine;
  }

  const screen = (machine: MachineEmulator) => machine.readScreenText()!.lines;
  const text = (machine: MachineEmulator) => screen(machine).join('\n');

  /** Type a line at the console the way the on-screen keyboard sends it. */
  async function typeLine(machine: MachineEmulator, line: string) {
    for (const ch of line) {
      const token = /[0-9]/.test(ch) ? `Digit${ch}` : `Key${ch.toUpperCase()}`;
      machine.setKey(token, true);
      machine.setKey(token, false);
    }
    machine.setKey('Enter', true);
    machine.setKey('Enter', false);
    await runUntil(machine, () => false, 10);
  }

  it('hello greets the machine by name and signs off on the banner', async () => {
    const machine = await play('hello.bas');
    const stopped = await runUntil(
      machine,
      () => machine.isProgramRunning() === false,
      50 * 10,
    );
    expect(stopped, 'hello should finish inside ten seconds').toBe(true);
    expect(machine.readReport!()).toEqual({ isError: false, message: 'OK' });
    // Read off the screen, not the listing: a line the display never reached
    // passes every static check and fails the user.
    expect(text(machine)).toContain('HELLO FROM THE ALTAIR 8800');
    expect(text(machine)).toContain('* BASICALLY *');
    machine.dispose?.();
  }, 60_000);

  it('circles draws three closed rings, promptly and round', async () => {
    const machine = await play('circles.bas');
    let frames = 0;
    let firstInk = -1;
    await runUntil(
      machine,
      () => frames > 60 && machine.isProgramRunning() === false,
      50 * 20,
      (f) => {
        frames = f;
        if (firstInk < 0 && text(machine).includes('*')) firstInk = f;
      },
    );
    expect(machine.readReport!()).toEqual({ isError: false, message: 'OK' });

    // The bug this pins: nothing can appear until the last ring is plotted, so
    // the integration is what the user waits through. Four rings of a full turn
    // each spent 1250 frames on a blank screen and 2390 in total.
    expect(firstInk, 'frames before the first ink').toBeLessThan(350);
    expect(frames, 'frames to the whole picture').toBeLessThan(600);

    const lines = screen(machine);
    const start = lines.findIndex((l) => l.trimEnd() === 'CIRCLES') + 1;
    expect(start).toBeGreaterThan(0);
    const picture = lines.slice(start, start + 16);

    // Grid column c prints at TAB(c), which is zero-based, so the 31 columns
    // occupy string indices 1 to 31 and mirror about the middle of that span.
    for (const [i, row] of picture.entries()) {
      const span = row.slice(1, 32);
      expect(span, `picture row ${i} must mirror left to right`).toBe(
        [...span].reverse().join(''),
      );
    }
    // Top to bottom too, which is the other half of the mirrored quarter turn.
    for (let i = 0; i < 8; i++) {
      expect(picture[i]!.trimEnd(), `row ${i} mirrors row ${15 - i}`).toBe(
        picture[15 - i]!.trimEnd(),
      );
    }

    // Three rings: the two rows across the middle cut every ring twice.
    for (const row of [picture[7]!, picture[8]!]) {
      expect(row.trim().split(/\s+/).length, `runs in "${row.trim()}"`).toBe(6);
    }
    // Round in the pixels the terminal presents: a cell is 8 wide and 16 tall,
    // so a circle is twice as many columns as rows.
    const inked = picture.flatMap((row) =>
      [...row].flatMap((c, x) => (c === '*' ? [x] : [])),
    );
    const width = Math.max(...inked) - Math.min(...inked) + 1;
    const rows = picture.filter((r) => r.includes('*')).length;
    expect(width / (2 * rows)).toBeGreaterThan(0.9);
    expect(width / (2 * rows)).toBeLessThan(1.1);
    machine.dispose?.();
  }, 60_000);

  it('maze prints a map with the marker, the exit and the goal', async () => {
    const machine = await play('maze.bas');
    const prompted = await runUntil(
      machine,
      () => text(machine).includes('REACH E'),
      50 * 20,
    );
    expect(prompted, 'the maze should ask for a move').toBe(true);
    const before = screen(machine);
    const map = before.filter((l) => l.startsWith('#'));
    expect(map.length).toBeGreaterThan(10);
    expect(
      map.some((l) => l.includes('O')),
      'the marker',
    ).toBe(true);
    expect(
      map.some((l) => l.includes('E')),
      'the exit',
    ).toBe(true);

    // One move repaints the map with the marker one cell on. There is no cursor
    // addressing here, so a whole map is the smallest repaint the machine has.
    await typeLine(machine, 'S');
    await runUntil(
      machine,
      () => text(machine).split('REACH E').length > 2,
      50 * 20,
    );
    const after = screen(machine).filter((l) => l.startsWith('#'));
    const markerRow = (rows: string[]) =>
      rows.findIndex((l) => l.includes('O'));
    expect(markerRow(after)).toBeGreaterThan(markerRow(before));
    machine.dispose?.();
  }, 60_000);

  it('kaleido runs its machine code and comes back for another picture', async () => {
    const machine = await play('kaleido.bas');
    for (const [prompt, answer] of [
      ['SEED (0-255)', '37'],
      ['TWIST (0-255)', '91'],
      ['PASSES (1-9)', '1'],
    ] as const) {
      expect(
        await runUntil(machine, () => text(machine).includes(prompt), 50 * 20),
        `should ask ${prompt}`,
      ).toBe(true);
      await typeLine(machine, answer);
    }
    // The routine prints its picture and BASIC loops back to the first prompt,
    // which is this machine's only way to wait: it cannot poll a key.
    const back = await runUntil(
      machine,
      () => screen(machine).at(-1)!.startsWith('SEED (0-255)'),
      50 * 20,
    );
    expect(back, 'should return to the SEED prompt').toBe(true);
    expect(machine.isProgramRunning()).toBe(true);

    // 32 columns by 16 rows, mirrored about both axes by the folded counters.
    const picture = screen(machine).filter((l) =>
      /^[ .:\-+*#@]{32}\s*$/.test(l),
    );
    expect(picture.length).toBeGreaterThanOrEqual(8);
    expect(
      picture.some((l) => l.trim() !== ''),
      'the routine must actually draw something',
    ).toBe(true);
    for (const row of picture) {
      const span = row.slice(0, 32);
      expect(span, `"${span}" must mirror left to right`).toBe(
        [...span].reverse().join(''),
      );
    }
    machine.dispose?.();
  }, 60_000);
});
