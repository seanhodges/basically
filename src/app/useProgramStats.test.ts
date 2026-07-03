import { describe, expect, it } from 'vitest';
import { ramDisplay, ramSeverity } from './useProgramStats';

describe('ramSeverity', () => {
  it.each([
    [0, 'ok'],
    [79, 'ok'],
    [80, 'warn'],
    [94, 'warn'],
    [95, 'crit'],
    [100, 'crit'],
  ] as const)('classifies %i%% as %s', (pct, severity) => {
    expect(ramSeverity(pct)).toBe(severity);
  });
});

describe('ramDisplay (estimate mode)', () => {
  it('reproduces the original budget text', () => {
    const d = ramDisplay(1234, 41472, null);
    expect(d.text).toBe('1,234 bytes (3% of 41K budget)');
    expect(d.pct).toBe(3);
    expect(d.severity).toBe('ok');
  });

  it('clamps the percentage at 100', () => {
    const d = ramDisplay(20000, 15360, null);
    expect(d.pct).toBe(100);
    expect(d.severity).toBe('crit');
  });

  it('turns warn at 80% of the budget', () => {
    const d = ramDisplay(12288, 15360, null); // exactly 80%
    expect(d.severity).toBe('warn');
  });
});

describe('ramDisplay (live mode)', () => {
  it('shows actual usage against the machine total', () => {
    const d = ramDisplay(0, 15360, { used: 12345, free: 26566 }); // total 38911
    expect(d.text).toBe('12,345 bytes used (32% of 38K)');
    expect(d.pct).toBe(32);
    expect(d.severity).toBe('ok');
  });

  it('ignores the static estimate figures entirely', () => {
    const d = ramDisplay(9999, 1, { used: 100, free: 900 });
    expect(d.text).toBe('100 bytes used (10% of 1K)');
  });

  it('turns crit at 95% of the machine total', () => {
    const d = ramDisplay(0, 15360, { used: 950, free: 50 });
    expect(d.pct).toBe(95);
    expect(d.severity).toBe('crit');
  });

  it('guards a zero total', () => {
    const d = ramDisplay(0, 15360, { used: 0, free: 0 });
    expect(d.pct).toBe(0);
    expect(d.severity).toBe('ok');
  });
});
