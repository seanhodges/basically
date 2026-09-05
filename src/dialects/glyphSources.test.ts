import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { dialects } from './registry';
import {
  ADDRESS_SIGIL,
  GLYPH_SOURCES,
  formatAddress,
  glyphLocation,
  petsciiToScreen,
  screenToPetscii,
  sourceFor,
} from './glyphSources';
import { letterCaseFor } from './letterCase';

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
function render(
  dialectId: string,
  code: number,
  height: number,
  width: number,
  lsbFirst: boolean,
): string[] {
  const loc = glyphLocation(dialectId, code);
  if (!loc || loc.kind !== 'rom')
    throw new Error(`${dialectId} 0x${code.toString(16)} is not in a ROM`);
  const rom = new Uint8Array(readFileSync(join(ROM_DIR, loc.file)));
  const rows: string[] = [];
  for (let i = 0; i < height; i++) {
    const byte = rom[loc.fileOffset + i] ?? 0;
    // Which end of the byte is the left of the glyph is the machine's choice,
    // and the PMD 85 is the one that puts bit 0 there. Rendering every anchor
    // MSB-first would print its font mirrored, and the mirrored bitmap would
    // then be pinned as if it were the shape.
    const bits = Array.from({ length: width }, (_, x) =>
      (byte >> (lsbFirst ? x : width - 1 - x)) & 1 ? '#' : '.',
    );
    rows.push(bits.join(''));
  }
  return rows;
}

/**
 * Anchor per dialect: the code that means "A", and the bitmap it must draw.
 *
 * `lsbFirst` is the PMD 85's, whose video circuit shifts each byte out low bit
 * first and displays only six of the eight; every other machine here puts the
 * leftmost pixel in bit 7.
 */
const ANCHORS: Record<
  string,
  { code: number; rows: string[]; width?: number; lsbFirst?: boolean }
