/**
 * Brute-force sweep to find the W value that makes after.row = before.row + 1.
 * Tests each W value from D_FILE-30 to D_FILE+30 by running the full emulation.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tokenizeProgram } from '../src/dialects/zx80/tokenizer';
import { buildOFile } from '../src/dialects/zx80/ofile';
import { Zx80Machine } from '../src/dialects/zx80/emulator/zx80Machine';
import { D_FILE, DF_END } from '../src/dialects/zx80/sysvars';

const ROM = new Uint8Array(readFileSync(path.resolve('public/roms/zx80.rom')));
const baseMazeText = readFileSync(
  path.resolve('src/dialects/zx80/samples/maze.bas'),
  'utf-8',
);

function findPlayer(machine: Zx80Machine): { row: number; col: number } | null {
  const dFile = machine.mem.readWord(D_FILE);
  const dfEnd = machine.mem.readWord(DF_END);
  let row = 0,
    col = 0;
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

function countWalls(machine: Zx80Machine): number {
  const dFile = machine.mem.readWord(D_FILE);
  const dfEnd = machine.mem.readWord(DF_END);
  let walls = 0;
  for (let a = dFile; a < dfEnd; a++) {
    if (machine.mem.read(a) === 0x80) walls++;
  }
  return walls;
}

function tap(machine: Zx80Machine, code: string): void {
  machine.setKey(code, true);
  for (let i = 0; i < 6; i++) machine.runFrame();
  machine.setKey(code, false);
  for (let i = 0; i < 8; i++) machine.runFrame();
}

function tryW(w: number): {
  success: boolean;
  beforeRow: number;
  afterRow: number;
  beforeWalls: number;
  afterWalls: number;
} {
  // Patch the maze text with this W value
  const mazeText = baseMazeText.replace(/685 LET W=\d+/, `685 LET W=${w}`);
  const { bytes } = tokenizeProgram(mazeText);
  const machine = new Zx80Machine({ rom: ROM, ramKb: 16 });
  machine.loadProgram(buildOFile(bytes));

  for (let i = 0; i < 6000; i++) machine.runFrame();

  const before = findPlayer(machine);
  const beforeWalls = countWalls(machine);

  tap(machine, 'KeyM');
  tap(machine, 'Enter');

  for (let i = 0; i < 6000; i++) machine.runFrame();

  const after = findPlayer(machine);
  const afterWalls = countWalls(machine);

  machine.dispose();

  const beforeRow = before?.row ?? -1;
  const afterRow = after?.row ?? -1;
  const success =
    before !== null &&
    after !== null &&
    afterRow === beforeRow + 1 &&
    after.col === before.col &&
    afterWalls === beforeWalls;

  return { success, beforeRow, afterRow, beforeWalls, afterWalls };
}

// First, find current D_FILE
const { bytes: b0 } = tokenizeProgram(baseMazeText);
const m0 = new Zx80Machine({ rom: ROM, ramKb: 16 });
m0.loadProgram(buildOFile(b0));
for (let i = 0; i < 6000; i++) m0.runFrame();
const dFile = m0.mem.readWord(D_FILE);
m0.dispose();
console.log(`D_FILE at idle: ${dFile}`);

// Sweep W values
const LO = dFile - 30;
const HI = dFile + 30;
console.log(`Sweeping W from ${LO} to ${HI}...\n`);
for (let w = LO; w <= HI; w++) {
  const r = tryW(w);
  const flag = r.success ? ' *** PASS ***' : '';
  console.log(
    `W=${w}: before.row=${r.beforeRow} after.row=${r.afterRow} walls_before=${r.beforeWalls} walls_after=${r.afterWalls}${flag}`,
  );
}
