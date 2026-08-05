// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { altair8800Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { altair8800Keywords } from './keywords';
import { altair8800VariableErrors } from '../../editor/variableLint';
import { COLS } from './emulator/terminal';

/** BASIC's own default line width, which is narrower than the 80-column glass. */
const TERMINAL_WIDTH = 72;

const sample = (name: string) =>
  altair8800Samples.find((s) => s.name === name)!;

describe('altair8800 samples', () => {
  it('ships the canonical set in the canonical order', () => {
    expect(altair8800Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
    expect(altair8800Samples.map((s) => s.title)).toEqual([
      'Hello world',
      'Circles',
      'Breakout',
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

  it('drives the games from INPUT, the only key read this machine has', () => {
    // There is no INKEY$ in 8K BASIC. If one of these ever stops reading a
    // line, the on-screen keyboard can no longer play it at all.
    for (const name of ['breakout.bas', 'maze.bas']) {
      const code = sample(name)
        .text.split('\n')
        .filter((l) => !/^\d+ REM/.test(l))
        .join('\n');
      expect(code, name).toMatch(/\bINPUT\b/);
      expect(code, name).not.toMatch(/INKEY/);
    }
  });

  it('ships no machine-code block with the kaleidoscope', () => {
    // Deliberate, and the reason kaleido has no `.asm` alongside it: this
    // dialect has no USR block convention yet (see samples.ts).
    for (const s of altair8800Samples) expect(s.blocks, s.name).toBeUndefined();
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
    // Full E on the X half-steps integrates a sqrt(2):1 ellipse instead, and
    // fewer than 2*pi/E steps leaves each ring visibly open.
    expect(text).toContain('X=X-E/2*Y');
    expect(text).toContain('Y=Y+E*X');
    expect(text.match(/^\d+ X=X-E\/2\*Y$/gm)!.length).toBe(2);
    const e = Number(/E=1\/([0-9]+)/.exec(text)![1]);
    const steps = Number(/FOR A=1 TO ([0-9]+)/.exec(text)![1]);
    expect(steps).toBeGreaterThanOrEqual(2 * Math.PI * e);
  });
});
