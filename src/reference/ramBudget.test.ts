import { describe, expect, it } from 'vitest';
import {
  ramBudget,
  ramSeverity,
  RAM_CRIT_PCT,
  RAM_WARN_PCT,
} from './ramBudget';
import {
  ramBudget as statusBarBudget,
  ramSeverity as statusBarSeverity,
} from '../app/useProgramStats';
import { programFitForTarget } from './compare';
import { portingFacts } from './facts';

describe('ramBudget', () => {
  it('is the share of the budget the program takes, clamped', () => {
    expect(ramBudget(0, 15360).pct).toBe(0);
    expect(ramBudget(7680, 15360).pct).toBe(50);
    // A program past the budget still reads 100%: a bar cannot be more than full.
    expect(ramBudget(30000, 15360).pct).toBe(100);
  });

  it('labels the budget in whole K', () => {
    expect(ramBudget(0, 15360).label).toBe('15K');
    expect(ramBudget(0, 3583).label).toBe('3K');
  });
});

describe('ramSeverity', () => {
  it.each([
    [0, 'ok'],
    [79, 'ok'],
    [RAM_WARN_PCT, 'warn'],
    [94, 'warn'],
    [RAM_CRIT_PCT, 'crit'],
    [100, 'crit'],
  ] as const)('classifies %i%% as %s', (pct, severity) => {
    expect(ramSeverity(pct)).toBe(severity);
  });
});

/**
 * The drift this file exists to prevent.
 *
 * The status bar reports a program against the machine it is written for, and
 * the porting guide reports the same program against the machine it is going to.
 * The app may not statically import the reference tree (eslint.config.js: one
 * static import would put ~12,000 lines of tables into the initial download), so
 * the two hold the figures separately - and a reader meeting 82% flagged in one
 * place and unremarked in the other would have to work out which to believe.
 *
 * Vitest runs in node, where importing both sides costs nothing.
 */
describe('the status bar and the porting guide agree', () => {
  const target = portingFacts.find((f) => f.id === 'zx81')!;

  it('computes the same share of the same budget', () => {
    for (const bytes of [0, 1, 4096, 12288, 15359, 15360, 30000]) {
      expect(ramBudget(bytes, target.freeRamBytes)).toEqual(
        statusBarBudget(bytes, target.freeRamBytes),
      );
    }
  });

  it('classifies every share alike, thresholds included', () => {
    for (let pct = 0; pct <= 100; pct++) {
      expect(ramSeverity(pct), `at ${pct}%`).toBe(statusBarSeverity(pct));
    }
  });

  it('reaches the guide, so the fit finding grades as the editor does', () => {
    for (const pct of [50, 79, 80, 94, 95, 100]) {
      const bytes = Math.round((target.freeRamBytes * pct) / 100);
      const fit = programFitForTarget(target, {
        dialectId: 'zx81',
        bytes,
        clean: true,
      })!;
      expect(fit.severity).toBe(statusBarSeverity(fit.percent));
      expect(fit.percent).toBe(ramBudget(bytes, target.freeRamBytes).pct);
    }
  });

  it('reports no fit at all for a target whose space is not bytes', () => {
    // The GE-235's program space is 4,139 twenty-bit words, which is not a
    // figure a source length in characters can be a percentage of - so it
    // declares no byte budget and the guide reports nothing rather than
    // reporting every program as overflowing. Its memory map carries the space
    // in the unit the machine measures it in.
    const words = portingFacts.find((f) => f.id === 'ge235')!;
    expect(words.freeRamBytes).toBe(0);
    expect(
      programFitForTarget(words, {
        dialectId: 'ge235',
        bytes: 291,
        clean: true,
      }),
    ).toBeNull();
  });
});
