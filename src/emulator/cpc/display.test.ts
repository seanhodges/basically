import { describe, expect, it } from 'vitest';
import {
  decodeByte,
  pixelsPerByte,
  renderDisplay,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
} from './display';
import { GateArray } from './gateArray';
import { Crtc } from './crtc';

describe('decodeByte pixel layout', () => {
  it('mode 2 is eight 1-bit pens, MSB leftmost', () => {
    expect(pixelsPerByte(2)).toBe(8);
    expect(decodeByte(2, 0x80)).toEqual([1, 0, 0, 0, 0, 0, 0, 0]);
    expect(decodeByte(2, 0x01)).toEqual([0, 0, 0, 0, 0, 0, 0, 1]);
    expect(decodeByte(2, 0xff)).toEqual([1, 1, 1, 1, 1, 1, 1, 1]);
  });

  it('mode 1 is four 2-bit pens with interleaved bits', () => {
    expect(pixelsPerByte(1)).toBe(4);
    // bit7 (pen bit0) + bit3 (pen bit1) land in pixel 0 only.
    expect(decodeByte(1, 0x88)).toEqual([3, 0, 0, 0]);
    // bit4 (pen bit0) + bit0 (pen bit1) land in pixel 3 only.
    expect(decodeByte(1, 0x11)).toEqual([0, 0, 0, 3]);
  });

  it('mode 0 is two 4-bit pens with interleaved bits', () => {
    expect(pixelsPerByte(0)).toBe(2);
    // bits 7,3,5,1 form pixel 0's four pen bits → pen 15.
    expect(decodeByte(0, 0xaa)).toEqual([15, 0]);
    // bits 6,2,4,0 form pixel 1's four pen bits → pen 15.
    expect(decodeByte(0, 0x55)).toEqual([0, 15]);
  });
});

describe('renderDisplay', () => {
  function paint(mode: number, bytes: Record<number, number>) {
    const ram = new Uint8Array(0x10000);
    for (const [a, v] of Object.entries(bytes)) ram[Number(a)] = v;
    const ga = new GateArray();
    ga.reset();
    ga.writePort(0x80 | mode); // set the screen mode
    const crtc = new Crtc();
    const fb = new Uint8ClampedArray(DISPLAY_WIDTH * DISPLAY_HEIGHT * 4);
    renderDisplay({ read: (a) => ram[a & 0xffff]! }, ga, crtc, fb);
    return { fb, ga };
  }

  const px = (fb: Uint8ClampedArray, x: number, y: number) => {
    const i = (y * DISPLAY_WIDTH + x) * 4;
    return [fb[i], fb[i + 1], fb[i + 2], fb[i + 3]];
  };

  it('colours the top-left pixel from the pen the screen byte selects', () => {
    // Mode 2, byte at &C000 = 0x80: pixel 0 = pen 1, pixel 1 = pen 0.
    const { fb, ga } = paint(2, { 0xc000: 0x80 });
    const [p1r, p1g, p1b] = ga.penRgb(1);
    const [p0r, p0g, p0b] = ga.penRgb(0);
    expect(px(fb, 0, 0)).toEqual([p1r, p1g, p1b, 255]);
    expect(px(fb, 1, 0)).toEqual([p0r, p0g, p0b, 255]);
  });

  it('doubles every native line vertically', () => {
    const { fb } = paint(2, { 0xc000: 0x80 });
    // Native line 0 fills canvas rows 0 and 1 identically.
    expect(px(fb, 0, 0)).toEqual(px(fb, 0, 1));
  });

  it('scales mode 1 pixels to 2× width', () => {
    // Mode 1, &C000 = 0x80 → pixel 0 = pen 1 (bit7 only). xScale = 2.
    const { fb, ga } = paint(1, { 0xc000: 0x80 });
    const [r, g, b] = ga.penRgb(1);
    expect(px(fb, 0, 0)).toEqual([r, g, b, 255]);
    expect(px(fb, 1, 0)).toEqual([r, g, b, 255]); // same pixel, doubled wide
  });

  it('places the second byte of a CRTC cell to the right of the first', () => {
    // Mode 2: byte0 (&C000)=0x00 → 8 pen-0 pixels, byte1 (&C001)=0x80 → pixel 8
    // is pen 1.
    const { fb, ga } = paint(2, { 0xc000: 0x00, 0xc001: 0x80 });
    const [r, g, b] = ga.penRgb(1);
    expect(px(fb, 8, 0)).toEqual([r, g, b, 255]);
  });
});
