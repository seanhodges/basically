import { describe, expect, it } from 'vitest';
import type { Band } from '../memoryBands';
import { addrToY, bandLayout, layoutHeight } from './bandLayout';

const band = (start: number, end: number): Band => ({
  key: `${start}`,
  label: `${start}`,
  kind: 'program',
  start,
  end,
  leaves: [],
});

describe('bandLayout', () => {
  const bands = [band(0, 0x3fff), band(0x4000, 0x7fff), band(0x8000, 0xffff)];
  const heightOf = () => 100;
  const GAP = 4;

  it('stacks tops including the inter-band gap', () => {
    const geo = bandLayout(bands, heightOf, GAP);
    expect(geo.map((g) => g.top)).toEqual([0, 104, 208]);
    expect(geo.every((g) => g.height === 100)).toBe(true);
  });

  it('layoutHeight is the last band bottom (no trailing gap)', () => {
    const geo = bandLayout(bands, heightOf, GAP);
    expect(layoutHeight(geo)).toBe(308); // 208 + 100
  });

  it('empty layout has zero height', () => {
    expect(layoutHeight([])).toBe(0);
  });
});

describe('addrToY', () => {
  const bands = [band(0, 0x3fff), band(0x4000, 0x7fff)];
  const geo = bandLayout(bands, () => 100, 4);

  it('maps a band start to its top', () => {
    expect(addrToY(geo, 0x4000)).toBe(104);
  });

  it('maps addresses proportionally within a band', () => {
    // Halfway through band 0 (span 0x4000): (0x2000 / 0x4000) * 100 = 50.
    expect(addrToY(geo, 0x2000)).toBeCloseTo(50, 5);
  });

  it('maps the last address near the band bottom', () => {
    const span = 0x4000;
    expect(addrToY(geo, 0x3fff)).toBeCloseTo(((span - 1) / span) * 100, 5);
  });

  it('returns null for an address outside every band', () => {
    expect(addrToY(geo, 0x8000)).toBeNull();
  });
});
