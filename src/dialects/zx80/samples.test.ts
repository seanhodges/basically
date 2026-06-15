import { describe, expect, it } from 'vitest';
import { zx80Samples } from './samples';
import { tokenizeProgram } from './tokenizer';
import { buildOFile, parseOFile } from './ofile';

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
