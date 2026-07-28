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
 * The families this change covers. Everything else keeps whatever support it
 * had; the audit still reports on it so the gaps are visible.
 */
export const IN_SCOPE = new Set([
  'zx80',
  'zx81',
  'zxspectrum',
  'zxspectrum128',
  'commodore64',
  'vic20',
  'pet',
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
  // SAA5050 MODE 7 sixel mosaics, per bbcmicro/charset.ts.
  bbcmicro: range(0xa0, 0xff),
  bbcmaster: range(0xa0, 0xff),
  // The Atom's charset comment covers 0x80-0xFF as MC6847 inverse video, which
  // is not the same thing as its chunky graphics. Establishing where those sit
  // needs the Atom technical manual / MC6847 datasheet, so this stays open
  // rather than being guessed at.
  atom: null,
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