> = {
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
  // Six pixels wide, low bit leftmost: the two facts about this screen that a
  // wrong reading makes plausible rather than obvious.
  pmd85: {
    code: 0x41,
    width: 6,
    lsbFirst: true,
    rows: [
      '...#..',
      '..#.#.',
      '.#...#',
      '.#...#',
      '.#####',
      '.#...#',
      '.#...#',
      '......',
    ],
  },
  cpc664: {
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
  // Screen-code indexed, like the Commodores: ATASCII 'A' (0x41) is screen
  // code 0x21, read off the booted ROM's own font table.
  atari800: {
    code: 0x41,
    rows: [
      '........',
      '...##...',
      '..####..',
      '.##..##.',
      '.##..##.',
      '.######.',
      '.##..##.',
      '........',
    ],
  },
  atari400: {
    code: 0x41,
    rows: [
      '........',
      '...##...',
      '..####..',
      '.##..##.',
      '.##..##.',
      '.######.',
      '.##..##.',
      '........',
    ],
  },
  // The MSX pattern is left-aligned in an 8-bit row because SCREEN 0 shows
  // only the leftmost six columns; its A is five wide and sits hard against
  // the left edge, unlike every centred font above.
  hb10p: {
    code: 0x41,
    rows: [
      '..#.....',
      '.#.#....',
      '#...#...',
      '#...#...',
      '#####...',
      '#...#...',
      '#...#...',
      '........',
    ],
  },
};

/**
 * Dialect ids with no glyph source of their own - see the assertion that pins
 * this set at the foot of the file.
 */
const WITHOUT_GLYPHS = new Set(['altair8800', 'ge235']);

/**
 * The code that means "A" on a dialect with no ROM anchor above and no ASCII
 * `A` either. The Apple I's display and keyboard both carry bit 7 as part of
 * the code, so its letters sit at 0xC1-0xDA; on the Apple II bit 7 selects
 * normal video rather than another shape, and the plain letters land at the
 * same codes.
 */
const LETTER_A: Record<string, number> = { apple1: 0xc1, apple2: 0xc1 };

/**
 * The same claim again for lower case, on the machines that have any.
 *
 * Every anchor above is the letter `A`, which is precisely the letter a machine
 * with no lower case draws exactly as one that has it - so the table above
 * cannot tell the two apart, and a source that claimed shapes its machine
 * cannot draw would pass it. These pin the other half.
 */
const LOWER_ANCHORS: Record<
  string,
  { code: number; rows: string[]; width?: number; lsbFirst?: boolean }
> = {
  zxspectrum: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '..###...',
      '.....#..',
      '..####..',
      '.#...#..',
      '..####..',
      '........',
    ],
  },
  zxspectrum128: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '..###...',
      '.....#..',
      '..####..',
      '.#...#..',
      '..####..',
      '........',
    ],
  },
  bbcmicro: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '..####..',
      '.....##.',
      '..#####.',
      '.##..##.',
      '..#####.',
      '........',
    ],
  },
  bbcmaster: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '..####..',
      '.....##.',
      '..#####.',
      '.##..##.',
      '..#####.',
      '........',
    ],
  },
  cpc464: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '.####...',
      '....##..',
      '.#####..',
      '##..##..',
      '.###.##.',
      '........',
    ],
  },
  cpc664: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '.####...',
      '....##..',
      '.#####..',
      '##..##..',
      '.###.##.',
      '........',
    ],
  },
  cpc6128: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '.####...',
      '....##..',
      '.#####..',
      '##..##..',
      '.###.##.',
      '........',
    ],
  },
  // Six wide and low bit leftmost, as its capital above.
  pmd85: {
    code: 0x61,
    width: 6,
    lsbFirst: true,
    rows: [
      '......',
      '......',
      '..##..',
      '....#.',
      '..###.',
      '.#..#.',
      '..###.',
      '......',
    ],
  },
  hb10p: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '.###....',
      '....#...',
      '.####...',
      '#...#...',
      '.####...',
      '........',
    ],
  },
  // ATASCII 'a' (0x61) is screen code 0x61 too - this is the one run where the
  // two numberings agree, per atasciiToScreenCode's own "unmoved" branch.
  atari800: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '..####..',
      '.....##.',
      '..#####.',
      '.##..##.',
      '..#####.',
      '........',
    ],
  },
  atari400: {
    code: 0x61,
    rows: [
      '........',
      '........',
      '..####..',
      '.....##.',
      '..#####.',
      '.##..##.',
      '..#####.',
      '........',
    ],
  },
};

/**
 * The machines that draw lower case from a bank this table does not declare.
 *
 * The Commodores carry their lower case in the character ROM's *second*
 * 128-glyph set, which the machine switches to at run time; only the first is
 * declared as a source here, so there is no lower-case shape to anchor. Named
 * rather than derived, so a machine cannot join them by omission.
 */
