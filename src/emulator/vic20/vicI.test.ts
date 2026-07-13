import { describe, expect, it } from 'vitest';
import { VicI, VIC20_DISPLAY_WIDTH, VIC20_PALETTE } from './vicI';

const BORDER_X = 28;
const BORDER_Y = 32;

/** RGB triple of the visible pixel at (x, y) in a rendered VIC-I buffer. */
function pixel(vic: VicI, x: number, y: number): [number, number, number] {
  const i = (y * VIC20_DISPLAY_WIDTH + x) * 4;
  return [vic.rgba[i]!, vic.rgba[i + 1]!, vic.rgba[i + 2]!];
}

/**
 * A blank 64 KB image wired for the default unexpanded layout: screen at $1E00,
 * colour at $9600, character generator at $8000. Register 2 bit 7 selects the
 * $1E00/$9600 pair, register 5 = $F0 keeps char base $8000.
 */
function blankImage(vic: VicI): Uint8Array {
  const mem = new Uint8Array(0x10000);
  vic.reset();
  vic.writeRegister(0x02, 0x96); // bit 7 → screen $1E00 / colour $9600
  vic.writeRegister(0x05, 0xf0); // screen base nibble + char base $8000
  return mem;
}

describe('VicI', () => {
  it('blits a fully-lit glyph in its cell colour over the background', () => {
    const vic = new VicI();
    const mem = blankImage(vic);
    // Black background, cyan (3) border.
    vic.writeRegister(0x0f, (0 << 4) | 3);
    // A synthetic glyph for screen code 5: every pixel lit.
    for (let r = 0; r < 8; r++) mem[0x8000 + 5 * 8 + r] = 0xff;
    // Put code 5 in the top-left cell, coloured white (index 1).
    mem[0x1e00] = 5;
    mem[0x9600] = 1;

    vic.render(mem);

    // Top-left glyph pixel is the cell foreground (white).
    expect(pixel(vic, BORDER_X, BORDER_Y)).toEqual([...VIC20_PALETTE[1]!]);
    // A pixel outside the character area is the border (cyan).
    expect(pixel(vic, 0, 0)).toEqual([...VIC20_PALETTE[3]!]);
  });

  it('fills an unlit cell with the live background colour', () => {
    const vic = new VicI();
    const mem = blankImage(vic);
    // Background purple (4), border black (0). Glyph 0 is left blank (all bits 0).
    vic.writeRegister(0x0f, (4 << 4) | 0);
    mem[0x1e00] = 0;
    mem[0x9600] = 1;

    vic.render(mem);

    // The unlit glyph body shows the register-4 background, proving the
    // background/border are read live from $900F each frame (POKE 36879).
    expect(pixel(vic, BORDER_X, BORDER_Y)).toEqual([...VIC20_PALETTE[4]!]);
    expect(pixel(vic, 0, 0)).toEqual([...VIC20_PALETTE[0]!]);
  });

  it('tracks the screen/colour base when register 2 bit 7 is cleared', () => {
    const vic = new VicI();
    const mem = new Uint8Array(0x10000);
    vic.reset();
    vic.writeRegister(0x02, 0x16); // bit 7 clear → screen $1C00 / colour $9400
    vic.writeRegister(0x05, 0xf0);
    vic.writeRegister(0x0f, (0 << 4) | 0);
    for (let r = 0; r < 8; r++) mem[0x8000 + 1 * 8 + r] = 0xff; // glyph 1 lit
    mem[0x1c00] = 1; // screen now at $1C00
    mem[0x9400] = 5; // colour now at $9400 (green)

    vic.render(mem);

    expect(pixel(vic, BORDER_X, BORDER_Y)).toEqual([...VIC20_PALETTE[5]!]);
  });
});
