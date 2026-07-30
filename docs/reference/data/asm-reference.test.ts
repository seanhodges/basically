import { describe, expect, it } from 'vitest';
import type { ReferenceTableData } from './types';
import { m6502Engine } from '../../../src/asm/m6502';
import { z80Engine } from '../../../src/asm/z80';
import type { AsmEngine } from '../../../src/asm/types';
import { z80AssemblyReference } from './z80-assembly';
import { m6502AssemblyReference } from './m6502-assembly';

/** The four assembler directives both engines add on top of the CPU mnemonics. */
const DIRECTIVES = ['ORG', 'DB', 'DW', 'DS'];

const SETS: [string, ReferenceTableData, AsmEngine][] = [
  ['z80', z80AssemblyReference, z80Engine],
  ['6502', m6502AssemblyReference, m6502Engine],
];

describe.each(SETS)('assembly reference data: %s', (_id, data, engine) => {
  it('has a title, machine list and entries', () => {
    expect(data.title).toBeTruthy();
    expect(data.machines.length).toBeGreaterThan(0);
    expect(data.entries.length).toBeGreaterThan(0);
  });

  it('every entry is structurally complete', () => {
    for (const e of data.entries) {
      expect(e.name, 'name').toBeTruthy();
      expect(['instruction', 'directive']).toContain(e.kind);
      expect(e.syntax, `syntax for ${e.name}`).toBeTruthy();
      expect(e.description.length, `description for ${e.name}`).toBeGreaterThan(
        0,
      );
    }
  });

  it('has no duplicate names', () => {
    const names = data.entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  // The mirror of the BASIC pages' domain check: a CPU mnemonic has no BASIC
  // capability, so `domain` stays absent here. `ReferenceEntry` makes it
  // optional purely to allow that, which no type can enforce - hence the test.
  it('carries no capability domain', () => {
    for (const e of data.entries) {
      expect(e.domain, `domain for ${e.name}`).toBeUndefined();
    }
  });

  // The heart of the sync guard: the page lists exactly the assembler's own
  // instruction set - every mnemonic the engine can encode, and nothing it
  // cannot. `engine.mnemonics` includes the directives, so subtract those.
  it('covers exactly the engine mnemonics (no more, no fewer)', () => {
    const engineInstructions = [...engine.mnemonics]
      .filter((m) => !DIRECTIVES.includes(m))
      .sort();
    const documented = data.entries
      .filter((e) => e.kind === 'instruction')
      .map((e) => e.name)
      .sort();
    expect(documented).toEqual(engineInstructions);
  });

  it('documents every directive as a directive row', () => {
    const documented = data.entries
      .filter((e) => e.kind === 'directive')
      .map((e) => e.name)
      .sort();
    expect(documented).toEqual([...DIRECTIVES].sort());
  });
});
