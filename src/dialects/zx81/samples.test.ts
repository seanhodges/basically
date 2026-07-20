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

  it('kaleidoscope draws a 4-way mirrored display', () => {
    // The sample INPUTs its parameters; drive the same embedded routine with a
    // POKE + RAND USR program instead so the test needs no keyboard scripting.
    // The #BIN line (line 1) carrying the machine code is shared verbatim.
    const kaleido = zx81Samples.find((s) => s.name === 'kaleido.bas')!;
    const binLine = kaleido.text.split('\n')[0]!;
    expect(binLine.startsWith('#BIN ')).toBe(true);
    const driver = [
      binLine,
      '10 CLS',
      '20 POKE 16514,3',
      '30 POKE 16515,5',
      '40 POKE 16516,2',
      '50 RAND USR 16517',
      '60 PAUSE 32767',
      '',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(driver);
    expect(errors).toEqual([]);
    const machine = new Zx81Machine({ rom, ramKb: 16 });
    machine.loadProgram(buildPFile(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();

    // The display file is 24 rows of 32 chars, each ending in a 0x76 NEWLINE,
    // after a leading NEWLINE at dfile. cell(x,y) sits at dfile+1 + y*33 + x.
    const dfile = machine.mem.readWord(0x400c);
    const cell = (x: number, y: number) =>
      machine.mem.read(dfile + 1 + y * 33 + x);
    const distinct = new Set<number>();
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 32; x++) distinct.add(cell(x, y));
    expect(distinct.size).toBeGreaterThan(4);

    // 4-way mirror symmetry across the 32x24 display.
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 16; x++) {
        const v = cell(x, y);
        expect(cell(31 - x, y)).toBe(v);
        expect(cell(x, 23 - y)).toBe(v);
        expect(cell(31 - x, 23 - y)).toBe(v);
      }
    }
  });
});
