// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { apple1Samples, APPLE1_KALEIDO_BLOCK } from './samples';
import { apple1 } from './index';
import { apple1Keywords } from './keywords';
import { apple1MemoryBlocks } from './memoryBlocks';
import { COLD_START_BYTES_FREE } from './addresses';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import {
  bootMachine,
  hasRom,
  installNodeRomLoading,
  runFrames,
  runUntil,
  screenText,
} from '../bootHarness';
import type { MachineEmulator } from '../types';

const sample = (name: string) => apple1Samples.find((s) => s.name === name)!;

describe('apple1 sample programs', () => {
  it('ships the canonical set, in order, without breakout', () => {
    // No `breakout`, and the reason is two machine facts rather than a gap in
    // the port: any keypress stops a running Integer BASIC program (pinned
    // below), so nothing can poll a paddle key, and the display decodes only
    // carriage return, so a ball could not be redrawn in place either.
    expect(apple1Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('offers hello as the starter for a fresh document', () => {
    expect(apple1.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes and lints every sample clean', () => {
    for (const s of apple1Samples) {
      const { errors } = apple1.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(apple1.lint(s.text), s.name).toEqual([]);
    }
  });

  it('leaves every sample room for its own variables', () => {
    // Program text and variables share one 2048-byte region and grow towards
    // each other, so a program that merely fits answers *** MEM FULL ERR the
    // moment it DIMs anything. `maze` is the tight one: its map is a 171-byte
    // string.
    for (const s of apple1Samples) {
      const { byteSize } = apple1.tokenize(s.text);
      expect(
        byteSize,
        `${s.name} is ${byteSize} of the ${COLD_START_BYTES_FREE} bytes`,
      ).toBeLessThan(COLD_START_BYTES_FREE - 512);
    }
  });

  it('never assigns to a name that is a keyword', () => {
    // Assignments only - the name at the head of a statement. A name that
    // spells a keyword crunches to the keyword's token and the line mis-runs.
    const words = new Set(apple1Keywords.map((k) => k.word));
    const assignment = /(?:^\d+ |:)\s*(?:LET )?([A-Z][A-Z0-9]*)\s*=/gm;
    for (const s of apple1Samples) {
      for (const [, name] of s.text.matchAll(assignment)) {
        expect(words.has(name!), `${s.name}: ${name}`).toBe(false);
      }
    }
  });

  it('drives the maze from INPUT, the only key read a program has', () => {
    // W A S D like the machines that can poll, but a letter and a RETURN at a
    // time, which is the whole of this machine's input model.
    const text = sample('maze.bas').text;
    expect(text).toContain('INPUT "W,A,S OR D",K$');
    for (const key of ['W', 'A', 'S', 'D']) {
      expect(text, `no test for ${key}`).toContain(`IF K$="${key}" THEN `);
    }
  });
});

/** The maze map, as the rows the program assembles its map string from. */
function mazeRows(): string[] {
  return [...sample('maze.bas').text.matchAll(/^\d+ M\$(?:\(\d+\))?="(.*)"$/gm)]
    .map((m) => m[1]!)
    .filter((row) => row.length > 1);
}

describe('the maze is a maze', () => {
  const rows = mazeRows();

  it('is a rectangle of walls and corridors with one exit', () => {
    expect(rows).toHaveLength(9);
    for (const row of rows) expect(row).toHaveLength(19);
    expect(rows.join('').split('E')).toHaveLength(2);
  });

  it('starts the marker on a walkable cell', () => {
    // The program starts at X=2, Y=2, which is 1-based row 2, column 2.
    expect(rows[1]![1]).toBe(' ');
  });

  it('has a path from the start to the exit', () => {
    // The check that matters: an unsolvable map tokenizes, runs and draws
    // perfectly well, and is simply not a game.
    const seen = new Set(['1,1']);
    const queue: [number, number][] = [[1, 1]];
    let escaped = false;
    while (queue.length > 0) {
      const [r, c] = queue.shift()!;
      if (rows[r]![c] === 'E') {
        escaped = true;
        break;
      }
      for (const [dr, dc] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const nr = r + dr;
        const nc = c + dc;
        const key = `${nr},${nc}`;
        if (nr < 0 || nr >= rows.length || nc < 0 || nc >= 19) continue;
        if (rows[nr]![nc] === '#' || seen.has(key)) continue;
        seen.add(key);
        queue.push([nr, nc]);
      }
    }
    expect(escaped).toBe(true);
  });
});

describe('the kaleidoscope block', () => {
  const blocks = materializeSampleBlocks(apple1, sample('kaleido.bas'));

  it('assembles clean and lands in a valid range', () => {
    expect(blocks).toHaveLength(1);
    const { address, bytes } = blocks[0]!;
    expect(bytes.length).toBeGreaterThan(0);
    const end = address + bytes.length - 1;
    expect(
      apple1MemoryBlocks.validRanges.some(
        (r) => address >= r.start && end <= r.end,
      ),
      `0x${address.toString(16)}-0x${end.toString(16)} is outside the block window`,
    ).toBe(true);
  });

  it('puts the entry point past the three parameter bytes', () => {
    expect(APPLE1_KALEIDO_BLOCK.entry).toBe(APPLE1_KALEIDO_BLOCK.address + 3);
    // The BASIC front end has to agree, in the machine's own decimal.
    expect(sample('kaleido.bas').text).toContain(
      `CALL ${APPLE1_KALEIDO_BLOCK.entry}`,
    );
  });

  it('stays clear of the workspace BASIC will fill', () => {
    const { address, bytes } = blocks[0]!;
    const program = apple1MemoryBlocks.programArea(0);
    expect(address + bytes.length - 1).toBeLessThan(program.start);
  });
});

/**
 * Every sample run on the shipped firmware, because nothing above proves one
 * works: a statement the ROM refuses, a picture that never closes and a game
 * wired to the wrong keys all tokenize and lint clean.
 */
const describeOnRom = hasRom(apple1) ? describe : describe.skip;

describeOnRom('what each sample actually does', () => {
  let restoreRomLoading: () => void;
  beforeAll(() => {
    restoreRomLoading = installNodeRomLoading();
  });
  afterAll(() => restoreRomLoading());

  /** Boot, load `name`, and run until it stops or `frames` are spent. */
  async function play(
    name: string,
    frames: number,
    drive?: (m: MachineEmulator) => Promise<void>,
  ): Promise<MachineEmulator> {
    const s = sample(name);
    const machine = await bootMachine(apple1);
    machine.loadProgram(apple1.tokenize(s.text).image, {
      blocks: materializeSampleBlocks(apple1, s),
    });
    await runUntil(machine, () => machine.isProgramRunning(), 600);
    if (drive) await drive(machine);
    let spent = 0;
    while (spent < frames && machine.isProgramRunning()) {
      await runFrames(machine, 20);
      spent += 20;
    }
    return machine;
  }

  /** Type one key the way the on-screen keyboard sends it. */
  async function tap(machine: MachineEmulator, token: string): Promise<void> {
    machine.setKey(token, true);
    await runFrames(machine, 3);
    machine.setKey(token, false);
    await runFrames(machine, 8);
  }

  /**
   * The `*** ... ERR` report Integer BASIC leaves on screen, if any. Matched on
   * the whole shape rather than the leading stars, because `circles` prints a
   * row of them.
   */
  function report(machine: MachineEmulator): string | undefined {
    return screenText(machine)
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^\*\*\* .*ERR/.test(l));
  }

  it('hello steps the greeting down the screen and signs off', async () => {
    const machine = await play('hello.bas', 3000);
    try {
      expect(report(machine)).toBeUndefined();
      const screen = screenText(machine);
      const lines = screen
        .split('\n')
        .filter((l) => l.includes('HELLO FROM THE APPLE 1'));
      expect(lines.length).toBeGreaterThan(8);
      // The staircase is the point: a static splash would print every copy at
      // the same indent.
      const indents = new Set(lines.map((l) => l.indexOf('H')));
      expect(indents.size).toBeGreaterThan(4);
      expect(screen).toContain('* BASICALLY *');
    } finally {
      machine.dispose();
    }
  }, 120000);

  it('circles draws three closed, round rings', async () => {
    const machine = await play('circles.bas', 3000);
    try {
      expect(report(machine)).toBeUndefined();
      const grid = screenText(machine)
        .split('\n')
        .filter((l) => l.includes('*'));
      // Every row of the picture is part of a ring, so the ink's bounding box
      // is the outer ring's. A cell is 7 dots wide and 8 tall, so a round ring
      // is 8/7 as many columns as rows: 21 by 19 is 147 by 152 dots.
      const first = Math.min(...grid.map((l) => l.indexOf('*')));
      const last = Math.max(...grid.map((l) => l.lastIndexOf('*')));
      const width = (last - first + 1) * 7;
      const height = grid.length * 8;
      expect(width / height).toBeGreaterThan(0.9);
      expect(width / height).toBeLessThan(1.1);
      // A row through the centre crosses three concentric rings six times.
      const middle = grid[Math.floor(grid.length / 2)]!;
      expect(middle.trim().split(/ +/)).toHaveLength(6);
      // Closed rings, which is what the integrator's step count buys: an arc a
      // few steps short of a turn leaves the top and bottom of each ring as a
      // pair of dots rather than a solid run.
      expect(grid[0]!.trim().length).toBeGreaterThan(4);
      expect(grid[grid.length - 1]!.trim().length).toBeGreaterThan(4);
    } finally {
      machine.dispose();
    }
  }, 120000);

  /**
   * The rows of the map that carry the marker, which is the only thing that
   * moves. Matched on the map's own alphabet rather than on `O` alone: the
   * prompt and the hint line both contain one.
   */
  function markedRows(machine: MachineEmulator): string[] {
    return screenText(machine)
      .split('\n')
      .map((l) => l.trimEnd())
      .filter((l) => /^[#OE ]+$/.test(l) && l.includes('O'));
  }

  it('maze redraws the map with the marker moved, and refuses a wall', async () => {
    // S is down, which is open from the start; D is right, which is a wall.
    const machine = await play('maze.bas', 900, async (m) => {
      await runFrames(m, 400);
      for (const key of ['KeyS', 'Enter']) await tap(m, key);
      await runFrames(m, 300);
    });
    try {
      expect(report(machine)).toBeUndefined();
      // Two drawings of the map, with the marker one row further down in the
      // second: the whole map is reprinted, there being nothing to redraw in
      // place.
      const maps = markedRows(machine);
      expect(maps).toHaveLength(2);
      expect(maps[0]).toBe('#O# #             #');
      expect(maps[1]).toBe('#O# # ####### #####');

      for (const key of ['KeyD', 'Enter']) await tap(machine, key);
      await runFrames(machine, 200);
      // A blocked move costs nothing: the prompt comes back with no third map.
      expect(markedRows(machine)).toHaveLength(2);
      expect(machine.isProgramRunning()).toBe(true);
    } finally {
      machine.dispose();
    }
  }, 120000);

  it('kaleido runs its 6502 routine and mirrors four ways', async () => {
    // One pass, so the picture fits below the three prompts without scrolling.
    const machine = await play('kaleido.bas', 1500, async (m) => {
      await runFrames(m, 60);
      for (const key of [
        'Digit4',
        'Enter',
        'Digit1',
        'Enter',
        'Digit1',
        'Enter',
      ]) {
        await tap(m, key);
      }
    });
    try {
      expect(report(machine)).toBeUndefined();
      // The twelve rows the routine printed, taken from below the last prompt:
      // it prints every cell of every row, so each is the full 40 wide.
      const lines = screenText(machine).split('\n');
      const prompt = lines.findIndex((l) => l.includes('PASSES (1-4)'));
      expect(
        prompt,
        'the program never asked for its parameters',
      ).toBeGreaterThan(-1);
      const drawn = lines.slice(prompt + 2, prompt + 14);
      expect(drawn).toHaveLength(12);
      for (const row of drawn) expect(row).toHaveLength(40);
      // Folded coordinates, so the picture is symmetric both ways by
      // construction - and a routine that never ran would leave nothing here
      // to be symmetric.
      for (const [i, row] of drawn.entries()) {
        expect(row, `row ${i} is not mirrored left to right`).toBe(
          [...row].reverse().join(''),
        );
        expect(row, `row ${i} does not mirror row ${11 - i}`).toBe(
          drawn[11 - i],
        );
      }
      expect(new Set(drawn.join('')).size).toBeGreaterThan(3);
      // It asks again rather than ending: a real keypress would stop it, so the
      // next prompt is the only wait the machine can offer.
      expect(machine.isProgramRunning()).toBe(true);
      expect(lines[prompt + 14]).toContain('SEED (0-255)');
    } finally {
      machine.dispose();
    }
  }, 120000);

  it('stops a running program on any keypress, which is why there is no breakout', async () => {
    // The fact the sample set is shaped around. Integer BASIC's run loop takes
    // whatever is in the keyboard latch and reports STOPPED AT, so a program
    // cannot see a keypress at all - CTRL-C is not special here.
    const machine = await bootMachine(apple1);
    try {
      machine.loadProgram(
        apple1.tokenize('10 FOR I=1 TO 3000\n20 NEXT I\n30 END\n').image,
      );
      await runUntil(machine, () => machine.isProgramRunning(), 600);
      await runFrames(machine, 40);
      await tap(machine, 'KeyA');
      await runFrames(machine, 40);
      expect(screenText(machine)).toContain('STOPPED AT');
      expect(machine.isProgramRunning()).toBe(false);
    } finally {
      machine.dispose();
    }
  }, 120000);
});
