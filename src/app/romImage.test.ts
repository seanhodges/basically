import { describe, expect, it } from 'vitest';
import { fitRomImage } from './romImage';

describe('fitRomImage', () => {
  it('hands back an image that already fills the area', () => {
    const rom = Uint8Array.from({ length: 8 }, (_, i) => i);
    expect(fitRomImage(rom, 8)).toBe(rom);
  });

  it('pads a short image as unprogrammed ROM, from the base of the area', () => {
    // 0xFF, not 0x00: an unblown EPROM reads as 0xFF, and the supplied bytes
    // have to start at address 0 or nothing the image contains is reachable.
    const fitted = fitRomImage(Uint8Array.of(1, 2, 3), 6);
    expect(Array.from(fitted)).toEqual([1, 2, 3, 0xff, 0xff, 0xff]);
  });

  it('takes the leading bytes of a long image', () => {
    const fitted = fitRomImage(Uint8Array.of(1, 2, 3, 4, 5), 3);
    expect(Array.from(fitted)).toEqual([1, 2, 3]);
  });

  it('fits an empty file to the whole area', () => {
    const fitted = fitRomImage(new Uint8Array(0), 4);
    expect(Array.from(fitted)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('does not write through to the image it was given', () => {
    const rom = Uint8Array.of(1, 2, 3, 4);
    const fitted = fitRomImage(rom, 8);
    fitted[0] = 9;
    expect(rom[0]).toBe(1);
  });
});
