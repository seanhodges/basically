import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { dialects } from './registry';
import {
  GLYPH_SOURCES,
  glyphLocation,
  petsciiToScreen,
  sourceFor,
} from './glyphSources';

/**
 * Prove the declared glyph addresses actually point at the fonts.
 *
 * This is the whole guard, and it has to assert a *shape*: a wrong base is
 * otherwise invisible, because every offset into a ROM returns some bytes and
 * most of them look font-ish if you squint. So each ROM-backed source names one
 * anchor character and the exact bitmap it must render, eyeballed once and
 * pinned here. Every machine's "A" below is visibly its own - the ZX80's is
 * wider than the ZX81's, the VIC-20 and PET have a pointed apex the C64 has
 * not, the CPC's is a row taller - which is what makes them worth asserting
 * rather than a formality.
 */

const ROM_DIR = join(__dirname, '../../public/roms');

/** The bitmap for a dialect's `code`, as one string per row of pixels. */
function render(dialectId: string, code: number, height: number): string[] {
  const loc = glyphLocation(dialectId, code);
  if (!loc || loc.kind !== 'rom')
    throw new Error(`${dialectId} 0x${code.toString(16)} is not in a ROM`);
  const rom = new Uint8Array(readFileSync(join(ROM_DIR, loc.file)));
  const rows: string[] = [];
  for (let i = 0; i < height; i++) {
    const byte = rom[loc.fileOffset + i] ?? 0;
    rows.push(
      byte.toString(2).padStart(8, '0').replace(/0/g, '.').replace(/1/g, '#'),
    );
  }
  return rows;
}

/** Anchor per dialect: the code that means "A", and the bitmap it must draw. */
const ANCHORS: Record<string, { code: number; rows: string[] }> = {
  // The Sinclair charset is not ASCII: 'A' is 0x26.
  zx80: {
    code: 0x26,
    rows: [
      '........',
      '..#####.',
      '.#.....#',
      '.#.....#',
      '.#######',
      '.#.....#',
      '.#.....#',
      '........',
    ],
  },
  zx81: {
    code: 0x26,
    rows: [
      '........',
      '..####..',
      '.#....#.',
      '.#....#.',
      '.######.',
      '.#....#.',
      '.#....#.',
      '........',
    ],
  },
  zxspectrum: {
    code: 0x41,
    rows: [
      '........',
      '..####..',
      '.#....#.',
      '.#....#.',
      '.######.',
      '.#....#.',
      '.#....#.',
      '........',
    ],
  },
  zxspectrum128: {
    code: 0x41,
    rows: [
      '........',
      '..####..',
      '.#....#.',
      '.#....#.',
      '.######.',
      '.#....#.',
      '.#....#.',
      '........',
    ],
  },
  bbcmicro: {
    code: 0x41,
    rows: [
      '..####..',
      '.##..##.',
      '.##..##.',
      '.######.',
      '.##..##.',
      '.##..##.',
      '.##..##.',
      '........',
    ],
  },
  bbcmaster: {
    code: 0x41,
    rows: [
      '..####..',
      '.##..##.',
      '.##..##.',
      '.######.',
      '.##..##.',
      '.##..##.',
      '.##..##.',
      '........',
    ],
  },
  commodore64: {
    code: 0x41,
    rows: [
      '...##...',
      '..####..',
      '.##..##.',
      '.######.',
      '.##..##.',
      '.##..##.',
      '.##..##.',
      '........',
    ],
  },
  vic20: {
    code: 0x41,
    rows: [
      '...##...',
      '..#..#..',
      '.#....#.',
      '.######.',
      '.#....#.',
      '.#....#.',
      '.#....#.',
      '........',
    ],
  },
  pet: {
    code: 0x41,
    rows: [
      '...##...',
      '..#..#..',
      '.#....#.',
      '.######.',
      '.#....#.',
      '.#....#.',
      '.#....#.',
      '........',
    ],
  },
  cpc464: {
    code: 0x41,
    rows: [
      '...##...',
      '..####..',
      '.##..##.',
      '.##..##.',
      '.######.',
      '.##..##.',
      '.##..##.',
      '........',
    ],
  },
  cpc6128: {
    code: 0x41,
    rows: [
      '...##...',
      '..####..',
      '.##..##.',
      '.##..##.',
      '.######.',
      '.##..##.',
      '.##..##.',
      '........',
    ],
  },
};

/** Dialect ids that declare at least one ROM-backed source. */
const romBacked = Object.entries(GLYPH_SOURCES)
  .filter(([, sources]) => sources.some((s) => s.kind === 'rom'))
  .map(([id]) => id);

