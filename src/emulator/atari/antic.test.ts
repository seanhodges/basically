import { beforeEach, describe, expect, it } from 'vitest';
import { Antic, SCANLINES_PER_FRAME } from './antic';
import { ATARI_PALETTE } from './palette';
import { ATARI_DISPLAY_HEIGHT, Gtia, WINDOW_PIXELS } from './gtia';

/**
 * ANTIC driven on a hand-written display list rather than through the ROM, so
 * each fact is checked on the smallest program that states it. The machine test
 * covers the chip against the OS's own list; this one covers the instructions
 * the OS never uses.
 */

/** Where the display list is put, well clear of anything else. */
const DLIST = 0x1000;
/** Where the screen data goes, and the character generator after it. */
const SCREEN = 0x2000;
const FONT = 0x3000;

/** ANTIC's registers, at their offsets in its page. */
const DMACTL = 0x00;
const DLISTL = 0x02;
const DLISTH = 0x03;
const HSCROL = 0x04;
const CHBASE = 0x09;
const VCOUNT = 0x0b;
const NMIEN = 0x0e;
const NMIST = 0x0f;

/** DMACTL: display list DMA on, normal playfield width. */
const NORMAL = 0x22;

/**
 * Colours the tests set, so every playfield register is distinguishable from
 * every other and from the border. COLPF2 and COLPF1 are the pair GRAPHICS 0
 * uses - the paper and the ink's luminance.
 */
const COLOURS = { pf0: 0x28, pf1: 0x0a, pf2: 0x94, pf3: 0xc8, bak: 0x00 };

