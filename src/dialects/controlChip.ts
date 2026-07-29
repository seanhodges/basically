/**
 * Display control codes drawn as chips.
 *
 * Some machines carry display attributes in the character stream rather than in
 * a statement: a MODE 7 line is teletext control bytes interleaved with the
 * text they act on. A dialect spells those bytes as named escapes
 * (`{GRAPHICS WHITE}`), which is exact and round-trips byte-for-byte, but
 * sixteen columns of a forty-column line say "white" rather than showing it.
 *
 * A {@link ControlChip} is how one such escape is *drawn*: a box in the colour
 * the code selects, carrying a symbol for what it does. It changes nothing
 * about the program - the source still holds the escape text and the machine
 * still receives the byte - so a chip can never disagree with what runs.
 *
 * Two surfaces draw chips, the editor's inline decoration and the virtual
 * keyboard's palette, and the palette is meant to be a preview of the text that
 * lands in the editor. So the shapes are derived here once, as constrained data
 * ({@link chipShapes}) rather than as markup - the same rule
 * `src/keyboard/GlyphSvg.tsx` follows - and each surface only maps that data
 * onto its own renderer.
 */

/** The motif a chip carries. */
export type ChipSymbol =
  /** Block graphics: the 2x3 mosaic cell, contiguous. */
  | 'mosaic'
  /** Block graphics with the cells separated. */
  | 'separated'
  /** Text: a letter. */
  | 'alpha'
  /** Text at double height: a taller letter. */
  | 'tall'
  /** Hold: repeat the last graphic under following controls. */
  | 'hold'
  /** Release the held graphic. */
  | 'release'
  /** Flashing. */
  | 'flash'
  /** Steady (not flashing). */
  | 'steady'
  /** Concealed until revealed. */
  | 'conceal'
  /** Start of a boxed region. */
  | 'boxStart'
  /** End of a boxed region. */
  | 'boxEnd'
  /** Background set to black. */
  | 'background'
  /** Background set to the current foreground. */
  | 'backgroundNew';

/** How the editor and the palette draw one display-control escape. */
export interface ControlChip {
  /**
   * Fill for the chip's box when the code selects a colour, as a `#rrggbb`
   * string. Omitted for a code that selects none; the chip is then drawn on
   * paper, like the editor's own background.
   */
  colour?: string;
  /** The motif drawn on the box. */
  symbol: ChipSymbol;
  /** What the code does, for the tooltip and the accessible name. */
  title: string;
}

/**
 * One shape of a chip. A closed vocabulary, like the keyboard's glyph paths:
 * a layout (or one day a community-authored one) describes a chip, it never
 * supplies markup.
 */
export type ChipShape =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'path'; d: string }
  | { kind: 'dashedRect'; x: number; y: number; w: number; h: number }
  | { kind: 'text'; text: string; size: number };

/** The chip's drawing surface: a 16x16 box, so shape coordinates read as %. */
export const CHIP_BOX = 16;
/** Paper fill for a chip whose code selects no colour. */
const PAPER = '#fdfdf8';
/** The box outline, so a white or yellow chip still reads on paper. */
export const CHIP_EDGE = '#33333a';

/**
 * Ink that reads on `fill`: dark on a light box, light on a dark one. Uses
 * relative luminance rather than a lightness guess because the teletext
 * primaries straddle the boundary - yellow, cyan and green need dark ink,
 * blue, red and magenta need light.
 */
export function chipInk(fill: string): string {
  const hex = /^#([0-9a-f]{6})$/i.exec(fill);
  if (!hex) return '#111111';
  const n = parseInt(hex[1]!, 16);
  const channel = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff);
  return luminance > 0.4 ? '#111111' : '#f8f8f8';
}

/** A 2x3 mosaic cell, contiguous or separated, as six rectangles. */
function mosaicCells(separated: boolean): ChipShape[] {
  const inset = separated ? 0.85 : 0.15;
  const cells: ChipShape[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      cells.push({
        kind: 'rect',
        x: 3.5 + col * 4.5 + inset,
        y: 3 + row * 3.4 + inset,
        w: 4.5 - inset * 2,
        h: 3.4 - inset * 2,
      });
    }
  }
  return cells;
}

/** The shapes of one symbol, in the {@link CHIP_BOX} coordinate space. */
function symbolShapes(symbol: ChipSymbol): ChipShape[] {
  switch (symbol) {
    case 'mosaic':
      return mosaicCells(false);
    case 'separated':
      return mosaicCells(true);
    case 'alpha':
      return [{ kind: 'text', text: 'A', size: 10 }];
    case 'tall':
      return [{ kind: 'text', text: 'A', size: 14 }];
    case 'hold':
      // A pause: the graphic that was showing stays showing.
      return [
        { kind: 'rect', x: 4.5, y: 3.5, w: 2.6, h: 9 },
        { kind: 'rect', x: 8.9, y: 3.5, w: 2.6, h: 9 },
      ];
    case 'release':
      // Play: the stream carries on drawing what it is given.
      return [{ kind: 'path', d: 'M5 3.5 L12.5 8 L5 12.5 Z' }];
    case 'flash':
      return [
        {
          kind: 'path',
          d: 'M8 2.5 L9.6 6.4 L13.5 8 L9.6 9.6 L8 13.5 L6.4 9.6 L2.5 8 L6.4 6.4 Z',
        },
      ];
    case 'steady':
      return [{ kind: 'circle', cx: 8, cy: 8, r: 3.6 }];
    case 'conceal':
      return [{ kind: 'dashedRect', x: 4, y: 4, w: 8, h: 8 }];
    case 'boxStart':
      return [{ kind: 'text', text: '[', size: 12 }];
    case 'boxEnd':
      return [{ kind: 'text', text: ']', size: 12 }];
    case 'background':
      // The lower half taken by the background colour.
      return [{ kind: 'rect', x: 3.5, y: 8, w: 9, h: 4.5 }];
    case 'backgroundNew':
      // Foreground and background swapping places.
      return [
        { kind: 'rect', x: 3.5, y: 3.5, w: 4.5, h: 4.5 },
        { kind: 'rect', x: 8, y: 8, w: 4.5, h: 4.5 },
      ];
  }
}

/** How to draw a chip: the box's fill, the ink that reads on it, the symbol. */
export function chipShapes(chip: ControlChip): {
  fill: string;
  ink: string;
  shapes: ChipShape[];
} {
  const fill = chip.colour ?? PAPER;
  return { fill, ink: chipInk(fill), shapes: symbolShapes(chip.symbol) };
}
