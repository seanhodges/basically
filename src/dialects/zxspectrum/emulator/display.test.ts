import { describe, expect, it } from 'vitest';
import {
  renderScanline,
  renderDisplay,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
} from './display';

const SCREEN_BASE = 0x4000;
const ATTR_BASE = 0x5800;

/** A minimal writable DisplayMemory backed by a flat 64K array. */
function makeMemory() {
  const store = new Uint8Array(0x10000);
  return {
    store,
    read: (addr: number) => store[addr & 0xffff]!,
    write: (addr: number, value: number) => {
      store[addr & 0xffff] = value & 0xff;
    },
  };
}

function bitmapAddr(y: number, xb: number): number {
  return (
    SCREEN_BASE | ((y & 0x07) << 8) | ((y & 0x38) << 2) | ((y & 0xc0) << 5) | xb
  );
}

/** RGBA of the pixel at (x, y) in a 256x192 framebuffer. */
function pixel(buf: Uint8ClampedArray, x: number, y: number): number[] {
  const p = (y * DISPLAY_WIDTH + x) * 4;
  return [buf[p]!, buf[p + 1]!, buf[p + 2]!, buf[p + 3]!];
}

describe('renderScanline', () => {
  it('samples memory live, so two scanlines of one character row can differ', () => {
    // y=0 and y=1 share character row 0, so a whole-frame snapshot would paint
    // both from the same attribute byte. Rendering per scanline and rewriting
    // the attribute between the two calls - the multicolour / "rainbow" trick -
    // must give the two rows different colours.
    const mem = makeMemory();
    const buf = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    // All ink, so each pixel takes the ink colour.
    mem.write(bitmapAddr(0, 0), 0xff);
    mem.write(bitmapAddr(1, 0), 0xff);

    mem.write(ATTR_BASE, 0x02); // ink 2 = red
    renderScanline(mem, buf, 0, false);
    mem.write(ATTR_BASE, 0x04); // ink 4 = green
    renderScanline(mem, buf, 1, false);

    const row0 = pixel(buf, 0, 0);
    const row1 = pixel(buf, 0, 1);
    expect(row0).not.toEqual(row1);
    expect(row0[0]).toBeGreaterThan(0); // red channel lit on row 0
    expect(row0[1]).toBe(0);
    expect(row1[1]).toBeGreaterThan(0); // green channel lit on row 1
    expect(row1[0]).toBe(0);
  });
});

describe('renderDisplay', () => {
  it('paints all eight rows of a character cell from its single attribute (snapshot)', () => {
    const mem = makeMemory();
    const buf = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    for (let y = 0; y < 8; y++) mem.write(bitmapAddr(y, 0), 0xff);
    mem.write(ATTR_BASE, 0x02); // ink 2 = red for the whole cell

    renderDisplay(mem, buf, false);

    const first = pixel(buf, 0, 0);
    for (let y = 1; y < 8; y++) {
      expect(pixel(buf, 0, y)).toEqual(first);
    }
    expect(first[0]).toBeGreaterThan(0);
    expect(first[1]).toBe(0);
  });
});
