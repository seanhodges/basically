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
