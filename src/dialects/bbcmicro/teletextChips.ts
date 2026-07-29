import type { ControlChip, ChipSymbol } from '../controlChip';
import { TELETEXT_NAMES } from './charset';

/**
 * The MODE 7 control codes as chips, for the editor and the graphics palette.
 *
 * A teletext line is control bytes interleaved with the text they act on, and
 * the charset spells each one as a named escape so it round-trips exactly. Read
 * back, though, `{GRAPHICS WHITE}` is sixteen of a MODE 7 line's forty columns
 * spelling a colour the chip can simply be. Drawn, a control code costs one
 * column and says what it does at a glance.
 *
 * Every code the charset names gets a chip, derived from {@link TELETEXT_NAMES}
 * so the two cannot fall out of step; the `{0xNN}` raw escapes deliberately get
 * none, because a byte with no display meaning must stay visible as the byte it
 * is.
 *
 * The seven colours are the BBC's own primaries. They are written out here
 * rather than imported from the emulator - dialect data does not depend on a
 * machine core - and `mode7Graphics.test.ts` pins them against jsbeeb's
 * `BbcDefaultPalette`, the palette the emulator pane actually draws with.
 */

/** The BBC's logical colours 1-7, as CSS. Colour 0 (black) selects no code. */
const TELETEXT_COLOURS: Record<number, string> = {
  1: '#ff0000', // red
  2: '#00ff00', // green
  3: '#ffff00', // yellow
  4: '#0000ff', // blue
  5: '#ff00ff', // magenta
  6: '#00ffff', // cyan
  7: '#ffffff', // white
};

/**
 * The symbol for each named code. The colour codes are the two families the
 * SAA5050 switches between - `alpha` for the text colours, `mosaic` for the
 * graphics colours - so a glance at the chip says which mode the rest of the
 * row is in, which is the whole difference between a mosaic and a letter.
 */
const SYMBOLS: Record<number, ChipSymbol> = {
  0x81: 'alpha',
  0x82: 'alpha',
  0x83: 'alpha',
  0x84: 'alpha',
  0x85: 'alpha',
  0x86: 'alpha',
  0x87: 'alpha',
  0x88: 'flash',
  0x89: 'steady',
  0x8a: 'boxEnd',
  0x8b: 'boxStart',
  0x8c: 'alpha',
  0x8d: 'tall',
  0x91: 'mosaic',
  0x92: 'mosaic',
  0x93: 'mosaic',
  0x94: 'mosaic',
  0x95: 'mosaic',
  0x96: 'mosaic',
  0x97: 'mosaic',
  0x98: 'conceal',
  0x99: 'mosaic',
  0x9a: 'separated',
  0x9c: 'background',
  0x9d: 'backgroundNew',
  0x9e: 'hold',
  0x9f: 'release',
};

/**
 * The colour a code selects, or undefined for one that selects none. Both
 * colour families carry their colour in the low three bits: the text colours
 * are `0x80 | n` and the graphics colours `0x90 | n`, for n = 1-7.
 */
export function teletextChipColour(code: number): string | undefined {
  const family = code & 0xf8;
  if (family !== 0x80 && family !== 0x90) return undefined;
  return TELETEXT_COLOURS[code & 0x07];
}

/** The escape text the charset spells `code` as, e.g. `{GRAPHICS WHITE}`. */
export function teletextEscape(code: number): string {
  const name = TELETEXT_NAMES[code];
  if (name === undefined)
    throw new Error(`0x${code.toString(16)} has no teletext name`);
  return `{${name}}`;
}

/** The chip for one named teletext code. */
export function teletextChip(code: number): ControlChip {
  const symbol = SYMBOLS[code];
  if (symbol === undefined)
    throw new Error(`0x${code.toString(16)} has no chip symbol`);
  const colour = teletextChipColour(code);
  return {
    ...(colour === undefined ? {} : { colour }),
    symbol,
    title: TELETEXT_NAMES[code]!,
  };
}

/**
 * Every named MODE 7 control code, keyed by the escape the charset writes it
 * as - the shape `Dialect.displayControls` takes.
 */
export const BBC_DISPLAY_CONTROLS: Record<string, ControlChip> =
  Object.fromEntries(
    Object.keys(TELETEXT_NAMES)
      .map(Number)
      .map((code) => [teletextEscape(code), teletextChip(code)]),
  );
