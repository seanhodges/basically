/**
 * Where each machine's glyph shapes physically live.
 *
 * Every charset mapping in the project asserts "machine code `N` looks like
 * unicode character `X`". This records the other half of that claim: *where the
 * shape came from* on the real machine, so a mapping can be traced back to its
 * evidence and shapes can be searched for by address.
 *
 * The recorded address is the address **on the real machine** - the CPU address
 * the glyph's bitmap lives at - not the unicode code point (that is the IDE
 * font's identifier) and not the offset in the ROM image we happen to ship.
 * Those genuinely differ: the Spectrum 128's font sits at offset `0x7D00` of the
 * 32K dual-ROM image but at `0x3D00` on the machine, once that bank is paged in.
 * {@link RomGlyphSource} therefore carries both.
 *
 * Not every shape is stored anywhere, and pretending otherwise would be the
 * easy mistake. Three kinds:
 *
 * - {@link RomGlyphSource} - bitmaps in a ROM we ship, at a real address.
 * - {@link ChipGlyphSource} - bitmaps in a video chip's internal mask ROM. The
 *   CPU cannot address them at all, so what is recorded is the chip's own index
 *   into that ROM, which is the only address those parts have.
 * - {@link LogicGlyphSource} - no stored bitmap anywhere: the shape is produced
 *   combinationally from the bits of the code itself. This is what every
 *   machine's block graphics actually are, and it is why "which address is that
 *   mosaic at" has no answer.
 *
 * Read by `glyphSources.test.ts`, which reads each ROM at the declared offset
 * and checks a named anchor glyph renders as the character it should - a wrong
 * base is otherwise invisible, because every offset returns *some* bytes.
 */

/** Pixel dimensions of one character cell. */
export interface GlyphCell {
  w: number;
  h: number;
}

interface GlyphSourceBase {
  /** Machine character codes this source accounts for. */
  codes: number[];
  cell: GlyphCell;
  /** Where this claim comes from. */
  note: string;
}

/** Bitmaps stored in a ROM image under `public/roms/`. */
export interface RomGlyphSource extends GlyphSourceBase {
  kind: 'rom';
  /** Path under `public/roms/`. */
  file: string;
  /** CPU address of glyph index 0 on the real machine. */
  base: number;
  /**
   * A second address the machine's own documentation names for the same table,
   * where that documentation counts from a different character code. Recorded
   * so a reader who has the documented number finds this entry by searching for
   * it, rather than being told it does not exist.
   */
  documentedBase?: { address: number; as: string };
  /** Offset of that same glyph in the shipped image. */
  fileOffset: number;
  /** Bytes per glyph. */
  stride: number;
  /** Machine code -> glyph index, or undefined where the code has no bitmap. */
  indexOf: (code: number) => number | undefined;
}

/** Bitmaps inside a video chip's mask ROM - no CPU address exists. */
export interface ChipGlyphSource extends GlyphSourceBase {
  kind: 'chip';
  chip: 'SAA5050' | 'MC6847' | 'MCM6670';
  /** Machine code -> the chip's own index into its internal character ROM. */
  indexOf: (code: number) => number | undefined;
}

/** No stored bitmap: the shape is generated from the code's own bits. */
export interface LogicGlyphSource extends GlyphSourceBase {
  kind: 'logic';
  /** The part that generates it. */
  by: string;
}

export type GlyphSource = RomGlyphSource | ChipGlyphSource | LogicGlyphSource;

/**
 * How each machine writes a hex address, so an address is recorded in the form
 * a reader actually has: a BBC listing says `&C000`, a Commodore reference
 * `$D000`, the Atom `#8000`. `0x` is this project's notation, not any of theirs.
 *
 * Where the machine's BASIC has a hex literal, the dialect already declares its
 * prefix on `memoryWrites.hexPrefix`, and `glyphSources.test.ts` asserts these
 * agree so the two cannot drift. The rest are declared here because that field
 * is a *parser* concern and is deliberately absent for machines whose BASIC
 * cannot write hex at all - which is not the same as having no way to read one.
 *
 * Addresses are always stored and rendered in hex, including for the machines
 * whose manuals count in decimal; converting a decimal input is the searching
 * side's job, and carrying two spellings per line would only make the index
 * harder to read.
 */
