import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { zx81Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { buildPFile } from './pfile';
import { Zx81Machine } from './emulator/zx81Machine';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/zx81.rom')),
);

describe('sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of zx81Samples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('breakout runs in the emulator without crashing', () => {
    const breakout = zx81Samples.find((s) => s.name === 'breakout.bas')!;
    const { bytes } = tokenizeProgram(breakout.text);
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    machine.loadProgram(buildPFile(bytes));
    // Dismiss the welcome screen: INKEY$ reads the live key matrix, so holding
    // "1" (not a paddle key) is enough to satisfy its "press any key" wait.
    machine.setKey('Digit1', true);
    for (let i = 0; i < 400; i++) machine.runFrame();
    // The top wall (row of 0x03 / ▀ characters) must be on screen
    const dfile = machine.mem.readWord(0x400c);
    let wallChars = 0;
    for (let i = 0; i < 24 * 33; i++) {
      if (machine.mem.read(dfile + i) === 0x03) wallChars++;
    }
    expect(wallChars).toBeGreaterThan(10);
  });

  it('maze draws its walls in the emulator', () => {
    const maze = zx81Samples.find((s) => s.name === 'maze.bas')!;
    const { bytes } = tokenizeProgram(maze.text);
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    machine.loadProgram(buildPFile(bytes));
    // Dismiss the welcome screen: INKEY$ reads the live key matrix, so holding
    // "1" (not a movement key) is enough to satisfy its "press any key" wait.
    machine.setKey('Digit1', true);
    for (let i = 0; i < 400; i++) machine.runFrame();
    // The maze walls (0x80 / █ characters) must be on screen
    const dfile = machine.mem.readWord(0x400c);
    let wallChars = 0;
    for (let i = 0; i < 24 * 33; i++) {
      if (machine.mem.read(dfile + i) === 0x80) wallChars++;
    }
    expect(wallChars).toBeGreaterThan(40);
  });
});