describe('glyph sources', () => {
  it('covers every registered dialect', () => {
    // A dialect with no entry has no recorded provenance for any of its
    // shapes, which is the state this table exists to end.
    expect(Object.keys(GLYPH_SOURCES).sort()).toEqual(
      dialects.map((d) => d.id).sort(),
    );
  });

  it('names an anchor for every ROM-backed dialect', () => {
    // Without this, adding a ROM source without an anchor would silently skip
    // the only assertion that can catch a wrong base.
    expect(romBacked.sort()).toEqual(Object.keys(ANCHORS).sort());
  });

  describe.each(romBacked)('%s', (id) => {
    const anchor = ANCHORS[id]!;

    it('draws its anchor character at the declared address', () => {
      expect(render(id, anchor.code, anchor.rows.length)).toEqual(anchor.rows);
    });

    it('resolves the anchor to a machine address inside the image', () => {
      const loc = glyphLocation(id, anchor.code);
      expect(loc?.kind).toBe('rom');
      if (loc?.kind !== 'rom') return;
      const rom = readFileSync(join(ROM_DIR, loc.file));
      expect(loc.fileOffset + loc.stride).toBeLessThanOrEqual(rom.length);
    });
  });

  it('keeps the machine address and the file offset apart where they differ', () => {
    // The 128K Spectrum's font is in the second bank of a dual-ROM image, so
    // its file offset is a whole bank above the address the machine sees. If
    // these two ever collapse into one field this is what fails.
    const loc = glyphLocation('zxspectrum128', 0x41);
    expect(loc?.kind).toBe('rom');
    if (loc?.kind !== 'rom') return;
    expect(loc.address).toBe(0x3d00 + (0x41 - 0x20) * 8);
    expect(loc.fileOffset).toBe(0x7d00 + (0x41 - 0x20) * 8);
  });

  describe('the shapes nothing stores', () => {
    it('reports the BBC mosaics as generated, not addressed', () => {
      // The SAA5050 builds a mosaic from the code's own bits; there is no
      // bitmap for it anywhere, so an address would be a fiction.
      for (const code of [0xa0, 0xb5, 0xe0, 0xff]) {
        expect(glyphLocation('bbcmicro', code)).toEqual({
          kind: 'logic',
          by: 'SAA5050',
        });
      }
    });

    it('reports the Atom semigraphics as generated', () => {
      for (const code of [0xa0, 0xc0, 0xdf]) {
        expect(glyphLocation('atom', code)).toEqual({
          kind: 'logic',
          by: 'MC6847 SG6',
        });
      }
    });

    it('reports the TRS-80 block graphics as generated', () => {
      expect(glyphLocation('trs80', 0x81)).toEqual({
        kind: 'logic',
        by: 'video logic',
      });
    });

    it('gives the in-chip fonts the chip index rather than an address', () => {
      // The MCM6670 and the SAA5050 hold their alphanumerics in mask ROM the
      // CPU cannot reach, so the chip's own glyph index is the only address.
      expect(glyphLocation('trs80', 0x41)).toEqual({
        kind: 'chip',
        chip: 'MCM6670',
        index: 0x41 - 0x20,
      });
      expect(glyphLocation('atom', 0x41)).toEqual({
        kind: 'chip',
        chip: 'MC6847',
        index: 0x01,
      });
    });
  });

  describe('petsciiToScreen', () => {
    it('maps the letters onto the character ROM the way the KERNAL does', () => {
      // 'A' is PETSCII 0x41 and screen code 0x01 - the offset that makes the
      // Commodore character ROM readable at all.
      expect(petsciiToScreen(0x41)).toBe(0x01);
      expect(petsciiToScreen(0x5a)).toBe(0x1a); // Z
      expect(petsciiToScreen(0x20)).toBe(0x20); // space is its own screen code
    });

    it('has no glyph for the control codes', () => {
      for (const code of [0x00, 0x0d, 0x13, 0x91]) {
        expect(petsciiToScreen(code)).toBeUndefined();
      }
    });

    it('lands each graphics code on the shape petscii.ts names for it', () => {
      // The real crosscheck: walk PETSCII -> screen code -> character ROM and
      // check the bitmap is the shape the charset claims. A shifted mapping
      // would still produce plausible graphics, so the shapes are what pin it.
      const shapes: Array<[number, string, string[]]> = [
        [
          0xc1, // '♠'
          'spade',
          [
            '....#...',
            '...###..',
            '..#####.',
            '.#######',
            '.#######',
            '...###..',
            '..#####.',
            '........',
          ],
        ],
        [
          0xa1, // '▌'
          'left half block',
          Array.from({ length: 8 }, () => '####....'),
        ],
        [
          0xc3, // the horizontal line that is $C0's visual twin
          'horizontal line',
          [
            '........',
            '........',
            '........',
            '########',
            '########',
            '........',
            '........',
            '........',
          ],
        ],
      ];
      const rom = new Uint8Array(
        readFileSync(join(ROM_DIR, 'c64/chargen.bin')),
      );
      for (const [code, name, expected] of shapes) {
        const screen = petsciiToScreen(code)!;
        const rows = Array.from({ length: 8 }, (_, i) =>
          rom[screen * 8 + i]!.toString(2)
            .padStart(8, '0')
            .replace(/0/g, '.')
            .replace(/1/g, '#'),
        );
        expect(rows, `0x${code.toString(16)} should draw a ${name}`).toEqual(
          expected,
        );
      }
    });
  });

  it('claims no code twice within one dialect', () => {
    // Overlapping sources would make glyphLocation's answer depend on
    // declaration order, which is not a fact about the machine.
    for (const [id, sources] of Object.entries(GLYPH_SOURCES)) {
      const seen = new Map<number, string>();
      for (const source of sources) {
        for (const code of source.codes) {
          if (source.kind !== 'logic' && source.indexOf(code) === undefined)
            continue;
          const prev = seen.get(code);
          // The BBC genuinely has two fonts for one code - MODE 0-6 from the
          // MOS ROM and MODE 7 from the chip - so overlap there is real and
          // resolved by declaration order (the addressable one wins).
          if (prev && !id.startsWith('bbc'))
            throw new Error(
              `${id} 0x${code.toString(16)} claimed by ${prev} and ${source.kind}`,
            );
          seen.set(code, source.kind);
        }
      }
      // Every dialect accounts for at least its own letters, whatever code
      // they sit at (the Sinclair charset is not ASCII - its 'A' is 0x26).
      expect(sourceFor(id, ANCHORS[id]?.code ?? 0x41), id).toBeDefined();
    }
  });
});
