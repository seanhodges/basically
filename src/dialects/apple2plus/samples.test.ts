// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APPLE2PLUS_KALEIDO_BLOCK, apple2plusSamples } from './samples';
import { apple2plus } from './index';
import { apple2plusKeywords } from './keywords';
import { apple2plusKeyboardLayout } from './keyboardLayout';
import { apple2plusMemoryBlocks } from './memoryBlocks';
import { COLD_START_BYTES_FREE, FLASH_BIT } from './addresses';
import { INVFLG, TEXT_PAGE1 } from '../apple2/addresses';
import { screenGlyph, videoMode } from '../apple2/charset';
import { worstAngularGap } from '../ringGap';
import { materializeSampleBlocks } from '../../app/sampleBlocks';
import {
  hiresBase,
  hiresLineAddress,
  ROW_BYTES,
  textRowAddress,
} from '../../emulator/apple2/display';
import {
  bootMachine,
  hasRom,
  installNodeRomLoading,
  runFrames,
  runUntil,
  screenText,
} from '../bootHarness';
import type { MachineEmulator } from '../types';

const sample = (name: string) =>
  apple2plusSamples.find((s) => s.name === name)!;

/** The machine's RAM. `MachineEmulator` does not name it; this machine has it. */
const ram = (m: MachineEmulator): Uint8Array =>
  (m as unknown as { mem: { mem: Uint8Array } }).mem.mem;

/** Rows of hi-res page 1 as 40 bytes each - the 160 rows `HGR` shows. */
const HIRES_ROWS = 160;
function hiresRow(m: MachineEmulator, y: number): number[] {
  const start = hiresLineAddress(hiresBase(false), y);
  return [...ram(m).subarray(start, start + ROW_BYTES)];
}

/** Every lit dot on hi-res page 1, keyed `x,y`. Bit 7 is the palette bit. */
function hiresDotSet(m: MachineEmulator): Set<string> {
  const on = new Set<string>();
  for (let y = 0; y < HIRES_ROWS; y++)
    hiresRow(m, y).forEach((byte, col) => {
      for (let bit = 0; bit < 7; bit++)
        if (byte & (1 << bit)) on.add(`${col * 7 + bit},${y}`);
    });
  return on;
}

/**
 * The video mode of a text row, taken from its first character that is not a
 * space. A space carries a mode too, but a blank cell left by `HOME` is normal
 * video whatever the program last asked for.
 */
function rowMode(m: MachineEmulator, row: number): string | null {
  const start = textRowAddress(TEXT_PAGE1, row);
  const cell = [...ram(m).subarray(start, start + 40)].find(
    (b) => screenGlyph(b) !== ' ',
  );
  return cell === undefined ? null : videoMode(cell);
}

/** The lo-res page as 40 rows of 40 colour numbers. */
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

