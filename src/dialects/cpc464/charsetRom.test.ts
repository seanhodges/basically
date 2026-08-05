import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CPC_GLYPHS, cpcCharset } from './charset';

/**
 * Check the CPC's upper-range graphics characters against the shapes the
 * firmware ROM actually draws, rather than against a character-set table copied
 * from a manual.
 *
 * `public/roms/cpc464/cpc464.rom` is the 32K lower+upper pair; the 256-glyph
 * character matrix is the last 2K of the 16K OS half, eight bytes per glyph,
 * one bit per pixel. {@link FONT_BASE} is pinned by `agrees with the codes
 * already mapped` below, which fails if the table is not where it is read from.
 *
 * The two families here are checked structurally, so the test says something
 * the table does not:
 *
 * - **0xC0-0xCA** are a diamond built from four diagonal edges. The edges are
 *   read out of the four singleton codes and every composite is asserted to be
 *   exactly the union of its parts - the same relation Unicode's
 *   U+1FBA0-U+1FBAE family encodes, which is why those are the characters.
 * - **0xCE, 0xCF and 0xD8-0xDF** are one chequer dither masked to a region of
 *   the cell. Each region is stated as a predicate and the bitmap has to match
 *   it exactly, so a mis-assigned half or triangle fails.
 */

const ROM = join(__dirname, '../../../public/roms/cpc464/cpc464.rom');
const FONT_BASE = 0x3800;

const rom = new Uint8Array(readFileSync(ROM));

/** The lit pixels of a glyph, as `y * 8 + x` indices. */
function pixels(code: number): Set<number> {
  const base = FONT_BASE + code * 8;
  const lit = new Set<number>();
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      if (rom[base + y]! & (1 << (7 - x))) lit.add(y * 8 + x);
  return lit;
}

const union = (...sets: Array<Set<number>>): Set<number> =>
  new Set(sets.flatMap((s) => [...s]));

const sorted = (s: Set<number>): number[] => [...s].sort((a, b) => a - b);

/** The four diagonal edges, taken from the codes that draw them alone. */
const EDGE = { nw: pixels(0xc0), ne: pixels(0xc1), se: pixels(0xc2), sw: pixels(0xc3) }; // prettier-ignore

/** Which edges each composite code lights, per the ROM shapes above. */
const DIAMOND: Record<number, Array<keyof typeof EDGE>> = {
  0xc4: ['nw', 'ne'],
  0xc5: ['ne', 'se'],
  0xc6: ['se', 'sw'],
  0xc7: ['nw', 'sw'],
  0xc8: ['nw', 'se'],
  0xc9: ['ne', 'sw'],
  0xca: ['nw', 'ne', 'se', 'sw'],
};

/**
 * Where each dithered code carries ink, and on which phase of the chequer.
 * Phase 0 lights the pixels where `(y + x)` is even. The two lower triangles
 * run on the opposite phase, which keeps their ink against the hypotenuse.
 */
const DITHER: Record<
  number,
  { phase: 0 | 1; inside: (y: number, x: number) => boolean }
> = {
  0xcf: { phase: 0, inside: () => true },
  0xd8: { phase: 0, inside: (y) => y < 4 },
  0xd9: { phase: 0, inside: (_y, x) => x >= 4 },
  0xda: { phase: 0, inside: (y) => y >= 4 },
  0xdb: { phase: 0, inside: (_y, x) => x < 4 },
  0xdc: { phase: 0, inside: (y, x) => x + y < 7 },
  0xdd: { phase: 0, inside: (y, x) => x >= y },
  0xde: { phase: 1, inside: (y, x) => x + y >= 7 },
  0xdf: { phase: 1, inside: (y, x) => x < y },
};

describe('CPC charset against the firmware ROM font', () => {
  it('agrees with the codes already mapped', () => {
    // 0x8F is the solid block and 0x20 is blank: if the font were read at the
    // wrong offset these would be some other pair of shapes.
    expect(pixels(0x8f).size).toBe(64);
    expect(pixels(0x20).size).toBe(0);
  });

  it('draws 0x80 blank, which is why it keeps its escape', () => {
    expect(pixels(0x80).size).toBe(0);
    expect(CPC_GLYPHS[0x80]).toBeUndefined();
  });

  it('builds the diamond composites out of the four singleton edges', () => {
    // The four edges together are the whole diamond. They are not disjoint:
    // adjacent edges share the vertex pixel they meet at, which is why 0xC4's
    // apex is as thick as a single edge's rather than twice it.
    expect(sorted(union(...Object.values(EDGE)))).toEqual(sorted(pixels(0xca)));
    for (const edge of Object.values(EDGE))
      expect(edge.size).toBeGreaterThan(0);

    for (const [code, parts] of Object.entries(DIAMOND)) {
      expect(
        sorted(pixels(Number(code))),
        `0x${Number(code).toString(16)}`,
      ).toEqual(sorted(union(...parts.map((p) => EDGE[p]))));
    }
  });

  it('gives every diamond code its own character in the U+1FBA0 family', () => {
    const codes = [0xc0, 0xc1, 0xc2, 0xc3, ...Object.keys(DIAMOND).map(Number)];
    const points = codes.map((c) => CPC_GLYPHS[c]!.codePointAt(0)!);
    for (const point of points) {
      expect(point).toBeGreaterThanOrEqual(0x1fba0);
      expect(point).toBeLessThanOrEqual(0x1fbae);
    }
    expect(new Set(points).size).toBe(codes.length);
  });

  it('masks one chequer dither to each region', () => {
    for (const [code, { phase, inside }] of Object.entries(DITHER)) {
      const lit = pixels(Number(code));
      const want = new Set<number>();
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          if (inside(y, x) && (y + x) % 2 === phase) want.add(y * 8 + x);
      expect(sorted(lit), `0x${Number(code).toString(16)}`).toEqual(
        sorted(want),
      );
    }
  });

  it('draws 0xCE as the same dither at twice the pitch', () => {
    const lit = pixels(0xce);
    const want = new Set<number>();
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        if (((y >> 1) + (x >> 1)) % 2 === 0) want.add(y * 8 + x);
    expect(sorted(lit)).toEqual(sorted(want));
    // Same 50% coverage as 0xCF, in 2x2 tiles rather than single pixels.
    expect(lit.size).toBe(pixels(0xcf).size);
    expect(sorted(lit)).not.toEqual(sorted(pixels(0xcf)));
  });

  it('round-trips every mapped graphics character back to its byte', () => {
    for (const code of [
      ...Object.keys(DIAMOND).map(Number),
      ...Object.keys(DITHER).map(Number),
      0xc0,
      0xc1,
      0xc2,
      0xc3,
      0xce,
    ]) {
      const text = cpcCharset.toUnicode([code]);
      expect([...cpcCharset.toMachine(text)], `0x${code.toString(16)}`).toEqual(
        [code],
      );
    }
  });
});
