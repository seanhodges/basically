import { describe, expect, it } from 'vitest';
import { SPECTRUM_BLOCK_GRAPHICS, SPECTRUM_UDG_GRAPHICS } from './graphics';
import { spectrumCharset } from './charset';
import { UDG_LAST } from './charset';

/**
 * The tables in ./graphics are computed from the ROM's two arithmetic rules
 * (`0x80 + (ASCII & 7)` with `XOR $0F` under shift, and `ASCII + 0x4F`), so what
 * needs pinning is that those rules land where the charset says they should:
 * exactly onto 0x80-0x8F and 0x90-0xA4, one key each.
 */

describe('ZX Spectrum block graphics', () => {
  it('maps the eight digit keys onto 0x80-0x8F, bijectively', () => {
    const codes = SPECTRUM_BLOCK_GRAPHICS.map((g) => g.code).sort(
      (a, b) => a - b,
    );
    expect(codes).toEqual(Array.from({ length: 16 }, (_, i) => 0x80 + i));
    expect(new Set(SPECTRUM_BLOCK_GRAPHICS.map((g) => g.key)).size).toBe(8);
  });

  it('pairs each shifted entry with its unshifted complement', () => {
    // CAPS SHIFT complements the quadrant bits - inverse video.
    const plain = new Map(
      SPECTRUM_BLOCK_GRAPHICS.filter((g) => !g.modifier).map((g) => [
        g.key,
        g.code,
      ]),
    );
    for (const entry of SPECTRUM_BLOCK_GRAPHICS) {
      if (!entry.modifier) continue;
      expect(entry.modifier).toBe('CAPS');
      expect(entry.code, entry.key).toBe(plain.get(entry.key)! ^ 0x0f);
    }
  });

  it('puts the blank and the solid block on key 8', () => {
    // The one assignment the keycaps do not suggest, which is why it came from
    // the ROM: `'8' & 7` is 0, not 8.
    const onEight = SPECTRUM_BLOCK_GRAPHICS.filter((g) => g.key === '8');
    expect(onEight.map((g) => g.code).sort((a, b) => a - b)).toEqual([
      0x80, 0x8f,
    ]);
  });

  it('inserts characters the charset encodes back to the same code', () => {
    for (const { char, code, key } of SPECTRUM_BLOCK_GRAPHICS) {
      if (code === 0x80) continue; // the blank graphic renders as a space
      expect([...spectrumCharset.toMachine(char)], key).toEqual([code]);
      expect(spectrumCharset.toUnicode(Uint8Array.of(code)), key).toBe(char);
    }
  });
});

describe('ZX Spectrum user-defined graphics', () => {
  it('maps A-U onto 0x90 through UDG_LAST, one key each', () => {
    expect(SPECTRUM_UDG_GRAPHICS.map((g) => g.code)).toEqual(
      Array.from({ length: UDG_LAST - 0x90 + 1 }, (_, i) => 0x90 + i),
    );
    expect(SPECTRUM_UDG_GRAPHICS[0]).toMatchObject({ key: 'A', code: 0x90 });
    expect(SPECTRUM_UDG_GRAPHICS.at(-1)).toMatchObject({
      key: 'U',
      code: UDG_LAST,
    });
  });

  it('encodes each user-defined graphic into its code', () => {
    for (const { char, code, key } of SPECTRUM_UDG_GRAPHICS) {
      expect([...spectrumCharset.toMachine(char)], key).toEqual([code]);
      expect(spectrumCharset.toUnicode(Uint8Array.of(code)), key).toBe(char);
    }
  });
});
