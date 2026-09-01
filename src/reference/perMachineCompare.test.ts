/**
 * The comparison over the *real* reference tables, machine by machine.
 *
 * compare.test.ts proves the diff logic on fixtures; this proves the
 * shipped data flows through it correctly. Each case below is a defect the
 * page-keyed comparison actually produced, kept here so it cannot come back:
 * the rows a page carries are the union of what its machines have, and reading
 * that union as one machine's is what put PET-only disk commands in a C64 port
 * and offered a CPC 464 commands only a 6128 has.
 */
import { describe, expect, it } from 'vitest';
import { bbcReference } from './bbc';
import { commodoreReference } from './commodore';
import { cpcReference } from './cpc';
import { sinclairReference } from './sinclair';
import { portingFacts } from './facts';
import { keywordEquivalences } from './porting';
import { diffKeywords, tableForMachine } from './compare';

/** The keyword diff between two machines, as the page computes it. */
function diffBetween(
  source: { page: Parameters<typeof tableForMachine>[0]; machine: string },
  target: { page: Parameters<typeof tableForMachine>[0]; machine: string },
  slugs: { from: string; to: string },
) {
  return diffKeywords(
    tableForMachine(source.page, source.machine),
    tableForMachine(target.page, target.machine),
    { ...slugs, equivalences: keywordEquivalences },
  );
}

const names = (entries: { name: string }[]) => entries.map((e) => e.name);

describe('Commodore machines are compared as machines', () => {
  // BASIC 4.0's disk commands exist on the PET alone. A C64 program cannot be
  // using them, so a C64 port must not be asked to deal with them.
  const PET_ONLY = ['DLOAD', 'DIRECTORY', 'SCRATCH', 'HEADER'];

  it('does not ask a C64 port to replace PET-only disk commands', () => {
    const diff = diffBetween(
      { page: commodoreReference, machine: 'commodore64' },
      { page: bbcReference, machine: 'bbcmicro' },
      { from: 'commodore', to: 'bbc' },
    );
    for (const keyword of PET_ONLY) {
      expect(names(diff.mustReplace), keyword).not.toContain(keyword);
    }
  });

  it('does ask a PET port to replace them', () => {
    const diff = diffBetween(
      { page: commodoreReference, machine: 'pet' },
      { page: bbcReference, machine: 'bbcmicro' },
      { from: 'commodore', to: 'bbc' },
    );
    for (const keyword of PET_ONLY) {
      expect(names(diff.mustReplace), keyword).toContain(keyword);
    }
  });

  it('reports the disk commands as a gain when porting a C64 program to a PET', () => {
    const diff = diffBetween(
      { page: commodoreReference, machine: 'commodore64' },
      { page: commodoreReference, machine: 'pet' },
      { from: 'commodore', to: 'commodore' },
    );
    for (const keyword of PET_ONLY) {
      expect(names(diff.newlyAvailable), keyword).toContain(keyword);
    }
    expect(diff.mustReplace).toEqual([]);
  });

  it('finds no difference between a VIC-20 and a C64, which share BASIC V2', () => {
    const diff = diffBetween(
      { page: commodoreReference, machine: 'vic20' },
      { page: commodoreReference, machine: 'commodore64' },
      { from: 'commodore', to: 'commodore' },
    );
    expect(diff.mustReplace).toEqual([]);
    expect(diff.newlyAvailable).toEqual([]);
  });
});

