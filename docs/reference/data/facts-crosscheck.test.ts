/**
 * Pins the hand-authored porting facts to the dialect sources, so the hardware
 * facts in the comparison tool cannot silently drift from the code. Only the
 * fields with a structured source of truth on the `Dialect` are checked here;
 * the prose fields (line-number range, ELSE/LET, variable naming, colour,
 * sound) have no machine-readable source and are reviewed against the hardware
 * page and aiProfile by hand.
 *
 * Each facts entry maps to the dialect that best represents its page. This
 * mirrors keyword-crosscheck.test.ts, except the Commodore page is pinned to the
 * C64 (the marquee machine whose hardware the facts describe) rather than the
 * PET (whose keyword superset the reference table is pinned to). Like the
 * keyword crosscheck, this file may import src/ freely: vitest runs it in node
 * and the VitePress bundle never includes *.test.ts.
 */
import { describe, expect, it } from 'vitest';
import type { Dialect } from '../../../src/dialects/types';
import { getDialect } from '../../../src/dialects/registry';
import type { PortingFacts } from './types';
import { portingFacts } from './facts';

/** Page slug → representative dialect id whose hardware the facts describe. */
const REPRESENTATIVE: Record<string, string> = {
  zx81: 'zx81',
  zx80: 'zx80',
  zxspectrum: 'zxspectrum',
  bbc: 'bbcmicro',
  commodore: 'commodore64',
  atom: 'atom',
  trs80: 'trs80',
  cpc: 'cpc464',
};

const PAIRS: [string, PortingFacts, Dialect][] = portingFacts.map((facts) => {
  const id = REPRESENTATIVE[facts.id];
  if (!id)
    throw new Error(`No representative dialect for facts page: ${facts.id}`);
  return [facts.id, facts, getDialect(id)];
});

describe('facts crosscheck', () => {
  it('has one facts entry per comparable reference page', () => {
    const ids = portingFacts.map((f) => f.id).sort();
    expect(ids).toEqual(Object.keys(REPRESENTATIVE).sort());
  });

  it('has no duplicate page ids', () => {
    const ids = portingFacts.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe.each(PAIRS)('facts crosscheck: %s', (_id, facts, dialect) => {
  it('freeRamBytes matches the dialect program RAM budget', () => {
    expect(facts.freeRamBytes).toBe(dialect.programRamBytes);
  });

  it('addressNotation matches the dialect (default hex)', () => {
    expect(facts.addressNotation).toBe(dialect.addressNotation ?? 'hex');
  });

  it('hexPrefix matches the dialect memory-write syntax', () => {
    expect(facts.hexPrefix).toBe(dialect.memoryWrites?.hexPrefix);
  });

  it('statementSepChar matches the dialect memory-write syntax', () => {
    expect(facts.statementSepChar).toBe(dialect.memoryWrites?.statementSep);
  });

  it('memoryWriteSyntax matches the dialect write forms', () => {
    const forms = dialect.memoryWrites?.forms;
    // No declared forms means the dialect writes memory with POKE.
    if (!forms || forms.includes('poke')) {
      expect(facts.memoryWriteSyntax).toMatch(/POKE/);
    }
    if (forms?.includes('indirection')) {
      expect(facts.memoryWriteSyntax).toMatch(/[?!]/);
    }
  });
});