describe('ANTIC', () => {
  let mem: Uint8Array;
  let gtia: Gtia;
  let antic: Antic;
  let nmis: number;

  beforeEach(() => {
    mem = new Uint8Array(0x10000);
    gtia = new Gtia();
    nmis = 0;
    antic = new Antic(mem, gtia, () => nmis++);
    gtia.write(0x16, COLOURS.pf0);
    gtia.write(0x17, COLOURS.pf1);
    gtia.write(0x18, COLOURS.pf2);
    gtia.write(0x19, COLOURS.pf3);
    gtia.write(0x1a, COLOURS.bak);
    antic.write(DLISTL, DLIST & 0xff);
    antic.write(DLISTH, DLIST >> 8);
    antic.write(CHBASE, FONT >> 8);
    antic.write(DMACTL, NORMAL);
  });

  /** Write a display list, one byte per argument. */
  const list = (...bytes: number[]) => mem.set(Uint8Array.from(bytes), DLIST);

  /** Run one whole frame. */
  const frame = () => {
    for (let line = 0; line < SCANLINES_PER_FRAME; line++) {
      antic.startScanline();
      antic.endScanline();
    }
  };

  /** The colour at one pixel, as a comparable string. */
  const pixel = (row: number, x: number): string => {
    const p = (row * WINDOW_PIXELS + x) * 4;
    return `${antic.rgba[p]},${antic.rgba[p + 1]},${antic.rgba[p + 2]}`;
  };

  /** COLBK as it comes out of the palette: what a row with no playfield is. */
  const border = (): string => {
    const [r, g, b] = ATARI_PALETTE[gtia.background()]!;
    return `${r},${g},${b}`;
  };

  /** Pixels of `row` that are not the background: the playfield's footprint. */
  const playfieldWidth = (row: number): number => {
    let width = 0;
    for (let x = 0; x < WINDOW_PIXELS; x++)
      if (pixel(row, x) !== border()) width++;
    return width;
  };

  /** Whether `row` shows any playfield at all. */
  const hasPlayfield = (row: number): boolean => playfieldWidth(row) > 0;

  /** How many distinct colours the normal-width playfield of `row` holds. */
  const rowColours = (row: number): Set<string> => {
    const seen = new Set<string>();
    for (let x = 32; x < WINDOW_PIXELS - 32; x++) seen.add(pixel(row, x));
    return seen;
  };

  it('counts scanlines in pairs on VCOUNT', () => {
    expect(antic.read(VCOUNT)).toBe(0);
    for (let i = 0; i < 5; i++) {
      antic.startScanline();
      antic.endScanline();
    }
    expect(antic.read(VCOUNT)).toBe(2);
  });

  it('puts blank instructions where they are asked for', () => {
    // Eight blank lines, then a mode 2 line of solid glyphs, then wait.
    mem.fill(0xff, FONT, FONT + 0x400);
    mem.fill(0x01, SCREEN, SCREEN + 40);
    list(
      0x70,
      0x42,
      SCREEN & 0xff,
      SCREEN >> 8,
      0x41,
      DLIST & 0xff,
      DLIST >> 8,
    );
    frame();
    // The list starts on scanline 8, and the window's first row is scanline 8.
    for (let row = 0; row < 8; row++) expect(hasPlayfield(row)).toBe(false);
    for (let row = 8; row < 16; row++) expect(hasPlayfield(row)).toBe(true);
    expect(hasPlayfield(16)).toBe(false);
  });

  it('gives each mode its own number of scanlines', () => {
    // Mode 7 is sixteen scanlines tall; mode 2 is eight.
    mem.fill(0xff, FONT, FONT + 0x400);
    mem.fill(0xc1, SCREEN, SCREEN + 40); // colour bits set, glyph 1
    list(0x47, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    frame();
    for (let row = 0; row < 16; row++) expect(hasPlayfield(row)).toBe(true);
    expect(hasPlayfield(16)).toBe(false);
  });

  it('follows a jump to a second list', () => {
    const second = DLIST + 0x100;
    mem.fill(0xff, FONT, FONT + 0x400);
    mem.fill(0x01, SCREEN, SCREEN + 40);
    // Jump straight to a list that shows one mode 2 line, then waits.
    list(0x01, second & 0xff, second >> 8);
    mem.set(
      Uint8Array.from([
        0x42,
        SCREEN & 0xff,
        SCREEN >> 8,
        0x41,
        DLIST & 0xff,
        DLIST >> 8,
      ]),
      second,
    );
    frame();
    expect(hasPlayfield(0)).toBe(true);
    expect(hasPlayfield(8)).toBe(false);
  });

  it('stops fetching after a jump-and-wait until the next frame', () => {
    mem.fill(0xff, FONT, FONT + 0x400);
    mem.fill(0x01, SCREEN, SCREEN + 40);
    list(0x42, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    frame();
    expect(hasPlayfield(0)).toBe(true);
    for (let row = 8; row < ATARI_DISPLAY_HEIGHT; row++) {
      expect(hasPlayfield(row)).toBe(false);
    }
    // And the next frame starts the list again from the top.
    frame();
    expect(hasPlayfield(0)).toBe(true);
  });

  it('raises a vertical blank interrupt once a frame, when enabled', () => {
    list(0x41, DLIST & 0xff, DLIST >> 8);
    frame();
    expect(nmis).toBe(0);
    expect(antic.read(NMIST) & 0x40).toBe(0x40);

    antic.write(NMIEN, 0x40);
    frame();
    expect(nmis).toBe(1);
  });

  it('raises a display list interrupt on the last line of its mode line', () => {
    antic.write(NMIEN, 0x80);
    // A mode 2 line with the interrupt bit set, followed by the wait.
    list(0xc2, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    for (let line = 0; line < 8 + 7; line++) {
      antic.startScanline();
      antic.endScanline();
    }
    expect(nmis).toBe(0); // seven lines in, one to go
    antic.startScanline();
    expect(nmis).toBe(1);
    expect(antic.read(NMIST) & 0x80).toBe(0x80);
  });

  it('shows nothing at all with playfield DMA off', () => {
    mem.fill(0xff, FONT, FONT + 0x400);
    mem.fill(0x01, SCREEN, SCREEN + 40);
    list(0x42, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    antic.write(DMACTL, 0x20); // list DMA on, no playfield
    frame();
    expect(hasPlayfield(0)).toBe(false);
  });

  it('narrows and widens the playfield', () => {
    mem.fill(0xff, FONT, FONT + 0x400);
    mem.fill(0x01, SCREEN, SCREEN + 48);
    list(0x42, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);

    antic.write(DMACTL, 0x21); // narrow: 128 colour clocks
    frame();
    expect(playfieldWidth(0)).toBe(128 * 2);
    antic.write(DMACTL, 0x22); // normal: 160
    frame();
    expect(playfieldWidth(0)).toBe(160 * 2);
    antic.write(DMACTL, 0x23); // wide: 192, the whole window
    frame();
    expect(playfieldWidth(0)).toBe(192 * 2);
  });

  it('fetches a wider line for one it is fine-scrolling', () => {
    // A scrolled line fetches the next width up and shows a window of it moved
    // by HSCROL, so the content that scrolls in comes from real bytes rather
    // than from the background.
    mem.fill(0xff, FONT, FONT + 0x400);
    mem.fill(0x01, SCREEN, SCREEN + 48);
    list(0x52, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    antic.write(HSCROL, 8);
    frame();
    // The programmed width is still 160 colour clocks - pixels 32 to 351 - and
    // every one of them holds playfield, including the ones at the right that a
    // line fetched at its own width would have run out of.
    for (let x = 32; x < 352; x++) expect(pixel(0, x)).not.toBe(border());
    // And ANTIC charges the CPU for the bytes it really fetched: 48 rather
    // than the 40 the programmed width would have taken.
    while (antic.currentScanline() < 8) {
      antic.startScanline();
      antic.endScanline();
    }
    antic.startScanline();
    expect(antic.dmaCycles()).toBe(9 + 3 + 48 * 2);
  });

  it('gives the two-bit modes four colours and the hi-res modes two', () => {
    // Mode 14 is two bits a pixel over the four playfield registers.
    gtia.write(0x16, 0x28); // COLPF0
    gtia.write(0x17, 0x46); // COLPF1
    gtia.write(0x18, 0xc8); // COLPF2
    gtia.write(0x1a, 0x00); // COLBK
    mem.fill(0b00011011, SCREEN, SCREEN + 40);
    list(0x4e, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    frame();
    expect(rowColours(0).size).toBe(4);

    // Mode 15 is one bit a pixel: COLPF1's luminance over COLPF2's hue.
    mem.fill(0b10101010, SCREEN, SCREEN + 40);
    list(0x4f, SCREEN & 0xff, SCREEN >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    frame();
    expect(rowColours(0).size).toBe(2);
  });

  it('wraps the memory scan inside its 4K page', () => {
    // A mode 15 line starting eight bytes below a 4K boundary reads those eight
    // and then wraps to the start of the *same* page, rather than running on
    // into the next one. So the bytes just past the boundary are never shown
    // and the ones at $2000 are.
    const base = 0x2ff8;
    mem.fill(0xff, base, base + 8); // the eight before the wrap: lit
    mem.fill(0x00, 0x2000, 0x2000 + 40); // where it wraps to: dark
    mem.fill(0xff, 0x3000, 0x3000 + 40); // past the boundary: never read
    list(0x4f, base & 0xff, base >> 8, 0x41, DLIST & 0xff, DLIST >> 8);
    frame();
    // Mode 15 is one pixel per bit, so the first eight bytes are 64 pixels of
    // ink starting at the left edge of the normal-width playfield.
    const ink = pixel(0, 32);
    const paper = pixel(0, 96);
    expect(ink).not.toBe(paper);
    for (let x = 32; x < 96; x++) expect(pixel(0, x)).toBe(ink);
    for (let x = 96; x < 352; x++) expect(pixel(0, x)).toBe(paper);
  });

  it('charges the CPU for the fetches it makes', () => {
    // A blank line costs only the refresh and the instruction.
    list(
      0x70,
      0x42,
      SCREEN & 0xff,
      SCREEN >> 8,
      0x41,
      DLIST & 0xff,
      DLIST >> 8,
    );
    /** Advance to `scanline` and answer what ANTIC charges for it. */
    const chargeAt = (scanline: number): number => {
      while (antic.currentScanline() < scanline) {
        antic.startScanline();
        antic.endScanline();
      }
      antic.startScanline();
      const charge = antic.dmaCycles();
      antic.endScanline();
      return charge;
    };

    // The list starts on scanline 8 with eight blank lines, so the mode 2 line
    // begins on scanline 16.
    const blank = chargeAt(10);
    const first = chargeAt(16);
    const rest = chargeAt(17);

    expect(blank).toBe(9 + 3);
    expect(first).toBe(9 + 3 + 80);
    expect(rest).toBe(9 + 3 + 40);
    // Which is what makes a text screen the expensive one: two thirds of the
    // line is ANTIC's on the row where it reads the characters.
    expect(first).toBeGreaterThan(rest);
  });
});
