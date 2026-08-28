import type { Dialect } from './types';
import { dialects } from './registry';
import { probeFor, type CharsetProbe } from './charsetProbes';
import { resolveEditorAction } from '../keyboard/editorActions';

/**
 * What each machine's semigraphics support actually amounts to, derived rather
 * than written down.
 *
 * Almost everything here is computed from the dialect's own `CharsetMapping`
 * and `KeyboardLayout`: how each byte is spelled comes from the charset, and
 * whether the user can type it comes from walking the keyboard through
 * {@link resolveEditorAction} and back through the charset. The one thing code
 * cannot know is which bytes the *machine* considers graphics - a charset only
 * says what we currently map - so that single fact is declared in
 * {@link SEMIGRAPHIC_CODES}, cited per dialect.
 *
 * Read by `scripts/gen-semigraphics-audit.mts` (which writes the matrix in
 * docs/contributing/semigraphics-support.md) and by the font-coverage and
 * round-trip tests.
 */

/** How a byte is spelled in editor text. */
export type ByteClass =
  | 'control'
  | 'ascii'
  | 'glyph-bmp'
  | 'glyph-astral'
  | 'escape-named'
  | 'escape-raw';

export interface ByteFacts {
  code: number;
  /** The canonical text form the dialect renders this byte as. */
  text: string;
  cls: ByteClass;
}

export interface DialectAudit {
  id: string;
  name: string;
  /** The charset family this dialect belongs to. */
  probeId: string;
  bytes: ByteFacts[];
  /**
   * The machine's own graphics codes, or null where nobody has established them
   * from a primary source yet.
   */
  declared: number[] | null;
  /** Codes reachable by typing on the on-screen keyboard. */
  typeable: Set<number>;
  /** Whether this change covers the dialect. */
  inScope: boolean;
}

/** Inclusive byte range, as a helper for the declarations below. */
const range = (from: number, to: number): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

/**
 * The families whose semigraphics support is guaranteed end to end: every
 * graphics character they can express is typeable from the palette and is
 * proven by `semigraphicsRoundTrip.test.ts` to survive the editor, the
 * tokenizer and a hardware export/import cycle.
 *
 * A dialect joins this set when it earns the guarantee, not when someone
 * intends it to. Everything else keeps whatever support it had; the audit still
 * reports on it so the gaps stay visible.
 */
export const IN_SCOPE = new Set([
  'zx80',
  'zx81',
  'zxspectrum',
  'zxspectrum128',
  'commodore64',
  'vic20',
  'pet',
  'trs80',
  'cpc464',
  'cpc6128',
  'bbcmicro',
  'bbcmaster',
  'atom',
]);

/**
 * Which bytes each machine treats as block graphics.
 *
 * `null` means "not established from a primary source" - deliberately not a
 * guess. Each entry cites where its range comes from; a range that cannot be
 * cited belongs in the null case until somebody reads the hardware.
 */
export const SEMIGRAPHIC_CODES: Record<string, number[] | null> = {
  // ROM character generator at 0x1E00, quadrant shapes plus the chequer dither
  // and their inverse-video twins. Re-derived from the ROM bitmaps in
  // sinclairGraphics.test.ts, which fails if any of these stops being a block.
  zx81: [...range(0x01, 0x0a), ...range(0x80, 0x8a)],
  // Same, from the 4K ROM font at 0x0E00. 0x00/0x01 are space and quote, so the
  // graphics start at 0x02; 0x80 (inverse space) is the solid block.
  zx80: [0x80, ...range(0x02, 0x0b), ...range(0x82, 0x8b)],
  // Block graphics 0x80-0x8F and the user-defined graphics 0x90-0xA4, as the
  // charset documents (see UDG_LAST in zxspectrum/charset.ts).
  zxspectrum: [...range(0x80, 0x8f), ...range(0x90, 0xa4)],
  // The 128K reuses the last two UDG codes as keyword tokens.
  zxspectrum128: [...range(0x80, 0x8f), ...range(0x90, 0xa2)],
  // PETSCII graphics: the C= set and the SHIFT set, as petscii.ts maps them.
  commodore64: range(0xa0, 0xdf),
  vic20: range(0xa0, 0xdf),
  pet: range(0xa0, 0xdf),
  // 2x3 block-graphics cells; trs80/charset.ts documents 0x80-0xBF, with 0x80
  // the blank cell and 0xC0+ the space-compression codes.
  trs80: range(0x80, 0xbf),
  // Quadrant mosaics plus the upper block cpc464/charset.ts leaves unmapped.
  cpc464: [...range(0x80, 0x9f), ...range(0xc0, 0xdf)],
  cpc6128: [...range(0x80, 0x9f), ...range(0xc0, 0xdf)],
  // SAA5050 MODE 7 mosaics. The chip treats a code as a mosaic iff bit 5 is
  // set (%xx1xxxxx; teletext level-1 character set, and the SAA5050
  // implementation the IDE's own emulator ships - see the jsbeeb crosscheck in
  // bbcmicro/mode7Graphics.test.ts). Bit-5-clear codes blast through as
  // capitals even in graphics mode, so 0xC0-0xDF are not graphics.
  bbcmicro: [...range(0xa0, 0xbf), ...range(0xe0, 0xff)],
  bbcmaster: [...range(0xa0, 0xbf), ...range(0xe0, 0xff)],
  // The MC6847's 64 Semigraphics-6 cells. The Atom kernel's write-character
  // routine sends program byte 0xA0+p to screen code 0xC0+p, which the VDG
  // draws as pattern p - probed against the real ROM, and the cell shapes
  // crosschecked against the MC6847 font the emulator draws with, both in
  // atom/semigraphics.test.ts. 0xE0-0xFF repeats patterns 0x20-0x3F in the
  // other colour set, so it is not a second graphics range.
  atom: range(0xa0, 0xdf),
  // Empty rather than null, and the distinction is the point: the Altair has no
  // video hardware and no character generator at all - BASIC writes 7-bit ASCII
  // down a serial line and whatever terminal is on the other end decides what
  // it looks like. So "this machine has no block graphics" is an established
  // fact about the hardware, not a range nobody has read off it yet.
  altair8800: [],
  // Empty for the same reason, established the same way: the Monitor 2
  // character generator is 96 ASCII glyphs and one solid cell, with no mosaic
  // set anywhere in it (charset.ts reads it out of the ROM). Graphics on this
  // machine are drawn - PLOT, FILL, BPLOT - rather than typed.
  pmd85: [],
  // Empty on the same footing: the Signetics 2513 holds 64 glyphs - ASCII
  // 0x20-0x5F, which this machine carries with bit 7 set - and there is no
  // sixty-fifth. charset.ts reads that range off the terminal's own decode, and
  // the machine has no graphics hardware for a mosaic to reach even if the chip
  // held one.
  apple1: [],
  // The character generator's block and line-graphics range, drawn from the
  // keyboard as CTRL + a key; see the `GRAPHICS` table in `atari800/atascii.ts`.
  // Both machines share one ROM font.
  atari800: range(0x00, 0x1a),
  atari400: range(0x00, 0x1a),
};

