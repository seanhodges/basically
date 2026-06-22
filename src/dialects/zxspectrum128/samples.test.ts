import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spectrum128Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { buildTap } from './tapfile';
import { Spectrum128Machine } from './emulator/spectrum128Machine';

describe('zxspectrum128 sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of spectrum128Samples) {
      const { errors } = tokenizeProgram(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('the starter is hello.bas and the music demo uses PLAY', () => {
    expect(spectrum128Samples[0]!.name).toBe('hello.bas');
    const music = spectrum128Samples.find((s) => s.name === 'music.bas')!;
    const { bytes, errors } = tokenizeProgram(music.text);
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toContain(0xa4); // the PLAY token
  });
});

const ROM_PATH = join(__dirname, '../../../public/roms/zxspectrum128.rom');

// Runs the starter on the real ROM; skips when the 128 ROM is absent.
describe.skipIf(!existsSync(ROM_PATH))(
  'zxspectrum128 starter (needs the 128 ROM)',
  () => {
    const rom = new Uint8Array(readFileSync(ROM_PATH));

    it('the hello starter runs and paints a coloured screen', () => {
      const { bytes } = tokenizeProgram(spectrum128Samples[0]!.text);
      const machine = new Spectrum128Machine({ rom });
      machine.loadProgram(buildTap(bytes));
      for (let i = 0; i < 80; i++) machine.runFrame();
      // hello prints 21 INK 1-6 lines on PAPER 0; many cells gain a colour ink.
      let colouredCells = 0;
      for (let a = 0x5800; a < 0x5b00; a++) {
        const ink = machine.mem.read(a) & 0x07;
        if (ink >= 1 && ink <= 6) colouredCells++;
      }
      expect(colouredCells).toBeGreaterThan(100);
    });
  },
);
