import { describe, expect, it } from 'vitest';
import {
  CHIP_BOX,
  chipInk,
  chipShapes,
  type ChipSymbol,
  type ControlChip,
} from './controlChip';

/**
 * The chip shapes are data, so both renderers (the palette's React component
 * and the editor's DOM widget) draw the same picture. These pin the data;
 * whether it reaches the screen is an e2e question.
 */

const SYMBOLS: ChipSymbol[] = [
  'mosaic',
  'separated',
  'alpha',
  'tall',
  'hold',
  'release',
  'flash',
  'steady',
  'conceal',
  'boxStart',
  'boxEnd',
  'background',
  'backgroundNew',
];

const chip = (symbol: ChipSymbol, colour?: string): ControlChip => ({
  symbol,
  title: symbol,
  ...(colour === undefined ? {} : { colour }),
});

describe('chipInk', () => {
  it('takes dark ink on the light teletext colours and light on the dark', () => {
    // The BBC primaries straddle the boundary, which is why this is measured
    // rather than guessed: yellow, cyan, green and white are light grounds,
    // red, blue and magenta are dark ones.
    for (const light of ['#ffff00', '#00ffff', '#00ff00', '#ffffff'])
      expect(chipInk(light), light).toBe('#111111');
    for (const dark of ['#ff0000', '#0000ff', '#ff00ff', '#000000'])
      expect(chipInk(dark), dark).toBe('#f8f8f8');
  });

  it('falls back to dark ink for anything it cannot read', () => {
    expect(chipInk('currentColor')).toBe('#111111');
  });
});

describe('chipShapes', () => {
  it('draws every symbol', () => {
    for (const symbol of SYMBOLS) {
      const { shapes } = chipShapes(chip(symbol));
      expect(shapes.length, symbol).toBeGreaterThan(0);
    }
  });

  it('keeps every shape inside the chip box', () => {
    // A shape that overflowed would clip against the box's rounded corner or
    // spill over the character beside it in the editor.
    for (const symbol of SYMBOLS) {
      for (const shape of chipShapes(chip(symbol)).shapes) {
        const bounds =
          shape.kind === 'rect' || shape.kind === 'dashedRect'
            ? [shape.x, shape.y, shape.x + shape.w, shape.y + shape.h]
            : shape.kind === 'circle'
              ? [
                  shape.cx - shape.r,
                  shape.cy - shape.r,
                  shape.cx + shape.r,
                  shape.cy + shape.r,
                ]
              : [];
        for (const v of bounds) {
          expect(v, `${symbol} ${shape.kind}`).toBeGreaterThanOrEqual(0);
          expect(v, `${symbol} ${shape.kind}`).toBeLessThanOrEqual(CHIP_BOX);
        }
      }
    }
  });

  it('gives a mosaic six cells and a separated mosaic six smaller ones', () => {
    const solid = chipShapes(chip('mosaic')).shapes;
    const gapped = chipShapes(chip('separated')).shapes;
    expect(solid).toHaveLength(6);
    expect(gapped).toHaveLength(6);
    const area = (s: (typeof solid)[number]): number =>
      s.kind === 'rect' ? s.w * s.h : 0;
    expect(area(gapped[0]!)).toBeLessThan(area(solid[0]!));
  });

  it('draws on paper when the code selects no colour', () => {
    expect(chipShapes(chip('hold')).fill).toBe('#fdfdf8');
    expect(chipShapes(chip('hold')).ink).toBe('#111111');
    expect(chipShapes(chip('mosaic', '#0000ff')).fill).toBe('#0000ff');
    expect(chipShapes(chip('mosaic', '#0000ff')).ink).toBe('#f8f8f8');
  });
});