/** Classify one byte from its canonical text form. */
export function classify(probe: CharsetProbe, code: number): ByteFacts {
  const text = probe.decode(code);
  const cls = ((): ByteClass => {
    if (probe.rawPattern.test(text)) {
      return code < 0x20 || code === 0x7f ? 'control' : 'escape-raw';
    }
    if (probe.isEscapeForm(text)) return 'escape-named';
    const point = text.codePointAt(0);
    if (point === undefined) return 'escape-raw';
    // A multi-codepoint form is a spelling, not a glyph.
    if (String.fromCodePoint(point).length !== text.length)
      return 'escape-named';
    if (point < 0x80) return 'ascii';
    return point >= 0x10000 ? 'glyph-astral' : 'glyph-bmp';
  })();
  return { code, text, cls };
}

/**
 * Every byte a user can produce by typing on the machine's on-screen keyboard:
 * each key on each layer, plus any graphics palette, resolved to its editor
 * insert and pushed back through the charset.
 */
export function typeableCodes(dialect: Dialect): Set<number> {
  const layout = dialect.keyboardLayout;
  const out = new Set<number>();

  const add = (insert: string): void => {
    let bytes: Uint8Array;
    try {
      bytes = dialect.charset.toMachine(insert);
    } catch {
      return; // An insert the charset cannot encode types nothing.
    }
    if (bytes.length === 1) out.add(bytes[0]!);
  };

  const keys = [...layout.rows.flat(), ...(layout.functionKeys ?? [])];
  for (const layer of layout.layers) {
    for (const key of keys) {
      const action = resolveEditorAction(layout, key, layer.id);
      if (action && 'insert' in action) add(action.insert);
    }
  }
  for (const section of layout.graphicsPalette?.sections ?? []) {
    for (const entry of section.entries) add(entry.char);
  }
  return out;
}

/** Audit one dialect. */
export function auditDialect(dialect: Dialect): DialectAudit {
  const probe = probeFor(dialect.id);
  if (!probe) throw new Error(`no charset probe for dialect "${dialect.id}"`);
  return {
    id: dialect.id,
    name: dialect.name,
    probeId: probe.id,
    bytes: Array.from({ length: 256 }, (_, code) => classify(probe, code)),
    declared: SEMIGRAPHIC_CODES[dialect.id] ?? null,
    typeable: typeableCodes(dialect),
    inScope: IN_SCOPE.has(dialect.id),
  };
}

/** Audit every registered dialect, in registry order. */
export function auditAll(): DialectAudit[] {
  return dialects.map(auditDialect);
}

/** The graphics bytes of a dialect, with their spelling and reachability. */
export function graphicsFacts(
  audit: DialectAudit,
): Array<ByteFacts & { typeable: boolean }> {
  return (audit.declared ?? []).map((code) => ({
    ...audit.bytes[code]!,
    typeable: audit.typeable.has(code),
  }));
}

/**
 * Every non-ASCII codepoint any registered dialect can render - the exact set a
 * bundled font has to cover for no machine character to show as a missing
 * glyph. Sorted, so the font subset and the audit table agree on ordering.
 */
export function requiredCodepoints(audits = auditAll()): number[] {
  const out = new Set<number>();
  for (const audit of audits) {
    for (const { text, cls } of audit.bytes) {
      if (cls !== 'glyph-bmp' && cls !== 'glyph-astral') continue;
      for (const ch of text) out.add(ch.codePointAt(0)!);
    }
  }
  return [...out].sort((a, b) => a - b);
}
