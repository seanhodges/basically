import { describe, it, expect } from 'vitest';
import { SamAsic, paletteRgb } from './asic';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, renderScreen } from './display';

/** RGB of the pixel at (x, y) in a rendered frame. */
function pixel(buf: Uint8ClampedArray, x: number, y: number): number[] {
  const i = (y * DISPLAY_WIDTH + x) * 4;
  return [buf[i]!, buf[i + 1]!, buf[i + 2]!];
}

/** An ASIC with a CLUT of distinguishable colours and the given mode. */
function asicInMode(mode: number): SamAsic {
  const asic = new SamAsic();
  // Entry n gets palette colour n, so a rendered pixel names the CLUT entry it
  // came from without any two colliding.
  for (let i = 0; i < 16; i++) asic.clut[i] = i;
  asic.writePort(0xfc, (mode - 1) << 5);
  return asic;
}

function render(
  asic: SamAsic,
  screen: Uint8Array,
  hmpr = 0,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
  renderScreen(asic, hmpr, (offset) => screen[offset] ?? 0, out);
  return out;
}

describe('samcoupe display', () => {
  it('draws MODE 1 through the CLUT, attributes and all', () => {
    const asic = asicInMode(1);
    const screen = new Uint8Array(0x4000);
    // The first cell of the top line: leftmost pixel set, ink 2 paper 5.
    screen[0] = 0x80;
    screen[6144] = 5 * 8 + 2;
    const buf = render(asic, screen);
    // A MODE 1 pixel is drawn two device pixels wide, so the picture fills the
    // same 512-pixel raster MODE 3 does.
    expect(pixel(buf, 0, 0)).toEqual(paletteRgb(2));
    expect(pixel(buf, 1, 0)).toEqual(paletteRgb(2));
    expect(pixel(buf, 2, 0)).toEqual(paletteRgb(5));

    // BRIGHT is attribute bit 6, and it is simply the CLUT's top eight entries.
    screen[6144] = 0x40 | (5 * 8 + 2);
    expect(pixel(render(asic, screen), 0, 0)).toEqual(paletteRgb(10));
    expect(pixel(render(asic, screen), 2, 0)).toEqual(paletteRgb(13));

    // FLASH swaps ink and paper on alternate half-cycles.
    screen[6144] = 0x80 | (5 * 8 + 2);
    asic.flashPhase = true;
    expect(pixel(render(asic, screen), 0, 0)).toEqual(paletteRgb(5));
  });

  it('gives every MODE 2 scanline its own attribute row', () => {
    const asic = asicInMode(2);
    const screen = new Uint8Array(0x4000);
    // Same bit pattern on the first two scanlines, different attributes: this
    // is exactly what MODE 1 cannot do, its attributes covering eight rows.
    screen[0] = 0x80;
    screen[32] = 0x80;
    screen[0x2000] = 3; // ink 3 on line 0
    screen[0x2020] = 6; // ink 6 on line 1
    const buf = render(asic, screen);
    expect(pixel(buf, 0, 0)).toEqual(paletteRgb(3));
    expect(pixel(buf, 0, 1)).toEqual(paletteRgb(6));
  });

  it('draws MODE 3 at full width with the hardware`s own CLUT order', () => {
    const asic = asicInMode(3);
    const screen = new Uint8Array(0x6000);
    screen[0] = 0b00_01_10_11; // four 2-bit pixels, most significant first
    const buf = render(asic, screen);
    // Each pixel is one device pixel: this is the only mode that is not drawn
    // double width, which is what makes it 512 across.
    // Values 1 and 2 are swapped in the lookup, as the ASIC swaps them.
    expect(pixel(buf, 0, 0)).toEqual(paletteRgb(0));
    expect(pixel(buf, 1, 0)).toEqual(paletteRgb(2));
    expect(pixel(buf, 2, 0)).toEqual(paletteRgb(1));
    expect(pixel(buf, 3, 0)).toEqual(paletteRgb(3));

    // HMPR bits 5-6 move MODE 3's four colours to another group of four.
    const shifted = render(asic, screen, 0x20);
    expect(pixel(shifted, 0, 0)).toEqual(paletteRgb(4));
    expect(pixel(shifted, 1, 0)).toEqual(paletteRgb(6));
  });

  it('draws MODE 4 as two CLUT nibbles per byte', () => {
    const asic = asicInMode(4);
    const screen = new Uint8Array(0x6000);
    screen[0] = 0x9c;
    // Line 191 is the last, 128 bytes a line.
    screen[191 * 128 + 127] = 0x0f;
    const buf = render(asic, screen);
    expect(pixel(buf, 0, 0)).toEqual(paletteRgb(9));
    expect(pixel(buf, 1, 0)).toEqual(paletteRgb(9));
    expect(pixel(buf, 2, 0)).toEqual(paletteRgb(12));
    expect(pixel(buf, DISPLAY_WIDTH - 1, DISPLAY_HEIGHT - 1)).toEqual(
      paletteRgb(15),
    );
  });

  it('paints the screen black while the ASIC`s fetch is switched off', () => {
    const asic = asicInMode(4);
    const screen = new Uint8Array(0x6000).fill(0xff);
    asic.writePort(0xfe, 0x80); // screen off
    const buf = render(asic, screen);
    expect(pixel(buf, 0, 0)).toEqual([0, 0, 0]);
    expect(pixel(buf, DISPLAY_WIDTH - 1, DISPLAY_HEIGHT - 1)).toEqual([
      0, 0, 0,
    ]);
  });
});
