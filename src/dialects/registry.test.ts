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

  // The New-project picker groups machines by manufacturer and shows each one's
  // year and blurb, so a dialect missing any of the three would show up there as
  // a blank. The fields are required by the type, but these guard the values.
  it('every dialect describes itself for the machine picker', () => {
    for (const d of dialects) {
      expect(d.manufacturer.trim(), `${d.id} needs a manufacturer`).not.toBe(
        '',
      );
      expect(d.blurb.trim(), `${d.id} needs a blurb`).not.toBe('');
      // A one-liner: long enough to say something, short enough for the picker.
      expect(
        d.blurb.length,
        `${d.id} blurb should be a single line, not a paragraph`,
      ).toBeLessThanOrEqual(160);
      expect(d.blurb, `${d.id} blurb should be one line`).not.toContain('\n');
    }
  });

  it('every dialect declares a plausible release year', () => {
    for (const d of dialects) {
      expect(
        Number.isInteger(d.year),
        `${d.id} year should be an integer`,
      ).toBe(true);
      // The 8-bit microcomputer era, generously bounded - a typo like 19881
      // or a default 0 fails, a genuine machine does not.
      expect(d.year, `${d.id} year looks wrong`).toBeGreaterThanOrEqual(1975);
      expect(d.year, `${d.id} year looks wrong`).toBeLessThanOrEqual(1995);
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
