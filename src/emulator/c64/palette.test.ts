import { describe, expect, it } from 'vitest';
import { remapRgb, CRT_PALETTE } from './palette';

// Helper: unpack a 0xRRGGBB int to the [r, g, b] triple remapRgb works with.
const rgb = (packed: number): [number, number, number] => [
  (packed >> 16) & 0xff,
  (packed >> 8) & 0xff,
  packed & 0xff,
];

describe('remapRgb', () => {
  it('remaps the reported vendored orange to the vivid CRT orange', () => {
    // Vendored orange 0x996622 (brown-tan) -> CRT 0xcd4e28 (warm red-orange).
    expect(remapRgb(...rgb(0x996622))).toEqual(rgb(0xcd4e28));
    expect(rgb(0xcd4e28)).toEqual(rgb(CRT_PALETTE[8]));
  });

  it('remaps the reported vendored green to the CRT green', () => {
    // Vendored green 0x77bb44 (yellow-lime) -> CRT 0x45e035 (solid vivid green).
    expect(remapRgb(...rgb(0x77bb44))).toEqual(rgb(0x45e035));
    expect(rgb(0x45e035)).toEqual(rgb(CRT_PALETTE[5]));
  });

  it('passes black and white through unchanged', () => {
    expect(remapRgb(0, 0, 0)).toEqual([0, 0, 0]);
    expect(remapRgb(255, 255, 255)).toEqual([255, 255, 255]);
  });

  it('falls through unknown (off-palette) colours unchanged', () => {
    // Not a vendored systemPalette entry -> returned verbatim.
    expect(remapRgb(1, 2, 3)).toEqual([1, 2, 3]);
  });
});

/** WCAG relative luminance of an [r, g, b] triple. */
function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two [r, g, b] triples, 1:1 to 21:1. */
function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number],
): number {
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('CRT_PALETTE legibility', () => {
  // The KERNAL powers up with light blue (14) text on a blue (6) background, so
  // this one pair decides whether a freshly booted C64 is readable at all.
  const LIGHT_BLUE = 14;
  const BLUE = 6;

  it('takes the value boost but not the saturation boost for light blue', () => {
    expect(CRT_PALETTE[LIGHT_BLUE]).toBe(0x7a76ff);
  });

  it('keeps the power-on screen above the 3:1 large-text threshold', () => {
    // Blue carries only ~7% of perceived brightness, so two blues can differ by
    // most of that channel and still be near-illegible: boosting saturation here
    // strips the red and green that do the work and drops this to 1.87:1.
    const ratio = contrastRatio(
      rgb(CRT_PALETTE[LIGHT_BLUE]),
      rgb(CRT_PALETTE[BLUE]),
    );
    expect(ratio).toBeGreaterThan(3);
  });

  it('reads light blue as brighter than the blue it sits on', () => {
    expect(luminance(rgb(CRT_PALETTE[LIGHT_BLUE]))).toBeGreaterThan(
      luminance(rgb(CRT_PALETTE[BLUE])),
    );
  });
});
