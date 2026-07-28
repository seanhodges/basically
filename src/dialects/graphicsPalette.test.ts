import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dialects } from './registry';

/**
 * The graphics palette is drawn the same way for every machine - dark ink on
 * light paper, the way the editor it types into draws the same character - and
 * `e2e/virtual-input/graphics-palette.spec.ts` checks that in a real browser,
 * looping over `e2e/paletteMachines.ts`.
 *
 * That list is only useful if it is the whole list, so pin it to the registry
 * here: a dialect that gains a palette (or loses one) fails until the specs'
 * list follows. Read as text rather than imported, so the Playwright-side file
 * stays free of anything that would pull the emulator cores into vitest.
 */

const LIST = join(__dirname, '../../e2e/paletteMachines.ts');

function listedMachines(): string[] {
  const source = readFileSync(LIST, 'utf8');
  const body = /PALETTE_MACHINES\s*=\s*\[([^\]]*)\]/.exec(source);
  if (!body) throw new Error(`no PALETTE_MACHINES array in ${LIST}`);
  return [...body[1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

describe('graphics palette machines', () => {
  it('e2e/paletteMachines.ts lists exactly the dialects with a palette', () => {
    const withPalette = dialects
      .filter((d) => d.keyboardLayout.graphicsPalette)
      .map((d) => d.id);
    expect(
      listedMachines(),
      'update e2e/paletteMachines.ts so the palette specs cover every machine that has one',
    ).toEqual(withPalette);
  });

  it('every palette entry carries a character and a way to reach it', () => {
    // A cell has to say how the machine produces its character: the key it is
    // printed on, or - where the machine printed no graphics on the keyboard at
    // all - the character code its BASIC takes. Never neither, and never an
    // empty string standing in for one.
    for (const dialect of dialects) {
      const palette = dialect.keyboardLayout.graphicsPalette;
      if (!palette) continue;
      for (const section of palette.sections) {
        expect(section.entries.length, dialect.id).toBeGreaterThan(0);
        for (const entry of section.entries) {
          const where = `${dialect.id} 0x${entry.code.toString(16)}`;
          expect(entry.char, where).not.toBe('');
          if (entry.key === undefined)
            expect(Number.isInteger(entry.code), where).toBe(true);
          else expect(entry.key, where).not.toBe('');
        }
      }
    }
  });

  it('a machine either labels every cell with a key or none of them', () => {
    // Mixing the two within one palette would read as an inconsistency rather
    // than as a fact about the machine.
    for (const dialect of dialects) {
      const palette = dialect.keyboardLayout.graphicsPalette;
      if (!palette) continue;
      const entries = palette.sections.flatMap((s) => s.entries);
      const keyed = entries.filter((e) => e.key !== undefined).length;
      expect([0, entries.length], dialect.id).toContain(keyed);
    }
  });
});
