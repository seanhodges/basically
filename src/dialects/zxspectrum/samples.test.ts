import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spectrumSamples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { buildTap } from './tapfile';
import { SpectrumMachine } from './emulator/spectrumMachine';

const rom = new Uint8Array(
  readFileSync(join(__dirname, '../../../public/roms/zxspectrum.rom')),
);

describe('zxspectrum sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of spectrumSamples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('the starter runs and paints a coloured screen', () => {
    const starter = spectrumSamples[0]!;
    const { bytes } = tokenizeProgram(starter.text);
    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 80; i++) machine.runFrame();
    // The starter prints 21 lines with INK 1-6 on PAPER 0; attribute cells should hold coloured ink.
    let colouredCells = 0;
    for (let a = 0x5800; a < 0x5b00; a++) {
      const ink = machine.mem.read(a) & 0x07;
      if (ink >= 1 && ink <= 6) colouredCells++;
    }
    expect(colouredCells).toBeGreaterThan(100);
  });

  it('maze draws its walls in the emulator', () => {
    const maze = spectrumSamples.find((s) => s.name === 'maze.bas')!;
    const { bytes } = tokenizeProgram(maze.text);
    const machine = new SpectrumMachine({ rom });
    machine.loadProgram(buildTap(bytes));
    for (let i = 0; i < 200; i++) machine.runFrame();
    // The maze prints 9x14 cells with INK 4 on PAPER 0 (attribute 0x04).
    let mazeCells = 0;
    for (let a = 0x5800; a < 0x5b00; a++) {
      if (machine.mem.read(a) === 0x04) mazeCells++;
    }
    expect(mazeCells).toBeGreaterThan(100);
  });
});
