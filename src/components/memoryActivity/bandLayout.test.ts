import { describe, expect, it } from 'vitest';
import type { Band } from '../memoryBands';
import {
  addrToY,
  backingDpr,
  bandLayout,
  layoutHeight,
  MAX_BACKING_PX,
} from './bandLayout';

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

describe('backingDpr', () => {
  it('keeps the real DPR when the canvas fits within the limit', () => {
    expect(backingDpr(300, 2000, 2)).toBe(2);
    expect(backingDpr(300, 2000, 1)).toBe(1);
  });

  it('caps the DPR so the largest dimension stays within the limit', () => {
    // A tall column at DPR 2 would need 12000px of backing store; cap it.
    const dpr = backingDpr(300, 6000, 2);
    expect(dpr).toBeCloseTo(MAX_BACKING_PX / 6000, 5);
    expect(6000 * dpr).toBeCloseTo(MAX_BACKING_PX, 5);
  });

  it('governs by the taller of the two dimensions', () => {
    // Width, not height, is the constraint here.
    const dpr = backingDpr(10000, 500, 2);
    expect(dpr).toBeCloseTo(MAX_BACKING_PX / 10000, 5);
    expect(10000 * dpr).toBeCloseTo(MAX_BACKING_PX, 5);
  });

  it('never lets a capped backing dimension exceed the limit', () => {
    for (const height of [4000, 8192, 12000, 20000, 40000]) {
      const dpr = backingDpr(320, height, 3);
      expect(Math.max(320, height) * dpr).toBeLessThanOrEqual(
        MAX_BACKING_PX + 1e-6,
      );
    }
  });

  it('falls back to the given DPR for an unmeasured (zero-size) canvas', () => {
    expect(backingDpr(0, 0, 2)).toBe(2);
  });
});