describe('apple2plus sample programs', () => {
  it('ships the canonical set, in order', () => {
    expect(apple2plusSamples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  it('offers hello as the starter for a fresh document', () => {
    expect(apple2plus.samples[0]!.name).toBe('hello.bas');
  });

  it('tokenizes and lints every sample clean', () => {
    for (const s of apple2plusSamples) {
      const { errors } = apple2plus.tokenize(s.text);
      expect(errors, `${s.name}: ${JSON.stringify(errors)}`).toEqual([]);
      expect(apple2plus.lint(s.text), s.name).toEqual([]);
    }
  });

  it('leaves every sample room for its own variables', () => {
    // Program text, variables, arrays and string space share one region here,
    // so a program that merely fits answers ?OUT OF MEMORY ERROR the moment it
    // DIMs anything - and `maze` DIMs an array of 21 strings.
    for (const s of apple2plusSamples) {
      const { byteSize } = apple2plus.tokenize(s.text);
      expect(
        byteSize,
        `${s.name} is ${byteSize} of the ${COLD_START_BYTES_FREE} bytes`,
      ).toBeLessThan(COLD_START_BYTES_FREE - 4096);
    }
  });

  it('keeps every sample below the hi-res page it draws on', () => {
    // The trap this machine has and the sibling does not: the program grows up
    // from $0801 towards hi-res page 1 at $2000, so a long enough program is
    // inside the picture and `HGR` clears it out from under itself.
    for (const s of apple2plusSamples) {
      const { byteSize } = apple2plus.tokenize(s.text);
      expect(0x0801 + byteSize, s.name).toBeLessThan(0x2000);
    }
  });

  it('never assigns to a name that is a keyword', () => {
    // Assignments only - the name at the head of a statement. Applesoft crunches
    // a name that spells a keyword into the keyword's token, and the line then
    // mis-runs rather than erroring.
    const words = new Set(apple2plusKeywords.map((k) => k.word));
    const assignment = /(?:^\d+ |:)\s*(?:LET )?([A-Z][A-Z0-9]*)\s*=/gm;
    for (const s of apple2plusSamples) {
      for (const [, name] of s.text.matchAll(assignment)) {
        expect(words.has(name!), `${s.name}: ${name}`).toBe(false);
      }
    }
  });

  it('writes no bare IF over a variable, which this ROM mis-crunches', () => {
    // `IF A THEN` stores as IF, the AT token and `HEN`: the scan reaches AT at
    // $C5 long before THEN, and skips the space getting there. Every condition
    // in these samples is therefore a comparison.
    for (const s of apple2plusSamples) {
      expect(s.text, s.name).not.toMatch(/IF *[A-Z][A-Z0-9]* *THEN/);
    }
  });

  it('reads the keys the on-screen pad presses, through the latch', () => {
    // The pad sends the layout's own bindings, so a game reading any other
    // arrangement answers its arrows with the wrong move. PEEK(-16384) is the
    // latch and POKE -16368,0 the strobe clear - the pair that makes a
    // non-blocking read possible, where Applesoft's own GET blocks.
    //
    // The `+ 128` is this dialect's: the latch carries bit 7 and Applesoft's
    // ASC does not, unlike the sibling's, where ASC sets the bit itself.
    const { bindings } = apple2plusKeyboardLayout.controller!;
    const letter = (id: string) => id.replace('Key', '');
    for (const name of ['breakout.bas', 'maze.bas']) {
      const text = sample(name).text;
      expect(text, name).toContain('PEEK ( - 16384)');
      expect(text, name).toContain('POKE - 16368,0');
      for (const role of ['left', 'right'] as const) {
        expect(text, `${name}: no test for ${role}`).toContain(
          `ASC ("${letter(bindings[role]!)}")`,
        );
      }
    }
    for (const role of ['up', 'down'] as const) {
      expect(sample('maze.bas').text).toContain(
        `ASC ("${letter(bindings[role]!)}")`,
      );
    }
  });
});

/** The map rows, as the DATA the program reads them from. */
function mazeRows(): string[] {
  return [...sample('maze.bas').text.matchAll(/^\d+ DATA "(.*)"$/gm)].map(
    (m) => m[1]!,
  );
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
    expect(sample('maze.bas').text).toMatch(/^\d+ X = 2$/m);
    expect(sample('maze.bas').text).toMatch(/^\d+ Y = 2$/m);
    expect(rows[1]![1]).toBe(' ');
  });

  it('has a path from the start to the exit', () => {
    // The check that matters: an unsolvable map tokenizes, runs and draws
    // perfectly well, and is simply not a game.
    expect(mazePath(rows)).not.toBeNull();
  });

  it('is walled all the way round, which is what keeps a move in range', () => {
    // The program does no bounds check: the border is what stops the marker
    // walking off the map and MID$ing past the end of a row.
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
  const blocks = materializeSampleBlocks(apple2plus, sample('kaleido.bas'));

  it('assembles clean and lands in a valid range', () => {
    expect(blocks).toHaveLength(1);
    const { address, bytes } = blocks[0]!;
    expect(bytes.length).toBeGreaterThan(0);
    const end = address + bytes.length - 1;
    expect(
      apple2plusMemoryBlocks.validRanges.some(
        (r) => address >= r.start && end <= r.end,
      ),
      `0x${address.toString(16)}-0x${end.toString(16)} is outside the block window`,
    ).toBe(true);
    // And clear of the sixteen bytes of vectors at the top of the page, which
    // the block window only warns about - the Autostart Monitor rewrites the
    // lowest five of them on every RESET.
    expect(end).toBeLessThan(0x03f0);
  });

  it('puts the entry point past the three parameter bytes', () => {
    expect(APPLE2PLUS_KALEIDO_BLOCK.entry).toBe(
      APPLE2PLUS_KALEIDO_BLOCK.address + 3,
    );
    // The BASIC front end has to agree, in the machine's own decimal.
    expect(sample('kaleido.bas').text).toContain(
      `CALL ${APPLE2PLUS_KALEIDO_BLOCK.entry}`,
    );
  });

  it('stays clear of the workspace BASIC will fill', () => {
    const { address, bytes } = blocks[0]!;
    const program = apple2plusMemoryBlocks.programArea(0);
    expect(address + bytes.length - 1).toBeLessThan(program.start);
  });
});

/**
 * Every sample run on the shipped firmware, because nothing above proves one
 * works: a statement the ROM refuses, a picture that never closes and a game
 * wired to the wrong keys all tokenize and lint clean.
 */
const describeOnRom = hasRom(apple2plus) ? describe : describe.skip;

describeOnRom('what each sample actually does', () => {
  let restoreRomLoading: () => void;
  beforeAll(() => {
    restoreRomLoading = installNodeRomLoading();
  });
  afterAll(() => restoreRomLoading());

  /** Boot and start `name`, leaving it running. */
  async function play(name: string): Promise<MachineEmulator> {
    const s = sample(name);
    const machine = await bootMachine(apple2plus);
    machine.loadProgram(apple2plus.tokenize(s.text).image, {
      blocks: materializeSampleBlocks(apple2plus, s),
    });
    await runUntil(machine, () => machine.isProgramRunning() === true, 600);
    return machine;
  }

  /** Type one key the way the on-screen keyboard sends it. */
  async function tap(machine: MachineEmulator, token: string): Promise<void> {
    machine.setKey(token, true);
    await runFrames(machine, 2);
    machine.setKey(token, false);
    await runFrames(machine, 5);
  }

  /** The `?... ERROR` report Applesoft leaves on screen, if any. */
  function report(machine: MachineEmulator): string | undefined {
    return screenText(machine)
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /^\?.*ERROR/.test(l));
  }

  it('hello cascades through all three video modes and signs off flashing', async () => {
    const machine = await play('hello.bas');
    try {
      await runUntil(machine, () => machine.isProgramRunning() === false, 1200);
      expect(machine.isProgramRunning()).toBe(false);
      expect(report(machine)).toBeUndefined();
      const screen = screenText(machine);
      const lines = screen
        .split('\n')
        .filter((l) => l.includes('HELLO FROM THE APPLE II PLUS'));
      // All twenty, undamaged. A banner printed without its trailing `;` drops
      // the cursor past the last line, and the scroll that follows costs the
      // top of the cascade and mangles a row on the way.
      expect(lines.length).toBe(20);
      // The staircase is the point: a static splash would print every copy at
      // the same indent.
      expect(new Set(lines.map((l) => l.indexOf('H'))).size).toBeGreaterThan(8);
      expect(screen).toContain('* BASICALLY *');

      // The cascade *is* this machine's display: the text page has no colour,
      // so the three video modes are what make it more than a splash. Row I-1
      // carries I MOD 3 - all-normal would mean none of them took.
      const cycle = ['normal', 'flashing', 'inverse'] as const;
      expect(Array.from({ length: 20 }, (_, r) => rowMode(machine, r))).toEqual(
        Array.from({ length: 20 }, (_, r) => cycle[(r + 1) % 3]),
      );

      // FLASH is Applesoft's and not Integer BASIC's, and the stars are how
      // you can tell: it ORs the flash bit in before COUT masks, so a star and
      // a space flash too. The sibling's POKE can only AND, which leaves both
      // of them inverse - so every cell here, not merely one, must flash.
      const banner = textRowAddress(TEXT_PAGE1, 22) + 13;
      const cells = [...ram(machine).subarray(banner, banner + 13)];
      expect(cells.map(screenGlyph).join('')).toBe('* BASICALLY *');
      expect(cells.map(videoMode)).toEqual(Array(13).fill('flashing'));
      // Normal video handed back. NORMAL clears the flash bit as well as
      // INVFLG, and only the pair proves it ran rather than a bare POKE.
      expect(ram(machine)[INVFLG], 'INVFLG left non-normal').toBe(0xff);
      expect(ram(machine)[FLASH_BIT], 'flash bit left set').toBe(0x00);
    } finally {
      machine.dispose();
    }
  });

  it('circles draws three closed, round rings', async () => {
    const machine = await play('circles.bas');
    try {
      await runUntil(machine, () => machine.isProgramRunning() === false, 2400);
      expect(machine.isProgramRunning()).toBe(false);
      expect(report(machine)).toBeUndefined();

      // The ink's bounding box, in the pixels the screen presents. A ring drawn
      // with the full E rather than E/2 integrates an ellipse, and one drawn
      // for fewer than 2*PI/E steps leaves a gap; both show up here.
      let minX = 280;
      let maxX = -1;
      let minY = 160;
      let maxY = -1;
      let dots = 0;
      for (let y = 0; y < HIRES_ROWS; y++) {
        hiresRow(machine, y).forEach((byte, col) => {
          for (let bit = 0; bit < 7; bit++) {
            if ((byte & (1 << bit)) === 0) continue;
            const x = col * 7 + bit;
            dots++;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        });
      }
      // Three solid rings light about a thousand dots. Drawn in the artifact
      // colours instead, two of the three come out at a third of their density
      // and the total lands near 700 - so this floor is what stands between
      // the sample and a dashed picture.
      expect(dots).toBeGreaterThan(900);
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      expect(
        width / height,
        `${width} by ${height} is not round`,
      ).toBeGreaterThan(0.9);
      expect(width / height).toBeLessThan(1.1);
      // The outer ring is the K=3 one, radius 66 about (140,80).
      expect(width).toBeGreaterThan(120);

      // Every ring whole, which the bounding box above cannot see: it is the
      // outer ring's alone, so an inner ring could be missing entirely and
      // still leave it - and a coloured ring is dashed rather than absent.
      // HCOLOR= 1 or 5 reaches only half the dot columns, which put a 31
      // degree hole in the innermost ring before this check was written.
      const cx = 140;
      const cy = 80;
      const on = hiresDotSet(machine);
      for (const k of [1, 2, 3]) {
        const gap = worstAngularGap(
          (x, y) => on.has(`${x},${y}`),
          { x: cx, y: cy },
          { x: k * 22, y: k * 22 },
          2,
        );
        expect(gap, `ring ${k} is broken over ${gap} degrees`).toBeLessThan(6);
      }
    } finally {
      machine.dispose();
    }
  });

  it('breakout serves, knocks bricks out and follows the paddle keys', async () => {
    const machine = await play('breakout.bas');
    try {
      await runUntil(
        machine,
        () => screenText(machine).includes('SPACE TO SERVE'),
        900,
      );
      // Four rows of bricks, drawn as three lo-res colours over the top eight
      // block rows, and the paddle in white at the bottom.
      const wall = loresGrid(machine);
      expect(new Set(wall.slice(0, 8).flat()).size).toBeGreaterThan(2);
      expect(wall[38]!.filter((c) => c === 15).length).toBe(7);

      const { bindings } = apple2plusKeyboardLayout.controller!;
      await tap(machine, bindings.fire1!);
      const scored = await runUntil(
        machine,
        () => /SCORE +[1-9]/.test(screenText(machine)),
        1200,
      );
      expect(scored, 'the ball never knocked a brick out').toBe(true);
      expect(report(machine)).toBeUndefined();

      // The paddle follows the pad's own left key, in the direction it points.
      const paddleStart = loresGrid(machine)[38]!.indexOf(15);
      await tap(machine, bindings.left!);
      await runFrames(machine, 30);
      expect(loresGrid(machine)[38]!.indexOf(15)).toBeLessThan(paddleStart);

      // And the ball is eventually lost, which is the only way the game ends.
      await runUntil(machine, () => machine.isProgramRunning() === false, 3600);
      expect(screenText(machine)).toContain('GAME OVER');
    } finally {
      machine.dispose();
    }
  });

  it('maze moves the marker one cell at a time and repaints only those cells', async () => {
    const machine = await play('maze.bas');
    try {
      await runUntil(
        machine,
        () => screenText(machine).includes('REACH E'),
        1200,
      );
      // The marker has to be on screen before the count below means anything.
      await runUntil(
        machine,
        () => screenText(machine).split('\n')[1]?.[1] === 'O',
        600,
      );
      expect(report(machine)).toBeUndefined();

      const page = () => [
        ...ram(machine).subarray(TEXT_PAGE1, TEXT_PAGE1 + 1024),
      ];
      const before = page();
      const { bindings } = apple2plusKeyboardLayout.controller!;
      await tap(machine, bindings.right!);
      await runFrames(machine, 60);
      const after = page();
      const moved = before.filter((b, i) => b !== after[i]).length;
      // Two cells: the one vacated and the one taken. Reprinting the whole map
      // would move eight hundred.
      expect(moved).toBe(2);
      // Column 2 vacated, column 3 taken - the marker went right, which is
      // where the pad's right key points.
      expect(screenText(machine).split('\n')[1]!.slice(0, 4)).toBe('# O ');

      // A wall stops it: the cell below the start is `#`.
      const held = page();
      await tap(machine, bindings.down!);
      await runFrames(machine, 60);
      expect(page().filter((b, i) => b !== held[i]).length).toBe(0);

      // And the map really can be walked out of.
      for (const move of mazePath(mazeRows())!) {
        await tap(machine, `Key${move}`);
        await runFrames(machine, 6);
      }
      await runUntil(
        machine,
        () => screenText(machine).includes('YOU ESCAPED!'),
        1800,
      );
      expect(screenText(machine)).toContain('YOU ESCAPED!');
    } finally {
      machine.dispose();
    }
  });

  it('kaleido asks its three questions, runs its routine and mirrors four ways', async () => {
    const machine = await play('kaleido.bas');
    try {
      const answers: [string, string[]][] = [
        ['SEED (0-255)', ['Digit7', 'Enter']],
        ['TWIST (0-255)', ['Digit9', 'Digit9', 'Enter']],
        ['PASSES (1-9)', ['Digit1', 'Enter']],
      ];
      for (const [prompt, keys] of answers) {
        const asked = await runUntil(
          machine,
          () => screenText(machine).includes(prompt),
          900,
        );
        expect(asked, `never asked for ${prompt}`).toBe(true);
        for (const key of keys) await tap(machine, key);
      }

      // One CALL, and CURLIN sits on its line for as long as the routine runs.
      await runUntil(machine, () => machine.currentLine() === 160, 600);
      await runUntil(machine, () => machine.currentLine() !== 160, 1200);
      expect(report(machine)).toBeUndefined();

      // The mirror, read off the page itself rather than off a screenshot: the
      // routine writes each byte once, from folded coordinates, so a byte and
      // its three reflections have to be identical.
      const rows = Array.from({ length: HIRES_ROWS }, (_, y) =>
        hiresRow(machine, y),
      );
      expect(rows.flat().some((b) => b !== 0)).toBe(true);
      for (let y = 0; y < HIRES_ROWS; y++) {
        for (let x = 0; x < ROW_BYTES; x++) {
          expect(rows[y]![x], `(${x},${y}) across`).toBe(
            rows[y]![ROW_BYTES - 1 - x],
          );
          expect(rows[y]![x], `(${x},${y}) down`).toBe(
            rows[HIRES_ROWS - 1 - y]![x],
          );
        }
      }
      // Bit 7 is the palette bit rather than a dot, and the routine leaves it
      // clear so both halves of the picture take the same colour pair.
      expect(rows.flat().every((b) => b < 0x80)).toBe(true);
    } finally {
      machine.dispose();
    }
  });
});
