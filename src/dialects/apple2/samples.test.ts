// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APPLE2_KALEIDO_BLOCK, apple2Samples } from './samples';
import { apple2 } from './index';
import { apple2Keywords } from './keywords';
import { apple2KeyboardLayout } from './keyboardLayout';
import { apple2MemoryBlocks } from './memoryBlocks';
import { COLD_START_BYTES_FREE, INVFLG, TEXT_PAGE1 } from './addresses';
import { screenGlyph, videoMode } from './charset';
import { worstAngularGap } from '../ringGap';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import { textRowAddress } from '../../emulator/apple2/display';
import {
  bootMachine,
  hasRom,
  installNodeRomLoading,
  runFrames,
  runUntil,
  screenText,
} from '../bootHarness';
import type { MachineEmulator } from '../types';

const sample = (name: string) => apple2Samples.find((s) => s.name === name)!;

/** The machine's RAM. `MachineEmulator` does not name it; this machine has it. */
const ram = (m: MachineEmulator): Uint8Array =>
  (m as unknown as { mem: { mem: Uint8Array } }).mem.mem;

/**
 * The lo-res page as 40 rows of 40 colour numbers.
 *
 * One byte holds two rows - the even one in its low nibble - and the twenty
 * text rows behind them are interleaved, which is why this goes through
 * `textRowAddress` rather than multiplying by 40.
 */
function loresGrid(m: MachineEmulator): number[][] {
  const mem = ram(m);
  return Array.from({ length: 40 }, (_, row) => {
    const addr = textRowAddress(TEXT_PAGE1, row >> 1);
    return Array.from({ length: 40 }, (_, col) => {
      const byte = mem[addr + col]!;
      return (row & 1 ? byte >> 4 : byte) & 0x0f;
    });
  });
}

/**
 * The video mode of a text row, taken from its first character that is not a
 * space. A space carries a mode too, but a blank cell left by the screen clear
 * is normal video whatever the program last asked for.
 */
function rowMode(m: MachineEmulator, row: number): string | null {
  const start = textRowAddress(TEXT_PAGE1, row);
  const cell = [...ram(m).subarray(start, start + 40)].find(
    (b) => screenGlyph(b) !== ' ',
  );
  return cell === undefined ? null : videoMode(cell);
}

/** The twenty cascade rows' video modes, top to bottom. */
function greetingModes(m: MachineEmulator): (string | null)[] {
  return Array.from({ length: 20 }, (_, r) => rowMode(m, r));
}

/** The banner's thirteen cells, as video modes. `VTAB 23` is row 22. */
function bannerModes(m: MachineEmulator): string[] {
  const start = textRowAddress(TEXT_PAGE1, 22) + 13;
  return [...ram(m).subarray(start, start + 13)].map(videoMode);
}

