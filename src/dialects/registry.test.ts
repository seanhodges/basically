import { describe, it, expect } from 'vitest';
import { dialects, getDialect } from './registry';

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

  // The memory-map viewer opens on each dialect's preferred notation: hex for
  // machines that conventionally address memory in hex (BBC/Atom indirection),
  // decimal for the POKE machines (Sinclair, Commodore, TRS-80).
  const expectedNotation: Record<string, 'hex' | 'dec'> = {
    bbcmicro: 'hex',
    bbcmaster: 'hex',
    atom: 'hex',
    commodore64: 'dec',
    pet: 'dec',
    vic20: 'dec',
    zx80: 'dec',
    zx81: 'dec',
    zxspectrum: 'dec',
    zxspectrum128: 'dec',
    trs80: 'dec',
    cpc464: 'hex',
  };

  it('every dialect declares its memory-map address notation', () => {
    for (const d of dialects) {
      expect(
        d.addressNotation,
        `${d.id} should declare an addressNotation`,
      ).toBe(expectedNotation[d.id]);
    }
  });

  it('covers every registered dialect in the notation expectations', () => {
    expect(new Set(Object.keys(expectedNotation))).toEqual(
      new Set(dialects.map((d) => d.id)),
    );
    // getDialect resolves the same objects the expectations key on.
    for (const id of Object.keys(expectedNotation)) {
      expect(getDialect(id).addressNotation).toBe(expectedNotation[id]);
    }
  });
});
