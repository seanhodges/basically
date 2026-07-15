import { describe, it, expect } from 'vitest';
import { niceStep, addressTicks } from './memoryScale';

describe('niceStep', () => {
  it('rounds up to 1/2/5 times a power of ten', () => {
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.5)).toBe(2);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(15)).toBe(20);
    expect(niceStep(1891)).toBe(2000);
  });

  it('never returns a non-positive step', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(-5)).toBe(1);
  });
});

describe('addressTicks', () => {
  it('returns no ticks when the band is too short to fit two', () => {
    expect(addressTicks(0, 16383, 26)).toEqual([]);
    expect(addressTicks(100, 115, 26)).toEqual([]);
  });

  it('places round-numbered ticks across a tall, large region', () => {
    const ticks = addressTicks(23755, 65367, 1000);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks.every((a) => a % 2000 === 0)).toBe(true);
    expect(ticks[0]).toBe(24000);
    expect(ticks.every((a) => a > 23755 && a <= 65367)).toBe(true);
  });

  it('never labels the region start address', () => {
    expect(addressTicks(24000, 65367, 1000)).not.toContain(24000);
  });

  it('clamps the step to whole addresses for a tiny span', () => {
    const ticks = addressTicks(10, 14, 1000);
    expect(ticks).toEqual([11, 12, 13, 14]);
  });

  it('returns no ticks for a zero/one-byte span', () => {
    expect(addressTicks(50, 50, 1000)).toEqual([]);
  });
});
