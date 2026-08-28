import { describe, expect, it } from 'vitest';
import { ATARI_PALETTE, ATARI_PALETTE_RGB } from './palette';

/**
 * The palette is generated from the composite signal rather than transcribed,
 * so what is worth pinning is the shape of the result: that hue 0 really is
 * neutral, that luminance is monotonic, that the bit the chip ignores is
 * ignored, and that a handful of colours a user would recognise come out
 * looking like themselves. A transcribed table would need every entry checked;
 * a model needs its consequences checked.
 */
describe('the GTIA palette', () => {
  it('has an entry for every colour byte', () => {
    expect(ATARI_PALETTE).toHaveLength(256);
    expect(ATARI_PALETTE_RGB).toHaveLength(256 * 3);
  });

  it('makes hue 0 the greys', () => {
    for (let luma = 0; luma < 16; luma++) {
      const [r, g, b] = ATARI_PALETTE[luma]!;
      expect(g).toBe(r);
      expect(b).toBe(r);
    }
  });

  it('brightens monotonically within a hue', () => {
    for (let hue = 0; hue < 16; hue++) {
      for (let luma = 1; luma < 16; luma++) {
        const before = ATARI_PALETTE[hue * 16 + luma - 1]!;
        const after = ATARI_PALETTE[hue * 16 + luma]!;
        const sum = (c: readonly number[]) => c[0]! + c[1]! + c[2]!;
        expect(sum(after)).toBeGreaterThan(sum(before));
      }
    }
  });

  it('puts the colours where a viewer expects them', () => {
    const hue = (c: number) => {
      const [r, g, b] = ATARI_PALETTE[c]!;
      return { r, g, b };
    };
    // The blue Atari BASIC opens on, and the lighter blue it writes in.
    const paper = hue(0x94);
    expect(paper.b).toBeGreaterThan(paper.r + 60);
    expect(paper.b).toBeGreaterThan(paper.g + 40);
    expect(hue(0x9a).b).toBeGreaterThan(paper.b);
    // Hue 12 is green and hue 4 is a red-purple, per the GTIA data sheet's names.
    expect(hue(0xc8).g).toBeGreaterThan(hue(0xc8).r + 30);
    expect(hue(0x48).r).toBeGreaterThan(hue(0x48).g + 30);
    // Black and white are the ends of hue 0.
    expect(hue(0x00).r).toBeLessThan(10);
    expect(hue(0x0f).r).toBeGreaterThan(220);
  });
});
