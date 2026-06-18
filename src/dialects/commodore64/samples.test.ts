import { describe, expect, it } from 'vitest';
import { c64Samples } from './samples';
import { commodore64 } from './index';

describe('commodore64 sample programs', () => {
  it('all tokenize without errors', () => {
    for (const sample of c64Samples) {
      const { errors } = commodore64.tokenize(sample.text);
      expect(errors, `${sample.name}: ${JSON.stringify(errors)}`).toEqual([]);
    }
  });

  it('matches the canonical sample set shared with the other dialects', () => {
    expect(c64Samples.map((s) => s.name)).toEqual([
      'hello.bas',
      'circles.bas',
      'breakout.bas',
      'maze.bas',
    ]);
  });

  it('hello is the starter offered for a fresh document', () => {
    expect(commodore64.samples[0]!.name).toBe('hello.bas');
  });
});
