// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { ge235 } from './index';
import { ge235Samples } from './samples';
import { ge235Keywords } from './keywords';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { ge235VariableErrors } from '../../editor/variableLint';
import { COLS } from './interpreter/terminal';
import { bootMachine, runUntil } from '../bootHarness';
import type { MachineEmulator } from '../types';

const sample = (name: string) => ge235Samples.find((s) => s.name === name)!;

describe('ge235 samples', () => {
  it('ships the canonical set in the canonical order', () => {
    // No `breakout.bas` and no `kaleido.bas`: see samples.ts, which is the
    // record of why this machine's set is two short.
    expect(ge235Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'maze.bas',
    ]);
    expect(ge235Samples.map((s) => s.title)).toEqual([
      'Hello world',
      'Circles',
      'Maze',
    ]);
  });

  it('ships no machine-code block, this machine having no machine code', () => {
    for (const s of ge235Samples) expect(s.blocks, s.name).toBeUndefined();
  });

  for (const s of ge235Samples) {
    it(`${s.name} punches and lists back unchanged`, () => {
      const { program, errors } = tokenizeProgram(s.text);
      expect(errors, s.name).toEqual([]);
      expect(program.length, s.name).toBeGreaterThan(0);
      // The tape is the program here, so a listing is a decode of what was
      // punched: a sample has to survive the round trip exactly.
      const listed = detokenizeProgram(program);
      expect(tokenizeProgram(listed).program, s.name).toEqual(program);
    });

    it(`${s.name} names no variable a keyword could swallow`, () => {
      // A name is one letter and at most one digit here, and the lexer matches
      // a keyword greedily wherever it appears - so `T` followed by `O` would
      // lex as TO rather than as two names.
      expect(ge235VariableErrors(s.text, ge235Keywords), s.name).toEqual([]);
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

  it('keeps every literal line of output inside the paper', () => {
    // The Model 33's line is 72 columns and there is no wrap on the machine -
    // a long literal would have run the carriage into the margin.
    for (const s of ge235Samples) {
      for (const literal of s.text.matchAll(/"([^"\n]*)"/g)) {
        expect(
          literal[1]!.length,
          `${s.name}: ${literal[1]}`,
        ).toBeLessThanOrEqual(COLS);
      }
    }
  });

  it('drives the maze from INPUT, the only key read this machine has', () => {
    // There is no INKEY here, and INPUT reads numbers, so the controls are
    // digits rather than the set's usual W A S D. If this ever stops reading a
    // line the on-screen keyboard can no longer play it at all.
    const code = sample('maze.bas')
      .text.split('\n')
      .filter((l) => !/^\d+ REM/.test(l))
      .join('\n');
    expect(code).toMatch(/\bINPUT D\b/);
    expect(literals('maze.bas')).toContain(
      'REACH E. 1 UP 2 DOWN 3 LEFT 4 RIGHT',
    );
  });

  it('circles keeps the Pitteway half-steps and closes each ring', () => {
    const text = sample('circles.bas').text;
    // Full E on the X half-steps integrates a sqrt(2):1 ellipse instead.
    expect(text).toContain('LET X=X-E/2*Y');
    expect(text).toContain('LET Y=Y+E*X');
    expect(text.match(/^\d+ LET X=X-E\/2\*Y$/gm)!.length).toBe(2);
    // One step turns by about E radians and E is 1/R, so the step count is in
    // units of R. A quarter turn is pi/2 of them; the arc runs past that so a
    // step lands within half a column of the top, which is what closes the ring
    // at its apex - mirroring alone leaves a hole there.
    expect(text).toContain('LET E=1/R');
    const steps = Number(/FOR A=1 TO ([0-9.]+)\*R/.exec(text)![1]);
    expect(steps).toBeGreaterThan(Math.PI / 2);
  });

  it('maze walks its DATA map from the start cell to the exit', () => {
    // The map is `DATA` numbers rather than text rows, there being no strings
    // in this dialect: 1 is wall, 2 the exit, 0 corridor. The program starts
    // the marker at (1,1), so a breadth-first walk from there must reach the 2.
    const rows = mazeRows();
    expect(rows.length).toBeGreaterThan(0);
    const width = rows[0]!.length;
    for (const row of rows) expect(row.length).toBe(width);
    // The run-time's data region is 256 words at two words a number, so 128
    // constants is the ceiling a table like this has to fit under.
    expect(rows.length * width).toBeLessThanOrEqual(128);
    expect(rows[1]![1], 'the start cell must be walkable').toBe(0);
    expect(
      solveMaze(rows).length,
      'the exit must be reachable',
    ).toBeGreaterThan(0);
    // The program's own bounds are the border walls: every edge cell is one, so
    // a move can never step off the map and fault on the subscript.
    for (const [y, row] of rows.entries()) {
      for (const [x, cell] of row.entries()) {
        if (y === 0 || x === 0 || y === rows.length - 1 || x === width - 1) {
          expect(cell, `edge cell ${y},${x}`).toBe(1);
        }
      }
    }
    expect(sample('maze.bas').text).toContain(
      `DIM M(${rows.length - 1},${width - 1})`,
    );
  });
});

/** Every double-quoted literal in a sample, joined - what the user reads. */
function literals(name: string): string {
  return [...sample(name).text.matchAll(/"([^"\n]*)"/g)]
    .map((m) => m[1]!)
    .join('\n');
}

/** The maze's `DATA` rows as numbers. */
function mazeRows(): number[][] {
  return sample('maze.bas')
    .text.split('\n')
    .filter((l) => /^\d+ DATA /.test(l))
    .map((l) =>
      l
        .replace(/^\d+ DATA /, '')
        .split(',')
        .map(Number),
    );
}

/** The shortest move sequence from (1,1) to the exit, in the program's digits. */
function solveMaze(rows: number[][]): string[] {
  const dirs: [string, number, number][] = [
    ['1', -1, 0],
    ['2', 1, 0],
    ['3', 0, -1],
    ['4', 0, 1],
  ];
  const from = new Map<string, [string, string] | null>([['1,1', null]]);
  const queue: [number, number][] = [[1, 1]];
  while (queue.length) {
    const [y, x] = queue.shift()!;
    if (rows[y]![x] === 2) {
      const moves: string[] = [];
      for (let at = `${y},${x}`; from.get(at); ) {
        const [prev, move] = from.get(at)!;
        moves.unshift(move);
        at = prev;
      }
      return moves;
    }
    for (const [move, dy, dx] of dirs) {
      const ny = y + dy;
      const nx = x + dx;
      if (rows[ny]?.[nx] === undefined || rows[ny]![nx] === 1) continue;
      if (from.has(`${ny},${nx}`)) continue;
      from.set(`${ny},${nx}`, [`${y},${x}`, move]);
      queue.push([ny, nx]);
    }
  }
  return [];
}

/**
 * Every sample run on the interpreter, because nothing above proves one works.
 * Two of the faults this suite was written after punched and listed clean: a
 * circle whose top and bottom were open, because the arc stopped a fraction of
 * a step short of the apex, and a cascade whose first line was indented,
 * because a `FOR` with a zero-trip limit still runs its body once here.
 *
 * The frame counts are the interpreter's own rather than wall clock, so they
 * are the same on every runner. Divide by 50 for seconds of paper time.
 */
describe('what each sample actually does', () => {
  /** Boot, punch the tape in and start it. */
  async function play(name: string): Promise<MachineEmulator> {
    const machine = await bootMachine(ge235);
    const { image, errors } = ge235.tokenize(sample(name).text);
    expect(errors, name).toEqual([]);
    machine.loadProgram(image);
    return machine;
  }

  const screen = (m: MachineEmulator) => m.readScreenText()!.lines;
  const paper = (m: MachineEmulator) =>
    screen(m)
      .map((l) => l.replace(/\s+$/, ''))
      .join('\n');

  /**
   * The frames a whole run may take. Generous, because what these tests pin is
   * the picture rather than the pace: the interpreter's own budget is ten
   * statements a frame, and the maze spends most of a repaint on 117 cells.
   */
  const RUN_FRAMES = 50 * 30;

  /** The marker's [row, column] in the last map the maze printed. */
  function marker(m: MachineEmulator): [number, number] {
    const rows = screen(m)
      .map((l) => l.slice(0, 13))
      .filter((l) => /^[* OE]{13}$/.test(l) && l.includes('*'))
      .slice(-9);
    for (const [y, row] of rows.entries()) {
      const x = row.indexOf('O');
      if (x >= 0) return [y, x];
    }
    return [-1, -1];
  }

  it('hello cascades the greeting and signs off on the banner', async () => {
    const machine = await play('hello.bas');
    const stopped = await runUntil(
      machine,
      () => machine.isProgramRunning() === false,
      RUN_FRAMES,
    );
    expect(stopped, 'hello should finish inside the budget').toBe(true);
    expect(machine.readReport!()!.isError).toBe(false);

    // Read off the paper, not the listing: a line the printer never reached
    // passes every static check and fails the user.
    const lines = screen(machine).filter((l) => l.trim() !== '');
    const greetings = lines.filter((l) => l.includes('HELLO FROM THE GE-235'));
    expect(greetings.length, 'the cascade').toBe(6);
    const indents = greetings.map((l) => l.search(/\S/));
    for (let i = 1; i < indents.length; i++) {
      expect(indents[i]!, 'each line steps right').toBeGreaterThan(
        indents[i - 1]!,
      );
    }
    const banner = lines.find((l) => l.includes('* BASICALLY *'))!;
    expect(banner, 'the banner').toBeDefined();
    // Centred on the Model 33's 72-column line, within half a keycap.
    const start = banner.search(/\S/);
    const centre = (COLS - '* BASICALLY *'.length) / 2;
    expect(Math.abs(start - centre)).toBeLessThanOrEqual(1);
    machine.dispose?.();
  }, 30_000);

  it('circles draws three closed rings, mirrored and round', async () => {
    const machine = await play('circles.bas');
    let frames = 0;
    await runUntil(
      machine,
      () => machine.isProgramRunning() === false,
      RUN_FRAMES,
      (f) => {
        frames = f;
      },
    );
    expect(machine.readReport!()!.isError).toBe(false);
    // The whole picture arrives at once - a paper roll cannot fill a row in
    // afterwards - so the plotting is time the user spends watching nothing.
    expect(frames, 'frames to the whole picture').toBeLessThan(600);

    const lines = screen(machine);
    const start = lines.findIndex((l) => l.trimEnd() === 'CIRCLES') + 1;
    expect(start).toBeGreaterThan(0);
    const picture = lines.slice(start, start + 15);

    // The grid is 31 columns wide, printed from column 0, and every ring is
    // mirrored about both axes because only a quarter turn was integrated.
    for (const [i, row] of picture.entries()) {
      const span = row.slice(0, 31);
      expect(span, `picture row ${i} must mirror left to right`).toBe(
        [...span].reverse().join(''),
      );
    }
    for (let i = 0; i < 7; i++) {
      expect(picture[i]!.trimEnd(), `row ${i} mirrors row ${14 - i}`).toBe(
        picture[14 - i]!.trimEnd(),
      );
    }

    // Three rings: the middle row cuts every one of them twice.
    expect(
      picture[7]!.trim().split(/\s+/).length,
      'runs across the middle',
    ).toBe(6);
    // Closed at the apex too, which is the half-step the arc runs on for.
    for (const row of [picture[0]!, picture[14]!]) {
      expect(row.trim().split(/\s+/).length, `runs in "${row.trim()}"`).toBe(1);
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
  }, 30_000);

  it('maze prints the map, walks it and escapes', async () => {
    const machine = await play('maze.bas');
    const prompted = await runUntil(
      machine,
      () => paper(machine).includes('REACH E'),
      RUN_FRAMES,
    );
    expect(prompted, 'the maze should ask for a move').toBe(true);

    const map = screen(machine).filter(
      (l) => /^[* OE]{13}/.test(l.slice(0, 13)) && l.includes('*'),
    );
    expect(map.length).toBe(9);
    expect(
      map.some((l) => l.includes('O')),
      'the marker',
    ).toBe(true);
    expect(
      map.some((l) => l.includes('E')),
      'the exit',
    ).toBe(true);
    expect(marker(machine)).toEqual([1, 1]);

    // A move steps the marker and reprints the whole map, which is the
    // smallest repaint a machine with no cursor addressing has.
    const moves = solveMaze(mazeRows());
    const step: Record<string, [number, number]> = {
      '1': [-1, 0],
      '2': [1, 0],
      '3': [0, -1],
      '4': [0, 1],
    };
    let at: [number, number] = [1, 1];
    for (const move of moves) {
      const want: [number, number] = [
        at[0] + step[move]![0],
        at[1] + step[move]![1],
      ];
      for (const token of [`Digit${move}`, 'Enter']) {
        machine.setKey(token, true);
        machine.setKey(token, false);
      }
      const moved = await runUntil(
        machine,
        () => {
          const now = marker(machine);
          return (
            (now[0] === want[0] && now[1] === want[1]) ||
            paper(machine).includes('YOU ESCAPED')
          );
        },
        RUN_FRAMES,
      );
      expect(moved, `move ${move} from ${at.join(',')}`).toBe(true);
      at = want;
    }

    const finished = await runUntil(
      machine,
      () => machine.isProgramRunning() === false,
      RUN_FRAMES,
    );
    expect(finished, 'the program should stop once out').toBe(true);
    expect(paper(machine)).toContain('YOU ESCAPED.');
    machine.dispose?.();
  }, 60_000);
});
