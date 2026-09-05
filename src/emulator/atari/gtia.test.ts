import { beforeEach, describe, expect, it } from 'vitest';
import {
  BAK,
  Gtia,
  NO_DIRECT,
  PF0,
  PF2,
  WINDOW_HPOS,
  WINDOW_PIXELS,
} from './gtia';
import { ATARI_PALETTE } from './palette';

/** Register offsets, write side. */
const HPOSP0 = 0x00;
const HPOSM0 = 0x04;
const SIZEP0 = 0x08;
const SIZEM = 0x0c;
const GRAFP0 = 0x0d;
const GRAFM = 0x11;
const COLPM0 = 0x12;
const COLPF0 = 0x16;
const COLPF3 = 0x19;
const COLBK = 0x1a;
const PRIOR = 0x1b;
const HITCLR = 0x1e;

/** Register offsets, read side. */
const P0PF = 0x04;
const P0PL = 0x0c;
const TRIG0 = 0x10;
const PAL = 0x14;
const CONSOL = 0x1f;

describe('GTIA', () => {
  let gtia: Gtia;
  let rgba: Uint8ClampedArray;
  let selectors: Uint8Array;
  let direct: Uint16Array;

  beforeEach(() => {
    gtia = new Gtia();
    rgba = new Uint8ClampedArray(WINDOW_PIXELS * 4);
    selectors = new Uint8Array(WINDOW_PIXELS).fill(BAK);
    direct = new Uint16Array(WINDOW_PIXELS).fill(NO_DIRECT);
    gtia.write(COLPM0, 0x2a); // player 0
    gtia.write(COLPM0 + 1, 0x5a); // player 1
    gtia.write(COLPF0, 0x28);
    gtia.write(COLPF0 + 2, 0x94); // COLPF2
    gtia.write(COLPF3, 0xc8);
    gtia.write(COLBK, 0x00);
  });

  const draw = () => gtia.renderScanline(selectors, direct, rgba, 0);

  const pixel = (x: number): string => {
    const p = x * 4;
    return `${rgba[p]},${rgba[p + 1]},${rgba[p + 2]}`;
  };

  const colour = (byte: number): string => {
    const [r, g, b] = ATARI_PALETTE[byte]!;
    return `${r},${g},${b}`;
  };

  /** Lay a solid eight-bit player at window pixel `x`. */
  const placePlayer = (player: number, x: number, graphics = 0xff) => {
    gtia.write(HPOSP0 + player, WINDOW_HPOS + x / 2);
    gtia.write(GRAFP0 + player, graphics);
  };

  it('paints the playfield through the colour registers', () => {
    selectors.fill(PF0, 0, 8);
    selectors.fill(PF2, 8, 16);
    draw();
    expect(pixel(0)).toBe(colour(0x28));
    expect(pixel(8)).toBe(colour(0x94));
    expect(pixel(16)).toBe(colour(0x00));
  });

  it('takes the colour ANTIC has already resolved, where it has one', () => {
    selectors.fill(PF2, 0, 4);
    direct.fill(0xc6, 0, 4);
    draw();
    expect(pixel(0)).toBe(colour(0xc6));
  });

  it('stretches a player to the width its size bits ask for', () => {
    placePlayer(0, 20, 0x80); // one bit set, so one pixel of player
    gtia.write(PRIOR, 0x01);
    draw();
    expect(pixel(20)).toBe(colour(0x2a));
    expect(pixel(22)).toBe(colour(0x00));

    gtia.write(SIZEP0, 3); // four times as wide
    draw();
    for (let x = 20; x < 28; x++) expect(pixel(x)).toBe(colour(0x2a));
    expect(pixel(28)).toBe(colour(0x00));
  });

  it('puts a player in front of or behind the playfield, per PRIOR', () => {
    selectors.fill(PF2);
    placePlayer(0, 40);
    gtia.write(PRIOR, 0x01); // players in front
    draw();
    expect(pixel(40)).toBe(colour(0x2a));

    gtia.write(PRIOR, 0x04); // playfield in front
    draw();
    expect(pixel(40)).toBe(colour(0x94));
  });

  it('sorts players 0-1 in front of the playfield and 2-3 behind it', () => {
    selectors.fill(PF2);
    gtia.write(PRIOR, 0x02);
    placePlayer(1, 40);
    draw();
    expect(pixel(40)).toBe(colour(0x5a));

    gtia.write(GRAFP0 + 1, 0); // put player 2 there instead
    gtia.write(COLPM0 + 2, 0x66);
    placePlayer(2, 40);
    draw();
    expect(pixel(40)).toBe(colour(0x94));
  });

  it('draws the missiles as a fifth player when PRIOR says so', () => {
    gtia.write(PRIOR, 0x11); // players in front, missiles as the fifth player
    gtia.write(HPOSM0, WINDOW_HPOS + 30);
    gtia.write(SIZEM, 0);
    gtia.write(GRAFM, 0x03); // both bits of missile 0
    draw();
    expect(pixel(60)).toBe(colour(0xc8)); // COLPF3, not player 0's colour
  });

  it('records what overlapped what', () => {
    selectors.fill(PF2, 40, 60);
    placePlayer(0, 40);
    placePlayer(1, 44);
    gtia.write(PRIOR, 0x01);
    draw();
    // Player 0 sat over COLPF2 and over player 1.
    expect(gtia.read(P0PF) & (1 << PF2)).not.toBe(0);
    expect(gtia.read(P0PL) & 0x02).toBe(0x02);
    // A player never collides with itself.
    expect(gtia.read(P0PL) & 0x01).toBe(0);

    gtia.write(HITCLR, 0);
    expect(gtia.read(P0PF)).toBe(0);
    expect(gtia.read(P0PL)).toBe(0);
  });

  it('reads the console keys and the fire buttons active-low', () => {
    expect(gtia.read(CONSOL)).toBe(0x07);
    gtia.console.select = true;
    expect(gtia.read(CONSOL)).toBe(0x05);

    expect(gtia.read(TRIG0)).toBe(1);
    gtia.setTrigger(0, true);
    expect(gtia.read(TRIG0)).toBe(0);
    // The two ports nothing is plugged into stay released.
    expect(gtia.read(TRIG0 + 2)).toBe(1);
  });

  it('says it is a PAL machine', () => {
    expect(gtia.read(PAL)).toBe(0x01);
  });

  it('clips a player that runs off either edge', () => {
    gtia.write(PRIOR, 0x01);
    placePlayer(0, -4);
    expect(() => draw()).not.toThrow();
    expect(pixel(0)).toBe(colour(0x2a));

    gtia.write(GRAFP0, 0);
    placePlayer(0, WINDOW_PIXELS - 4);
    expect(() => draw()).not.toThrow();
    expect(pixel(WINDOW_PIXELS - 1)).toBe(colour(0x2a));
  });
});