describe('Amstrad machines are compared as machines', () => {
  const ELEVEN_ONE_ONLY = ['FILL', 'MASK', 'FRAME', 'CURSOR'];

  it('does not offer BASIC 1.1 commands when the target is a 464', () => {
    const diff = diffBetween(
      { page: bbcReference, machine: 'bbcmicro' },
      { page: cpcReference, machine: 'cpc464' },
      { from: 'bbc', to: 'cpc' },
    );
    for (const keyword of ELEVEN_ONE_ONLY) {
      expect(names(diff.newlyAvailable), keyword).not.toContain(keyword);
    }
  });

  it('does offer them when the target is a 6128', () => {
    const diff = diffBetween(
      { page: bbcReference, machine: 'bbcmicro' },
      { page: cpcReference, machine: 'cpc6128' },
      { from: 'bbc', to: 'cpc' },
    );
    for (const keyword of ELEVEN_ONE_ONLY) {
      expect(names(diff.newlyAvailable), keyword).toContain(keyword);
    }
  });

  // The pair that was previously uncomparable: one page, so no difference at
  // all. It is the twelve BASIC 1.1 additions, and nothing is lost going up.
  it('reports the 464 → 6128 port as twelve gains and no losses', () => {
    const diff = diffBetween(
      { page: cpcReference, machine: 'cpc464' },
      { page: cpcReference, machine: 'cpc6128' },
      { from: 'cpc', to: 'cpc' },
    );
    expect(diff.mustReplace).toEqual([]);
    expect(diff.newlyAvailable).toHaveLength(12);
  });

  it('reports the 6128 → 464 port as twelve commands to replace', () => {
    const diff = diffBetween(
      { page: cpcReference, machine: 'cpc6128' },
      { page: cpcReference, machine: 'cpc464' },
      { from: 'cpc', to: 'cpc' },
    );
    expect(diff.mustReplace).toHaveLength(12);
    expect(diff.newlyAvailable).toEqual([]);
  });
});

describe('BBC and Spectrum variants', () => {
  it('offers EDIT when porting from a Model B to a Master', () => {
    const diff = diffBetween(
      { page: bbcReference, machine: 'bbcmicro' },
      { page: bbcReference, machine: 'bbcmaster' },
      { from: 'bbc', to: 'bbc' },
    );
    expect(names(diff.newlyAvailable)).toEqual(['EDIT']);
    expect(diff.mustReplace).toEqual([]);
  });

  it('offers SPECTRUM and PLAY when porting from a 48K to a 128K', () => {
    const diff = diffBetween(
      { page: sinclairReference, machine: 'zxspectrum' },
      { page: sinclairReference, machine: 'zxspectrum128' },
      { from: 'zxspectrum', to: 'zxspectrum128' },
    );
    expect(names(diff.newlyAvailable).sort()).toEqual(['PLAY', 'SPECTRUM']);
    expect(diff.mustReplace).toEqual([]);
  });
});

describe('hardware facts answer for the machine chosen', () => {
  const factsFor = (id: string) => portingFacts.find((f) => f.id === id)!;

  // The headline defect: one page meant one free-RAM figure, and it was the
  // C64's. A VIC-20 has a tenth of it.
  it('gives each Commodore machine its own free RAM', () => {
    expect(factsFor('commodore64').freeRamBytes).toBe(38911);
    expect(factsFor('pet').freeRamBytes).toBe(31743);
    expect(factsFor('vic20').freeRamBytes).toBe(3583);
  });

  it('gives the BBC Master its own figures and inherits the rest', () => {
    const master = factsFor('bbcmaster');
    const micro = factsFor('bbcmicro');
    expect(master.freeRamBytes).toBe(28160);
    expect(master.programStart).toBe('&0E00');
    // Same BASIC, so every language rule is the Model B's, stated once.
    expect(master.lineNumberRange).toBe(micro.lineNumberRange);
    expect(master.variableNaming).toBe(micro.variableNaming);
    expect(master.screen).toBe(micro.screen);
  });

  it('describes the PET as monochrome rather than borrowing the C64 colours', () => {
    expect(factsFor('pet').colour).toMatch(/^None/);
    expect(factsFor('commodore64').colour).toMatch(/16 colours/);
  });

  it('leaves the CPCs identical on every crosschecked figure', () => {
    const a = factsFor('cpc464');
    const b = factsFor('cpc6128');
    expect(b.freeRamBytes).toBe(a.freeRamBytes);
    expect(b.screenBase).toBe(a.screenBase);
    expect(b.programStart).toBe(a.programStart);
  });
});
