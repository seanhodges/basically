import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { zx80Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { buildOFile, parseOFile } from './ofile';
import { Zx80Machine } from './emulator/zx80Machine';
import { D_FILE, DF_END } from './sysvars';

describe('zx80 samples', () => {
  for (const sample of zx80Samples) {
    it(`${sample.name} tokenizes without errors and builds a valid image`, () => {
      const { bytes, errors } = tokenizeProgram(sample.text);
      expect(errors).toEqual([]);
      expect(bytes.length).toBeGreaterThan(0);
      const image = buildOFile(bytes);
      expect(Array.from(parseOFile(image).program)).toEqual(Array.from(bytes));
    });
  }
});

const ROM = new Uint8Array(
  readFileSync(path.resolve(__dirname, '../../../public/roms/zx80.rom')),
);

/** Find the player marker 'O' (code 0x34) on the collapsed display file. */
function findPlayer(machine: Zx80Machine): { row: number; col: number } | null {
  const dFile = machine.mem.readWord(D_FILE);
  const dfEnd = machine.mem.readWord(DF_END);
  let row = 0;
  let col = 0;
  for (let a = dFile; a < dfEnd; a++) {
    const b = machine.mem.read(a);
    if (b === 0x76) {
      row++;
      col = 0;
      continue;
    }
    if (b === 0x34) return { row, col };
    col++;
  }
  return null;
}

function tap(machine: Zx80Machine, code: string): void {
  machine.setKey(code, true);
  for (let i = 0; i < 6; i++) machine.runFrame();
  machine.setKey(code, false);
  for (let i = 0; i < 8; i++) machine.runFrame();
}

/** Count the █ wall cells (code 0x80) currently in the display file. */
function countWalls(machine: Zx80Machine): number {
  const dFile = machine.mem.readWord(D_FILE);
  const dfEnd = machine.mem.readWord(DF_END);
  let walls = 0;
  for (let a = dFile; a < dfEnd; a++) {
    if (machine.mem.read(a) === 0x80) walls++;
  }
  return walls;
}

describe('zx80 maze in the emulator', () => {
  // The ZX80 has no string arrays, PRINT AT or INKEY$, so the maze decodes its
  // walls from bitmask constants and draws the screen ONCE, then moves the
  // player by POKEing the two changed cells straight into the display file
  // rather than clearing and redrawing every turn (line 685's `LET W=...` is
  // the display-file base + 1 those POKEs use). Moves arrive via INPUT A$. This
  // drives the real ROM to prove the draw-once + POKE-move path works.
  //
  // NOTE: `W` is a hard-coded display-file address that depends on the exact
  // program/variable layout, so editing maze.bas (adding lines or variables)
  // will move the display file and break it. This test guards that: if `W` is
  // stale the POKEs land in the wrong cells, so the player stops tracking and
  // the wall count drifts. To recompute `W`, run the maze to INPUT and read
  // `D_FILE`, then sweep a few values around it until a 6-then-NEW-LINE move
  // walks the player down exactly one row with the wall count unchanged.
  it('decodes and draws its walls, then moves the player by POKE', () => {
    const maze = zx80Samples.find((s) => s.name === 'maze.bas')!;
    const { bytes } = tokenizeProgram(maze.text);
    const machine = new Zx80Machine({ rom: ROM, ramKb: 16 });
    machine.loadProgram(buildOFile(bytes));

    // Run long enough for the decode + first (and only) full draw to reach INPUT.
    const settle = () => {
      for (let i = 0; i < 6000; i++) machine.runFrame();
    };
    // The maze now opens on a welcome screen (PRINT title, then INPUT to start).
    // Reach that prompt, type a key + NEWLINE to begin, then let the maze draw.
    settle();
    tap(machine, 'Digit1');
    tap(machine, 'Enter');
    settle();

    // The █ walls (code 0x80) fill most of the screen.
    const wallsBefore = countWalls(machine);
    expect(wallsBefore).toBeGreaterThan(40);

    // Pressing 6 (down) + NEW LINE walks the player into the open cell below.
    const before = findPlayer(machine);
    expect(before).not.toBeNull();
    tap(machine, 'Digit6');
    tap(machine, 'Enter');
    settle();
    const after = findPlayer(machine);
    expect(after).not.toBeNull();
    expect(after!.row).toBe(before!.row + 1);
    expect(after!.col).toBe(before!.col);

    // The move was a two-cell POKE, not a full redraw: the maze (and its wall
    // count) is left intact. A stale `W` would corrupt cells and change this.
    expect(countWalls(machine)).toBe(wallsBefore);

    machine.dispose();
  }, 60000);
});

describe('zx80 kaleidoscope', () => {
  const ROM2 = new Uint8Array(
    readFileSync(path.resolve(__dirname, '../../../public/roms/zx80.rom')),
  );

  it('builds a full 24x32 display with 4-way mirror symmetry', () => {
    // The sample INPUTs its parameters; drive the same embedded routine with a
    // POKE + USR program instead so the test needs no keyboard scripting. The
    // #BIN line (line 1) carrying the machine code is shared verbatim.
    const kaleido = zx80Samples.find((s) => s.name === 'kaleido.bas')!;
    const binLine = kaleido.text.split('\n')[0]!;
    expect(binLine.startsWith('#BIN ')).toBe(true);
    const driver = [
      binLine,
      '10 POKE 16427,3',
      '20 POKE 16428,5',
      '30 POKE 16429,2',
      '40 LET X=USR(16430)',
      '50 GOTO 50',
      '',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(driver);
    expect(errors).toEqual([]);
    const machine = new Zx80Machine({ rom: ROM2, ramKb: 16 });
    machine.loadProgram(buildOFile(bytes));
    for (let i = 0; i < 150; i++) machine.runFrame();

    // Walk the display file into 0x76-terminated rows.
    const dFile = machine.mem.readWord(D_FILE);
    const dfEnd = machine.mem.readWord(DF_END);
    const rows: number[][] = [];
    let a = dFile;
    while (a < dfEnd) {
      const row: number[] = [];
      while (a < dfEnd && machine.mem.read(a) !== 0x76) {
        row.push(machine.mem.read(a));
        a++;
      }
      a++;
      rows.push(row);
    }
    // The routine builds 24 full rows of 32 block graphics.
    expect(rows.length).toBe(24);
    for (const row of rows) expect(row.length).toBe(32);

    // Enough variety to be a pattern, not a flat fill.
    const distinct = new Set(rows.flat());
    expect(distinct.size).toBeGreaterThan(4);

    // 4-way mirror: each row is a left/right palindrome, and the rows mirror
    // top/bottom.
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 16; x++) {
        const v = rows[y]![x]!;
        expect(rows[y]![31 - x]).toBe(v);
        expect(rows[23 - y]![x]).toBe(v);
      }
    }
    machine.dispose();
  });
});
