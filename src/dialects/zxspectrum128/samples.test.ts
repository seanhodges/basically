import { describe, expect, it } from 'vitest';
import { spectrum128Samples } from './samples';
import { tokenizeProgram } from './tokenizer';

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