const LOWER_CASE_UNDECLARED = new Set(['commodore64', 'pet', 'vic20']);

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
      expect(
        render(
          id,
          anchor.code,
          anchor.rows.length,
          anchor.width ?? 8,
          anchor.lsbFirst ?? false,
        ),
      ).toEqual(anchor.rows);
    });

    it('resolves the anchor to a machine address inside the image', () => {
      const loc = glyphLocation(id, anchor.code);
      expect(loc?.kind).toBe('rom');
      if (loc?.kind !== 'rom') return;
      const rom = readFileSync(join(ROM_DIR, loc.file));
      expect(loc.fileOffset + loc.stride).toBeLessThanOrEqual(rom.length);
    });
  });

  describe('lower case', () => {
    it('anchors it on every ROM-backed machine declared to draw it', () => {
      const expected = romBacked.filter(
        (id) =>
          letterCaseFor(id)!.lowerCase !== 'none' &&
          !LOWER_CASE_UNDECLARED.has(id),
      );
      expect(Object.keys(LOWER_ANCHORS).sort()).toEqual(expected.sort());
    });

    describe.each(Object.keys(LOWER_ANCHORS))('%s', (id) => {
      const anchor = LOWER_ANCHORS[id]!;
      it('draws its lower-case anchor at the declared address', () => {
        expect(
          render(
            id,
            anchor.code,
            anchor.rows.length,
            anchor.width ?? 8,
            anchor.lsbFirst ?? false,
          ),
        ).toEqual(anchor.rows);
      });
    });

    it('accounts for no shape at all on a machine declared to have none', () => {
      for (const { id } of dialects) {
        const facts = letterCaseFor(id)!;
        if (facts.lowerCase !== 'none') continue;
        // Only askable where the encoding keeps the two cases apart: on a
        // folding machine the lower-case letter *is* the capital's own code,
        // and of course that has a shape.
        if (facts.encoding === 'folded') continue;
        expect(sourceFor(id, 0x61), id).toBeUndefined();
      }
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

    it('reports the SAM font as packed, with no address of its own', () => {
      // The shapes are in the image, but compressed: the ROM unpacks the table
      // into RAM before anything draws from it, so a file offset would name
      // bytes that are not the glyph and the address it ends up at is RAM.
      expect(glyphLocation('samcoupe', 0x41)).toEqual({
        kind: 'packed',
        file: 'samcoupe/samcoupe.rom',
        table: 'CHARSRC',
        index: 0x41 - 0x20,
      });
      // And its block graphics are generated, as every machine's here are.
      expect(glyphLocation('samcoupe', 0x8f)).toEqual({
        kind: 'logic',
        by: "the ROM's POUDG",
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

  describe('address notation', () => {
    it('names a sigil for every registered dialect', () => {
      expect(Object.keys(ADDRESS_SIGIL).sort()).toEqual(
        dialects.map((d) => d.id).sort(),
      );
    });

    it('agrees with the hex prefix the dialect already declares', () => {
      // Where a machine's BASIC has a hex literal the dialect declares its
      // prefix for the POKE parser. Rendering must use the same character, or
      // the index would spell an address differently from the code the user
      // would write to reach it.
      for (const dialect of dialects) {
        const declared = dialect.memoryWrites?.hexPrefix;
        if (declared === undefined) continue;
        expect(ADDRESS_SIGIL[dialect.id], dialect.id).toBe(declared);
      }
    });

    it('writes each address the way its machine does', () => {
      expect(formatAddress('bbcmicro', 0xc000)).toBe('&C000');
      expect(formatAddress('cpc464', 0x3800)).toBe('&3800');
      expect(formatAddress('atom', 0x8000)).toBe('#8000');
      expect(formatAddress('commodore64', 0xd000)).toBe('$D000');
      expect(formatAddress('zxspectrum', 0x3d00)).toBe('$3D00');
    });

    it("never writes an address in this project's own notation", () => {
      // 0x is the notation of the code, not of any machine here. If a dialect
      // ever falls through to the default, the index stops being searchable in
      // the form its reader has.
      for (const dialect of dialects) {
        expect(formatAddress(dialect.id, 0x1234), dialect.id).not.toContain(
          '0x',
        );
      }
    });
  });

  describe('the addresses a machine names for itself', () => {
    it('records the base as the documented number, with the code it names', () => {
      // The Spectrum's CHARS names code 0 while the first stored glyph is 0x20;
      // the BBC's &C000 names 0x20 directly. Keeping baseCode separate is what
      // lets `base` be the documented number on both without meaning two
      // different things.
      const romBase = (id: string) => {
        const source = GLYPH_SOURCES[id]!.find((s) => s.kind === 'rom');
        if (source?.kind !== 'rom') throw new Error(`${id} has no ROM source`);
        return source;
      };
      for (const id of ['zxspectrum', 'zxspectrum128']) {
        expect(romBase(id).base, id).toBe(0x3c00);
        expect(romBase(id).baseCode, id).toBe(0x00);
      }
      for (const id of ['bbcmicro', 'bbcmaster']) {
        expect(romBase(id).baseCode, id).toBe(0x20);
      }
      expect(romBase('bbcmicro').base).toBe(0xc000);
    });

    it('resolves an address as base + stride from the code the base names', () => {
      // The one formula every ROM source obeys. If baseCode and indexOf ever
      // disagree, an address silently shifts by a whole number of glyphs.
      for (const [id, sources] of Object.entries(GLYPH_SOURCES)) {
        for (const source of sources) {
          if (source.kind !== 'rom' || source.base < 0) continue;
          // The Commodores and the Atari pair index by screen code, so the
          // step from baseCode is the mapping rather than the code itself;
          // they are checked against the character ROM by shape above instead.
          if (
            id === 'commodore64' ||
            id === 'vic20' ||
            id === 'pet' ||
            id === 'atari800' ||
            id === 'atari400'
          )
            continue;
          for (const code of source.codes) {
            const index = source.indexOf(code);
            if (index === undefined) continue;
            expect(index, `${id} 0x${code.toString(16)}`).toBe(
              code - source.baseCode,
            );
          }
        }
      }
    });

    it("takes the VIC-20's character ROM address from its memory map", () => {
      // vic20/memoryMap.ts declares the region at 0x8000; recording it as
      // "not established" here contradicted a fact the repo already held.
      const loc = glyphLocation('vic20', 0x41);
      expect(loc?.kind).toBe('rom');
      if (loc?.kind !== 'rom') return;
      expect(loc.address).toBe(0x8000 + 0x01 * 8);
    });

    it("leaves the PET's unestablished, because nothing establishes it", () => {
      // Its memory map declares no character-ROM region: the set is not
      // CPU-visible there, so an address would be invented rather than found.
      const loc = glyphLocation('pet', 0x41);
      expect(loc?.kind).toBe('rom');
      if (loc?.kind !== 'rom') return;
      expect(loc.address).toBe(-1);
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
  });

  describe('screenToPetscii', () => {
    it('round-trips every screen code back to a PETSCII code that maps to it', () => {
      // The forward map is many-to-one, so the inverse cannot return the code
      // it started from for every input - but whatever it returns must land
      // back on the same screen code, which is what makes a screen read agree
      // with the character ROM.
      for (let screen = 0x00; screen <= 0x7f; screen++) {
        const petscii = screenToPetscii(screen);
        expect(petscii, `screen 0x${screen.toString(16)}`).toBeDefined();
        expect(
          petsciiToScreen(petscii!),
          `screen 0x${screen.toString(16)} -> petscii 0x${petscii!.toString(16)}`,
        ).toBe(screen);
      }
    });

    it('picks the unshifted letters, so a screen read reads like a listing', () => {
      expect(screenToPetscii(0x01)).toBe(0x41); // A, not the 0xC1 shifted twin
      expect(screenToPetscii(0x1a)).toBe(0x5a); // Z
      expect(screenToPetscii(0x20)).toBe(0x20); // space
      expect(screenToPetscii(0x30)).toBe(0x30); // '0'
    });

    it('ignores the reverse-video flag', () => {
      for (const screen of [0x01, 0x20, 0x5e]) {
        expect(screenToPetscii(screen | 0x80)).toBe(screenToPetscii(screen));
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
        readFileSync(join(ROM_DIR, 'commodore64/chargen.bin')),
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
      // they sit at (the Sinclair charset is not ASCII - its 'A' is 0x26) -
      // unless it has no glyphs of its own at all, which is a claim in itself
      // and is pinned below.
      if (WITHOUT_GLYPHS.has(id)) continue;
      expect(
        sourceFor(id, ANCHORS[id]?.code ?? LETTER_A[id] ?? 0x41),
        id,
      ).toBeDefined();
    }
  });

  it('names the machines whose shapes are not theirs to account for', () => {
    // Two machines, for two versions of the same reason. The Altair has no
    // video hardware and no character generator: its shapes belong to whichever
    // terminal is plugged into the serial board. The GE-235's terminal is a
    // Teletype, where a shape is a type bar rather than a bitmap anywhere.
    // Declared as a set rather than derived from the empty entry, so a dialect
    // cannot join it by someone forgetting to fill its sources in.
    const empty = Object.entries(GLYPH_SOURCES)
      .filter(([, sources]) => sources.length === 0)
      .map(([id]) => id);
    expect(empty.sort()).toEqual([...WITHOUT_GLYPHS].sort());
  });
});