describe('apple2 sample programs', () => {
  it('ships the canonical set, in order, breakout included', () => {
    // `breakout` is the one the Apple I cannot have: there any keypress stops
    // the program, and here a key only sets a flag (pinned on the ROM below).
    expect(apple2Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('offers hello as the starter for a fresh document', () => {
    expect(apple2.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes and lints every sample clean', () => {
    for (const s of apple2Samples) {
      const { errors } = apple2.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(apple2.lint(s.text), s.name).toEqual([]);
    }
  });

  it('leaves every sample room for its own variables', () => {
    // Program text and variables share one region and grow towards each other,
    // so a program that merely fits answers *** MEM FULL ERR the moment it
    // DIMs anything.
    for (const s of apple2Samples) {
      const { byteSize } = apple2.tokenize(s.text);
      expect(
        byteSize,
        `${s.name} is ${byteSize} of the ${COLD_START_BYTES_FREE} bytes`,
      ).toBeLessThan(COLD_START_BYTES_FREE - 4096);
    }
  });

  it('never assigns to a name that is a keyword', () => {
    // Assignments only - the name at the head of a statement. A name that
    // spells a keyword crunches to the keyword's token and the line mis-runs.
    const words = new Set(apple2Keywords.map((k) => k.word));
    const assignment = /(?:^\d+ |:)\s*(?:LET )?([A-Z][A-Z0-9]*)\s*=/gm;
    for (const s of apple2Samples) {
      for (const [, name] of s.text.matchAll(assignment)) {
        expect(words.has(name!), `${s.name}: ${name}`).toBe(false);
      }
    }
  });

  it('reads the keys the on-screen pad presses, through the latch', () => {
    // The pad sends the layout's own bindings, so a game reading any other
    // arrangement answers its arrows with the wrong move. PEEK(-16384) is the
    // latch and POKE -16368,0 the strobe clear - the pair that makes a
    // non-blocking read possible at all.
    const { bindings } = apple2KeyboardLayout.controller!;
    const letter = (id: string) => id.replace('Key', '');
    for (const name of ['breakout.bas', 'maze.bas']) {
      const text = sample(name).text;
      expect(text, name).toContain('PEEK(-16384)');
      expect(text, name).toContain('POKE -16368,0');
      for (const role of ['left', 'right'] as const) {
        expect(text, `${name}: no test for ${role}`).toContain(
          `ASC("${letter(bindings[role]!)}")`,
        );
      }
    }
    for (const role of ['up', 'down'] as const) {
      expect(sample('maze.bas').text).toContain(
        `ASC("${letter(bindings[role]!)}")`,
      );
    }
  });
});

/** The map rows, as the lines the program prints them from. */
function mazeRows(): string[] {
  return [...sample('maze.bas').text.matchAll(/^\d+ PRINT "(.*)"$/gm)]
    .map((m) => m[1]!)
    .filter((row) => row.length === 39 && /^[#E ]+$/.test(row));
}

describe('the maze is a maze', () => {
  const rows = mazeRows();

  it('is a rectangle of walls and corridors with one exit', () => {
    expect(rows).toHaveLength(21);
    for (const row of rows) expect(row).toHaveLength(39);
    expect(rows.join('').split('E')).toHaveLength(2);
  });

  it('starts the marker on a walkable cell', () => {
    // The program starts at X=2, Y=2, which is 1-based row 2, column 2.
    expect(sample('maze.bas').text).toMatch(/^\d+ X=2$/m);
    expect(sample('maze.bas').text).toMatch(/^\d+ Y=2$/m);
    expect(rows[1]![1]).toBe(' ');
  });

  it('has a path from the start to the exit', () => {
    // The check that matters: an unsolvable map tokenizes, runs and draws
    // perfectly well, and is simply not a game.
    expect(mazePath(rows)).not.toBeNull();
  });

  it('is walled all the way round, which is what keeps a move in range', () => {
    // The program does no bounds check: the border is what stops the marker
    // walking off the map and PEEKing somewhere that is not the map.
    expect(rows[0]).toBe('#'.repeat(39));
    expect(rows[20]).toBe('#'.repeat(39));
    for (const row of rows.slice(1, 20)) {
      expect(row[0]).toBe('#');
      expect(row[38] === '#' || row[38] === 'E').toBe(true);
    }
  });
});

/** The W/A/S/D moves that walk the map from the start cell to the exit. */
function mazePath(rows: string[]): string[] | null {
  const key = (r: number, c: number) => `${r},${c}`;
  const from = new Map<string, [string, number, number]>();
  const queue: [number, number][] = [[1, 1]];
  const seen = new Set([key(1, 1)]);
  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    if (rows[r]![c] === 'E') {
      const moves: string[] = [];
      for (let at = key(r, c); from.has(at); ) {
        const [move, pr, pc] = from.get(at)!;
        moves.unshift(move);
        at = key(pr, pc);
      }
      return moves;
    }
    for (const [move, dr, dc] of [
      ['S', 1, 0],
      ['W', -1, 0],
      ['D', 0, 1],
      ['A', 0, -1],
    ] as const) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows.length || nc < 0 || nc >= 39) continue;
      if (rows[nr]![nc] === '#' || seen.has(key(nr, nc))) continue;
      seen.add(key(nr, nc));
      from.set(key(nr, nc), [move, r, c]);
      queue.push([nr, nc]);
    }
  }
  return null;
}

describe('the kaleidoscope block', () => {
  const blocks = materializeSampleBlocks(apple2, sample('kaleido.bas'));

  it('assembles clean and lands in a valid range', () => {
    expect(blocks).toHaveLength(1);
    const { address, bytes } = blocks[0]!;
    expect(bytes.length).toBeGreaterThan(0);
    const end = address + bytes.length - 1;
    expect(
      apple2MemoryBlocks.validRanges.some(
        (r) => address >= r.start && end <= r.end,
      ),
      `0x${address.toString(16)}-0x${end.toString(16)} is outside the block window`,
    ).toBe(true);
    // And clear of the monitor's vectors at the top of the page, which the
    // block window only warns about.
    expect(end).toBeLessThan(0x03f8);
  });

  it('puts the entry point past the three parameter bytes', () => {
    expect(APPLE2_KALEIDO_BLOCK.entry).toBe(APPLE2_KALEIDO_BLOCK.address + 3);
    // The BASIC front end has to agree, in the machine's own decimal.
    expect(sample('kaleido.bas').text).toContain(
      `CALL ${APPLE2_KALEIDO_BLOCK.entry}`,
    );
  });

  it('stays clear of the workspace BASIC will fill', () => {
    const { address, bytes } = blocks[0]!;
    const program = apple2MemoryBlocks.programArea(0);
    expect(address + bytes.length - 1).toBeLessThan(program.start);
  });
});

/**
 * Every sample run on the shipped firmware, because nothing above proves one
 * works: a statement the ROM refuses, a picture that never closes and a game
 * wired to the wrong keys all tokenize and lint clean.
 */
const describeOnRom = hasRom(apple2) ? describe : describe.skip;

describeOnRom('what each sample actually does', () => {
  let restoreRomLoading: () => void;
  beforeAll(() => {
    restoreRomLoading = installNodeRomLoading();
  });
  afterAll(() => restoreRomLoading());

  /** Boot and start `name`, leaving it running. */
  async function play(name: string): Promise<MachineEmulator> {
    const s = sample(name);
    const machine = await bootMachine(apple2);
    machine.loadProgram(apple2.tokenize(s.text).image, {
      blocks: materializeSampleBlocks(apple2, s),
    });
    await runUntil(machine, () => machine.isProgramRunning() === true, 600);
    return machine;
  }

  /** Run until the program stops, or `frames` are spent. */
  async function finish(machine: MachineEmulator, frames: number) {
    await runUntil(machine, () => machine.isProgramRunning() === false, frames);
  }

  /** Type one key the way the on-screen keyboard sends it. */
  async function tap(machine: MachineEmulator, token: string): Promise<void> {
    machine.setKey(token, true);
    await runFrames(machine, 2);
    machine.setKey(token, false);
    await runFrames(machine, 5);
  }

  /** The `*** ... ERR` report Integer BASIC leaves on screen, if any. */
  function report(machine: MachineEmulator): string | undefined {
    return screenText(machine)
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^\*\*\* .*ERR/.test(l));
  }

  it('hello cascades in alternating video, then signs off in inverse', async () => {
    const machine = await play('hello.bas');
    try {
      await finish(machine, 1200);
      expect(machine.isProgramRunning()).toBe(false);
      expect(report(machine)).toBeUndefined();
      const screen = screenText(machine);
      const lines = screen
        .split('\n')
        .filter((l) => l.includes('HELLO FROM THE APPLE II'));
      // All twenty, undamaged. A banner printed without its trailing `;`
      // drops the cursor past the last line, and the scroll that follows
      // costs the top of the cascade and mangles a row on the way.
      expect(lines.length).toBe(20);
      // The staircase is the point: a static splash would print every copy at
      // the same indent.
      const indents = new Set(lines.map((l) => l.indexOf('H')));
      expect(indents.size).toBeGreaterThan(4);
      expect(screen).toContain('* BASICALLY *');

      // The cascade *is* this machine's display: with no colour on the text
      // page, alternating video is what makes it more than a splash. Row I-1
      // carries odd I inverse, even I normal - all-normal here would mean the
      // POKEs never reached INVFLG.
      expect(greetingModes(machine)).toEqual(
        Array.from({ length: 20 }, (_, r) =>
          r % 2 === 0 ? 'inverse' : 'normal',
        ),
      );
      // Only two modes, and this is why: COUT masks with an AND, which cannot
      // raise a bit, so 127 flashes the letters but leaves space, punctuation
      // and digits inverse. Uniform flashing needs Applesoft's flash bit.
      expect(bannerModes(machine)).toEqual(Array(13).fill('inverse'));
      // Normal video handed back, or the prompt is drawn in the last mode set.
      expect(ram(machine)[INVFLG], 'INVFLG left non-normal').toBe(0xff);
    } finally {
      machine.dispose();
    }
  });

  it('circles draws three closed, round rings', async () => {
    const machine = await play('circles.bas');
    try {
      await finish(machine, 2000);
      expect(machine.isProgramRunning()).toBe(false);
      expect(report(machine)).toBeUndefined();
      const grid = loresGrid(machine);
      const inked = grid
        .map((row, y) => ({ y, cols: row.flatMap((c, x) => (c ? [x] : [])) }))
        .filter((r) => r.cols.length > 0);
      // Three rings, three colours, nothing else on the page.
      expect(new Set(grid.flat().filter(Boolean)).size).toBe(3);
      // Every inked row is part of a ring, so the ink's bounding box is the
      // outer ring's. A lo-res cell is 7 dots wide and 4 tall, which is the
      // whole reason the program scales its columns differently.
      const first = Math.min(...inked.map((r) => r.cols[0]!));
      const last = Math.max(...inked.map((r) => r.cols.at(-1)!));
      const width = (last - first + 1) * 7;
      const height = inked.length * 4;
      expect(width / height).toBeGreaterThan(0.9);
      expect(width / height).toBeLessThan(1.1);
      // A row through the centre crosses three concentric rings six times.
      const middle = inked[Math.floor(inked.length / 2)]!;
      const runs = middle.cols.filter(
        (x, i) => i === 0 || x !== middle.cols[i - 1]! + 1,
      );
      expect(runs).toHaveLength(6);
      // Closed rings, which is what the integrator's step count buys: an arc a
      // few steps short of a turn leaves the top and bottom of each ring as a
      // pair of cells rather than a solid run.
      expect(inked[0]!.cols.length).toBeGreaterThan(3);
      expect(inked.at(-1)!.cols.length).toBeGreaterThan(3);
      // And every ring in full, not just the outer one the bounding box sees.
      // Each is an ellipse in cell space - 6*K rows against 6*K*4/7 columns,
      // which is the same circle once the 7-by-4 cell is accounted for.
      for (const k of [1, 2, 3]) {
        const colour = k * 3 + 3;
        const gap = worstAngularGap(
          (x, y) => grid[y]?.[x] === colour,
          { x: 20, y: 20 },
          { x: (6 * k * 4) / 7, y: 6 * k },
          1.5,
        );
        expect(gap, `ring ${k} is broken over ${gap} degrees`).toBeLessThan(6);
      }
    } finally {
      machine.dispose();
    }
  });

  /** The lo-res columns the paddle covers, and where the ball is. */
  function paddleSpan(grid: number[][]): number[] {
    return grid[38]!.flatMap((c, x) => (c === 15 ? [x] : []));
  }
  function ballAt(grid: number[][]): { x: number; y: number } | null {
    for (let y = 39; y >= 0; y--) {
      const x = grid[y]!.indexOf(13);
      if (x >= 0) return { x, y };
    }
    return null;
  }

  it('breakout serves, knocks bricks out and ends when the ball is lost', async () => {
    const machine = await play('breakout.bas');
    try {
      await runFrames(machine, 60);
      expect(screenText(machine)).toContain('SPACE TO SERVE');
      await tap(machine, 'Space');
      // Left alone the ball goes up, takes a brick and falls past the paddle.
      await finish(machine, 1200);
      expect(machine.isProgramRunning()).toBe(false);
      expect(report(machine)).toBeUndefined();
      const screen = screenText(machine);
      expect(screen).toContain('GAME OVER');
      const score = /SCORE (\d+)/.exec(screen);
      expect(score, 'no scoreboard on screen').not.toBeNull();
      expect(Number(score![1])).toBeGreaterThan(0);
      // Three rows of bricks left where four were laid, at least.
      const grid = loresGrid(machine);
      expect(grid[0]!.filter(Boolean).length).toBeGreaterThan(30);
    } finally {
      machine.dispose();
    }
  });

  it('breakout follows the paddle keys the pad binds, and returns the ball', async () => {
    // The check the static one cannot make: A and D have to move the paddle the
    // way the pad points, and the ball has to come off it.
    const { bindings } = apple2KeyboardLayout.controller!;
    const machine = await play('breakout.bas');
    /** Press a key without waiting: the latch takes one character a field. */
    const press = (token: string) => {
      machine.setKey(token, true);
      machine.setKey(token, false);
    };
    try {
      await runFrames(machine, 60);
      await tap(machine, 'Space');
      await runFrames(machine, 30);

      const start = paddleSpan(loresGrid(machine))[0]!;
      for (let i = 0; i < 3; i++) await tap(machine, bindings.left!);
      const left = paddleSpan(loresGrid(machine))[0]!;
      expect(left, 'the left key did not move the paddle left').toBeLessThan(
        start,
      );
      for (let i = 0; i < 6; i++) await tap(machine, bindings.right!);
      expect(
        paddleSpan(loresGrid(machine))[0]!,
        'the right key did not move the paddle right',
      ).toBeGreaterThan(left);

      // Then played: steered under the ball for four times as long as the
      // unattended game lasted, which no ball survives without a bounce.
      for (let step = 0; step < 250; step++) {
        if (!machine.isProgramRunning()) break;
        await runFrames(machine, 4);
        const grid = loresGrid(machine);
        const ball = ballAt(grid);
        const paddle = paddleSpan(grid);
        if (!ball || paddle.length === 0) continue;
        const centre = paddle[0]! + (paddle.length >> 1);
        if (ball.x < centre - 1) press(bindings.left!);
        else if (ball.x > centre + 1) press(bindings.right!);
      }
      expect(report(machine)).toBeUndefined();
      expect(
        machine.isProgramRunning(),
        'the ball was never returned by the paddle',
      ).toBe(true);
      const score = /SCORE (\d+)/.exec(screenText(machine));
      expect(Number(score![1])).toBeGreaterThan(2);
    } finally {
      machine.dispose();
    }
  });

  it('maze moves the marker two cells at a time and walks out to the exit', async () => {
    const rows = mazeRows();
    const machine = await play('maze.bas');
    try {
      await runFrames(machine, 120);
      const screen = screenText(machine).split('\n');
      expect(screen[22]).toContain('REACH E - W A S D TO MOVE');
      expect(screen[1]![1]).toBe('O');

      // One move repaints exactly two cells: the corridor left behind and the
      // marker's new home. The whole point of having a cursor to address.
      const before = ram(machine).slice(TEXT_PAGE1, TEXT_PAGE1 + 0x0400);
      const path = mazePath(rows)!;
      await tap(machine, `Key${path[0]!}`);
      await runFrames(machine, 20);
      const after = ram(machine).slice(TEXT_PAGE1, TEXT_PAGE1 + 0x0400);
      const changed = [...before].filter((b, i) => b !== after[i]).length;
      expect(changed, 'a move should repaint two cells').toBe(2);

      // A wall costs nothing: the marker stays where it is.
      const wall = path[0] === 'D' ? 'KeyW' : 'KeyD';
      await tap(machine, wall);
      await runFrames(machine, 20);
      expect([...ram(machine).slice(TEXT_PAGE1, TEXT_PAGE1 + 0x0400)]).toEqual([
        ...after,
      ]);

      for (const move of path.slice(1)) await tap(machine, `Key${move}`);
      await finish(machine, 600);
      expect(machine.isProgramRunning()).toBe(false);
      expect(report(machine)).toBeUndefined();
      expect(screenText(machine).split('\n')[22]).toContain('YOU ESCAPED!');
    } finally {
      machine.dispose();
    }
  });

  it('kaleido asks its three questions, runs its routine and mirrors four ways', async () => {
    const machine = await play('kaleido.bas');
    try {
      // The prompts are read off the screen one at a time: they are printed in
      // text mode and GR wipes the page they were printed on, so a run read
      // only at the end would find none of them.
      for (const [prompt, answer] of [
        ['SEED (0-255)?', ['Digit7', 'Enter']],
        ['TWIST (0-255)?', ['Digit3', 'Enter']],
        ['PASSES (1-9)?', ['Digit2', 'Enter']],
      ] as const) {
        await runFrames(machine, 40);
        expect(screenText(machine)).toContain(prompt);
        for (const token of answer) await tap(machine, token);
      }
      await runFrames(machine, 400);
      expect(report(machine)).toBeUndefined();

      const grid = loresGrid(machine);
      // A routine that never ran would leave the page as GR cleared it.
      expect(new Set(grid.flat()).size).toBeGreaterThan(4);
      // Folded coordinates, so the picture is symmetric both ways by
      // construction.
      for (const [y, row] of grid.entries()) {
        expect(row, `row ${y} is not mirrored left to right`).toEqual(
          [...row].reverse(),
        );
        expect(row, `row ${y} does not mirror row ${39 - y}`).toEqual(
          grid[39 - y],
        );
      }
      // It asks again rather than ending: the wait is a key poll, so a press
      // takes it back to the top.
      expect(machine.isProgramRunning()).toBe(true);
      await tap(machine, 'Space');
      await runFrames(machine, 60);
      expect(screenText(machine)).toContain('SEED (0-255)?');
    } finally {
      machine.dispose();
    }
  });

  it('keeps running while a key is pressed, which is why there is a breakout', async () => {
    // The fact the sample set is shaped around, and the one difference from the
    // Apple I that matters most: a key sets a flag and nothing else, so the
    // program is still going after one.
    const machine = await bootMachine(apple2);
    try {
      machine.loadProgram(
        apple2.tokenize('10 FOR I=1 TO 3000\n20 NEXT I\n30 END\n').image,
      );
      await runUntil(machine, () => machine.isProgramRunning() === true, 600);
      await runFrames(machine, 20);
      await tap(machine, 'KeyA');
      expect(screenText(machine)).not.toContain('STOPPED AT');
      expect(machine.isProgramRunning()).toBe(true);
    } finally {
      machine.dispose();
    }
  });
});