export const ADDRESS_SIGIL: Record<string, string> = {
  // Acorn and Amstrad BASIC both write `&`; these mirror memoryWrites.hexPrefix.
  bbcmicro: '&',
  bbcmaster: '&',
  cpc464: '&',
  cpc6128: '&',
  // Atom BASIC writes `#` (`?#8000=1`), likewise mirrored.
  atom: '#',
  // Commodore BASIC has no hex literal - you POKE decimal - but every Commodore
  // reference, and this project's own memory maps, write `$D020`.
  commodore64: '$',
  vic20: '$',
  pet: '$',
  // Sinclair and the TRS-80 have no native hex notation at all. `$` follows the
  // precedent already set in docs/reference/data/facts.ts, which spells the
  // Spectrum's screen base `$4000`.
  zx80: '$',
  zx81: '$',
  zxspectrum: '$',
  zxspectrum128: '$',
  trs80: '$',
};

/** An address in the machine's own notation, e.g. `&C000`, `$D000`, `#8000`. */
export function formatAddress(dialectId: string, address: number): string {
  const sigil = ADDRESS_SIGIL[dialectId] ?? '0x';
  return `${sigil}${address.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Inclusive byte range. */
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** The common case: glyph index is the code, offset by where the table starts. */
const linear =
  (firstCode: number, lastCode: number) =>
  (code: number): number | undefined =>
    code >= firstCode && code <= lastCode ? code - firstCode : undefined;

/**
 * Commodore PETSCII code -> screen code, which is what the character ROM is
 * indexed by. The character generator knows nothing about PETSCII; the KERNAL
 * converts on the way to screen RAM.
 */
export function petsciiToScreen(code: number): number | undefined {
  if (code >= 0x20 && code <= 0x3f) return code;
  if (code >= 0x40 && code <= 0x5f) return code - 0x40;
  if (code >= 0x60 && code <= 0x7f) return code - 0x20;
  if (code >= 0xa0 && code <= 0xbf) return code - 0x40;
  if (code >= 0xc0 && code <= 0xdf) return code - 0x80;
  if (code >= 0xe0 && code <= 0xfe) return code - 0x80;
  if (code === 0xff) return 0x5e; // pi, which the ROM keeps at its 0x5E slot
  return undefined; // control codes have no glyph
}

/** The Sinclair 64-glyph font: codes 0x00-0x3F, with 0x80+ their inverses. */
const sinclairFont = (file: string, at: number): RomGlyphSource => ({
  kind: 'rom',
  file,
  base: at,
  fileOffset: at,
  stride: 8,
  cell: { w: 8, h: 8 },
  codes: range(0x00, 0x3f),
  indexOf: linear(0x00, 0x3f),
  note:
    'Sixty-four 8x8 glyphs, indexed straight by character code. The inverse-video ' +
    'codes 0x80-0xBF have no bitmap of their own - the hardware inverts these.',
});

/** The CPC character matrix, in the lower ROM. */
const cpcFont = (file: string): RomGlyphSource => ({
  kind: 'rom',
  file,
  base: 0x3800,
  fileOffset: 0x3800,
  stride: 8,
  cell: { w: 8, h: 8 },
  codes: range(0x00, 0xff),
  indexOf: linear(0x00, 0xff),
  note:
    'Indexed from code 0x00, not 0x20: reading it as 0x20-based puts "!" where ' +
    '"A" should be, which is how the origin was settled.',
});

/** The Commodore character ROM: 8x8 glyphs indexed by screen code. */
const commodoreFont = (
  file: string,
  base: number | null,
  lastScreenCode: number,
): RomGlyphSource => ({
  kind: 'rom',
  file,
  // Where the character ROM appears in the address space is a banking question;
  // -1 records "shipped image only, machine address not established".
  base: base ?? -1,
  fileOffset: 0x0000,
  stride: 8,
  cell: { w: 8, h: 8 },
  codes: range(0x20, 0xff),
  indexOf: (code) => {
    const screen = petsciiToScreen(code);
    return screen !== undefined && screen <= lastScreenCode
      ? screen
      : undefined;
  },
  note:
    'Indexed by screen code, not PETSCII - petsciiToScreen() does the conversion ' +
    'the KERNAL does.',
});

/**
 * Per dialect, the sources that between them account for its glyphs. More than
 * one where the machine has more than one: the BBC draws MODE 0-6 from the MOS
 * ROM and MODE 7 from the SAA5050.
 */
export const GLYPH_SOURCES: Record<string, GlyphSource[]> = {
  zx80: [sinclairFont('zx80.rom', 0x0e00)],
  zx81: [sinclairFont('zx81.rom', 0x1e00)],

  zxspectrum: [
    {
      kind: 'rom',
      file: 'zxspectrum.rom',
      base: 0x3d00,
      fileOffset: 0x3d00,
      stride: 8,
      cell: { w: 8, h: 8 },
      codes: range(0x20, 0x7f),
      indexOf: linear(0x20, 0x7f),
      documentedBase: { address: 0x3c00, as: 'CHARS (23606)' },
      note:
        'Ninety-six 8x8 glyphs from 0x20; the ROM ends exactly at the table end. ' +
        'The machine itself names a base 256 lower: the CHARS system variable ' +
        'holds 0x3C00, because the ROM finds a glyph at CHARS + 8*code with the ' +
        'code counted from 0, while the table starts at code 0x20. Both numbers ' +
        'reach the same bytes - spectrum128Machine.ts uses the CHARS one.',
    },
    {
      kind: 'logic',
      by: 'ULA / BASIC ROM',
      codes: range(0x80, 0x8f),
      cell: { w: 8, h: 8 },
      note: "The sixteen block graphics are drawn from the code's quadrant bits, not stored.",
    },
  ],
  zxspectrum128: [
    {
      kind: 'rom',
      file: 'zxspectrum128.rom',
      // The 48K BASIC ROM is the second 16K bank of the dual-ROM image, so the
      // file offset and the machine address differ by a whole bank.
      base: 0x3d00,
      fileOffset: 0x7d00,
      stride: 8,
      cell: { w: 8, h: 8 },
      codes: range(0x20, 0x7f),
      indexOf: linear(0x20, 0x7f),
      documentedBase: { address: 0x3c00, as: 'CHARS (23606)' },
      note:
        'Bank 1 of the 32K image; 0x3D00 once that bank is paged in. As the 48K, ' +
        'the machine names 0x3C00 - which is the number spectrum128Machine.ts ' +
        "uses for the boot menu's own text rendering.",
    },
    {
      kind: 'logic',
      by: 'ULA / BASIC ROM',
      codes: range(0x80, 0x8f),
      cell: { w: 8, h: 8 },
      note: 'As the 48K.',
    },
  ],

  bbcmicro: [
    {
      kind: 'rom',
      file: 'os.rom',
      base: 0xc000,
      fileOffset: 0x0000,
      stride: 8,
      cell: { w: 8, h: 8 },
      codes: range(0x20, 0x7f),
      indexOf: linear(0x20, 0x7f),
      note: 'MOS font, first thing in the OS ROM, which sits at 0xC000.',
    },
    {
      kind: 'chip',
      chip: 'SAA5050',
      codes: range(0x20, 0x7f),
      cell: { w: 6, h: 10 },
      indexOf: (code) => code & 0x7f,
      note:
        'MODE 7 alphanumerics live in the teletext chip, which the CPU cannot ' +
        'address. It only ever sees seven bits, so 0xA1 and 0x21 are one cell.',
    },
    {
      kind: 'logic',
      by: 'SAA5050',
      codes: [...range(0xa0, 0xbf), ...range(0xe0, 0xff)],
      cell: { w: 6, h: 10 },
      note:
        "The MODE 7 mosaics are generated from the code's own bits - six cells " +
        'from bits 0-4 and 6 - so there is no bitmap and no address for them.',
    },
  ],
  bbcmaster: [
    {
      kind: 'rom',
      file: 'master/mos3.20',
      // The 128K image is the MOS (first 16K) plus seven sideways banks; the
      // font is in the last of those. Bank derived from jsbeeb's loadOs
      // arithmetic rather than observed on the machine - see the test.
      base: 0xb900,
      fileOffset: 0x1f900,
      stride: 8,
      cell: { w: 8, h: 8 },
      codes: range(0x20, 0x7f),
      indexOf: linear(0x20, 0x7f),
      note:
        "Sideways ROM bank 15, offset 0x3900. The MOS itself (the image's first " +
        "16K) carries no font, unlike the Micro's.",
    },
    {
      kind: 'chip',
      chip: 'SAA5050',
      codes: range(0x20, 0x7f),
      cell: { w: 6, h: 10 },
      indexOf: (code) => code & 0x7f,
      note: 'As the Micro.',
    },
    {
      kind: 'logic',
      by: 'SAA5050',
      codes: [...range(0xa0, 0xbf), ...range(0xe0, 0xff)],
      cell: { w: 6, h: 10 },
      note: 'As the Micro.',
    },
  ],

  commodore64: [commodoreFont('c64/chargen.bin', 0xd000, 0xff)],
  // vic20/memoryMap.ts already declares this ROM as a region at 0x8000-0x8FFF -
  // "the 4K character generator ROM (901460-03)" - so the address was in the
  // repo all along and only had to be looked up.
  vic20: [commodoreFont('vic20/chargen.bin', 0x8000, 0xff)],
  // The PET's stays unestablished: unlike the VIC-20's, its memory map declares
  // no character-ROM region, and the character set is not CPU-visible there.
  pet: [commodoreFont('pet/characters-2.901447-10.bin', null, 0x7f)],

  cpc464: [cpcFont('cpc/cpc464.rom')],
  cpc6128: [cpcFont('cpc/cpc6128.rom')],

  atom: [
    {
      kind: 'chip',
      chip: 'MC6847',
      codes: range(0x20, 0x7f),
      cell: { w: 8, h: 12 },
      // Source byte -> screen code is OSWRCH's job; for the alphanumerics it is
      // the MC6847's internal 64-glyph set.
      indexOf: (code) =>
        code >= 0x20 && code <= 0x5f ? code & 0x3f : undefined,
      note: "The video chip's internal alphanumeric set; not CPU-addressable.",
    },
    {
      kind: 'logic',
      by: 'MC6847 SG6',
      codes: range(0xa0, 0xdf),
      cell: { w: 8, h: 12 },
      note:
        'Semigraphics-6, generated from the low six bits of the screen code. ' +
        'OSWRCH adds 0x20, so source 0xA0-0xDF reaches screen 0xC0-0xFF.',
    },
  ],

  trs80: [
    {
      kind: 'chip',
      chip: 'MCM6670',
      codes: range(0x20, 0x7f),
      cell: { w: 8, h: 12 },
      indexOf: linear(0x20, 0x7f),
      note:
        'No character ROM is shipped: src/dialects/trs80/emulator/display.ts ' +
        'draws ASCII with the host font deliberately, to avoid bundling a second ' +
        'copyrighted asset. The real shapes are in the MCM6670.',
    },
    {
      kind: 'logic',
      by: 'video logic',
      codes: range(0x80, 0xbf),
      cell: { w: 8, h: 12 },
      note:
        'The 2x3 block graphics are produced by discrete logic from the low six ' +
        'bits, not by the character generator at all.',
    },
  ],
};

/** What a dialect's glyph for `code` comes from, or undefined if nothing claims it. */
export function sourceFor(
  dialectId: string,
  code: number,
): GlyphSource | undefined {
  for (const source of GLYPH_SOURCES[dialectId] ?? []) {
    if (!source.codes.includes(code)) continue;
    if (source.kind === 'logic') return source;
    if (source.indexOf(code) !== undefined) return source;
  }
  return undefined;
}

/** Where a glyph lives, resolved to an address where one exists. */
export type GlyphLocation =
  | {
      kind: 'rom';
      file: string;
      address: number;
      fileOffset: number;
      stride: number;
    }
  | { kind: 'chip'; chip: string; index: number }
  | { kind: 'logic'; by: string };

/**
 * The machine-side location of one dialect's glyph for `code`. `rom` carries the
 * CPU address; `chip` the chip's own glyph index, there being no CPU address;
 * `logic` neither, because nothing is stored.
 */
export function glyphLocation(
  dialectId: string,
  code: number,
): GlyphLocation | undefined {
  const source = sourceFor(dialectId, code);
  if (!source) return undefined;
  if (source.kind === 'logic') return { kind: 'logic', by: source.by };
  const index = source.indexOf(code);
  if (index === undefined) return undefined;
  if (source.kind === 'chip') return { kind: 'chip', chip: source.chip, index };
  return {
    kind: 'rom',
    file: source.file,
    address: source.base < 0 ? -1 : source.base + index * source.stride,
    fileOffset: source.fileOffset + index * source.stride,
    stride: source.stride,
  };
}
