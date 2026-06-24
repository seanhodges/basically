import { describe, it, expect } from 'vitest';
import { dialects } from './registry';

describe('dialect registry', () => {
  it('every dialect declares a positive program RAM estimate', () => {
    for (const d of dialects) {
      expect(
        Number.isInteger(d.programRamBytes),
        `${d.id} programRamBytes should be an integer`,
      ).toBe(true);
      expect(
        d.programRamBytes,
        `${d.id} programRamBytes should be positive`,
      ).toBeGreaterThan(0);
    }
  });
});
