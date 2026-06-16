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
  // `D_FILE`, then sweep a few values around it until a M-then-NEW-LINE move
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
    settle();

    // The █ walls (code 0x80) fill most of the screen.
    const wallsBefore = countWalls(machine);
    expect(wallsBefore).toBeGreaterThan(40);

    // Pressing M (down) + NEW LINE walks the player into the open cell below.
    const before = findPlayer(machine);
    expect(before).not.toBeNull();
    tap(machine, 'KeyM');
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
