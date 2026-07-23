import { describe, expect, it } from 'vitest';
import { cpc464Samples } from './samples';
import { tokenizeProgram } from './tokenizer';

describe('cpc464 samples', () => {
  it('ships the canonical five with hello first', () => {
    expect(cpc464Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
      'kaleido.bas',
    ]);
  });

  for (const sample of cpc464Samples) {
    it(`${sample.name} tokenizes without fatal errors`, () => {
      const { bytes, errors } = tokenizeProgram(sample.text, 'basic10');
      // Only statement-shape lint may be non-fatal; nothing here should trip it.
      expect(errors, sample.name).toEqual([]);
      // A real image: program body plus its zero end-marker word.
      expect(bytes.length, sample.name).toBeGreaterThan(2);
    });
  }

  it('the game samples read the cursor keys via INKEY so the pad drives them', () => {
    for (const name of ['breakout.bas', 'maze.bas']) {
      const text = cpc464Samples.find((s) => s.name === name)!.text;
      expect(text, name).toMatch(/INKEY\(/);
    }
  });
});
