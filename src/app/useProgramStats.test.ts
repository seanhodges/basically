import { describe, expect, it } from 'vitest';
import { countProgramErrors, ramDisplay, ramSeverity } from './useProgramStats';
import { commodore64 } from '../dialects/commodore64';

describe('countProgramErrors', () => {
  it('includes editor-lint diagnostics beyond tokenize errors', () => {
    // PRINCHR$(65) tokenizes cleanly (assignment-shaped), but the editor lint
    // flags the name for embedding CHR$ - the run gate must count it too.
    const source = '10 PRINCHR$(65)';
    expect(commodore64.tokenize(source).errors).toEqual([]);
    expect(countProgramErrors(commodore64, source)).toBeGreaterThan(0);
  });

  it('counts tokenizer errors', () => {
    expect(countProgramErrors(commodore64, '10 PRNT 1')).toBe(1);
  });

  it('counts a clean program as zero', () => {
    expect(countProgramErrors(commodore64, '10 PRINT CHR$(65)')).toBe(0);
  });

  it('skips the editor-lint diagnostics when includeEditorLint is off', () => {
    expect(countProgramErrors(commodore64, '10 PRINCHR$(65)', false)).toBe(0);
  });

  it('still counts tokenizer errors when includeEditorLint is off', () => {
    expect(countProgramErrors(commodore64, '10 PRNT 1', false)).toBe(1);
  });
});

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
