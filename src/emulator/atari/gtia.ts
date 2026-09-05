// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { ATARI_PALETTE_RGB } from './palette';

/**
 * The GTIA: the chip that decides what colour every pixel is.
 *
 * ANTIC has no colours of its own. It sends GTIA a stream of two-bit playfield
 * selectors, and GTIA turns each into one of five colour registers, draws the
 * four players and four missiles over or under it according to PRIOR, and
 * records which of them overlapped for the collision registers. Everything the
 * chip does happens in {@link renderScanline}, once per displayed line.
 *
 * Its register file is read/write in name only: nearly every address is one
 * register when written and a different one when read - $D000 is HPOSP0 out and
 * M0PF in - which is why the read and write paths below share no table.
 */

/** Colour clocks across the widest playfield the chip can show. */
export const WINDOW_CLOCKS = 192;

/** Screen pixels per colour clock: the hi-res modes put two dots in each. */
export const PIXELS_PER_CLOCK = 2;

/** The picture the machine advertises. */
export const WINDOW_PIXELS = WINDOW_CLOCKS * PIXELS_PER_CLOCK;
export const ATARI_DISPLAY_WIDTH = WINDOW_PIXELS;
export const ATARI_DISPLAY_HEIGHT = 240;

/**
 * Where the left edge of this window sits in the chip's own horizontal units.
 * HPOS runs 0-227 across the whole scanline; the widest playfield starts at 32,
 * and player positions are given in the same units, so this is what turns one
 * into the other.
 */
export const WINDOW_HPOS = 32;

/** Playfield selectors ANTIC emits, and the colour register each picks. */
export const PF0 = 0;
export const PF1 = 1;
export const PF2 = 2;
export const PF3 = 3;
export const BAK = 4;

/**
 * What {@link Antic} puts in the `direct` line where the selector is the whole
 * answer. Out of range for a colour byte, so no real colour can be mistaken for
 * it.
 */
export const NO_DIRECT = 0x100;

/** Write-side register offsets. */
const HPOSP0 = 0x00;
const HPOSM0 = 0x04;
const SIZEP0 = 0x08;
const SIZEM = 0x0c;
const GRAFP0 = 0x0d;
const GRAFM = 0x11;
const COLPM0 = 0x12;
const COLPF0 = 0x16;
const COLBK = 0x1a;
const PRIOR = 0x1b;
const VDELAY = 0x1c;
const GRACTL = 0x1d;
const HITCLR = 0x1e;
const CONSOL = 0x1f;

/** Read-side register offsets. */
const M0PF = 0x00;
const P0PF = 0x04;
const M0PL = 0x08;
const P0PL = 0x0c;
const TRIG0 = 0x10;
const PAL = 0x14;

/** Index of COLPF0 and COLBK within the nine-register colour file. */
const FIRST_PLAYFIELD = COLPF0 - COLPM0;
const BACKGROUND = COLBK - COLPM0;

/**
 * What $D014 answers. The OS reads it once at power-on to learn which side of
 * the Atlantic it is on; $01 is PAL and $0F is NTSC.
 */
const PAL_MACHINE = 0x01;

/** Pixel widths a player or missile is stretched to, by its two size bits. */
const SIZES = [1, 2, 1, 4] as const;

/** Mask covering the four players, and the four missiles once shifted down. */
const ALL_FOUR = 0x0f;

export interface GtiaConsole {
  /** START, SELECT and OPTION, each true while held. */
  start: boolean;
  select: boolean;
  option: boolean;
}

export class Gtia {
  /** Colour registers COLPM0-3, COLPF0-3, COLBK, indexed from COLPM0. */
  private readonly colours = new Uint8Array(9);
  private readonly hposP = new Uint8Array(4);
  private readonly hposM = new Uint8Array(4);
  private readonly sizeP = new Uint8Array(4);
  private sizeM = 0;
  private readonly grafP = new Uint8Array(4);
  private grafM = 0;
  private prior = 0;
  private gractl = 0;

  /** Collision latches, cleared by a write to HITCLR. */
  private readonly missileToPlayfield = new Uint8Array(4);
  private readonly playerToPlayfield = new Uint8Array(4);
  private readonly missileToPlayer = new Uint8Array(4);
  private readonly playerToPlayer = new Uint8Array(4);

  /** Console keys, read at $D01F, and the joystick fire buttons at $D010-13. */
  readonly console: GtiaConsole = {
    start: false,
    select: false,
    option: false,
  };
  private readonly triggers = [false, false, false, false];

  /**
   * Which players and missiles cover each pixel of the line being drawn. Bits
   * 0-3 are the players, bits 4-7 the missiles. Rebuilt per scanline and kept
   * as a field so a frame allocates nothing.
   */
  private readonly cover = new Uint8Array(WINDOW_PIXELS);

  reset(): void {
    this.colours.fill(0);
    this.hposP.fill(0);
    this.hposM.fill(0);
    this.sizeP.fill(0);
    this.sizeM = 0;
    this.grafP.fill(0);
    this.grafM = 0;
    this.prior = 0;
    this.gractl = 0;
    this.clearCollisions();
    this.console.start = false;
    this.console.select = false;
    this.console.option = false;
    this.triggers.fill(false);
  }

  private clearCollisions(): void {
    this.missileToPlayfield.fill(0);
    this.playerToPlayfield.fill(0);
    this.missileToPlayer.fill(0);
    this.playerToPlayer.fill(0);
  }

  /** The byte in one of the nine colour registers, indexed from COLPM0. */
  colour(index: number): number {
    return this.colours[index]!;
  }

  /** COLBK, which the GTIA modes and every blank line need directly. */
  background(): number {
    return this.colours[BACKGROUND]!;
  }

  /** The colour a playfield selector picks: PF0-3 to COLPF0-3, BAK to COLBK. */
  playfieldColour(selector: number): number {
    return this.colours[FIRST_PLAYFIELD + (selector === BAK ? 4 : selector)]!;
  }

  /** PRIOR's top two bits: 0 for ordinary colour, 1-3 for the GTIA modes. */
  gtiaMode(): number {
    return (this.prior >> 6) & 3;
  }

  /** Hold or release a joystick fire button; ports 0 and 1 are the two sticks. */
  setTrigger(port: number, pressed: boolean): void {
    this.triggers[port & 3] = pressed;
  }

  /** ANTIC's player DMA hands each player its byte for the coming scanline. */
  setPlayerGraphics(player: number, byte: number): void {
    this.grafP[player & 3] = byte & 0xff;
  }

  /** ANTIC's missile DMA hands all four missiles their two bits at once. */
  setMissileGraphics(byte: number): void {
    this.grafM = byte & 0xff;
  }

  /** Whether ANTIC should fetch player graphics for this scanline. */
  playerDmaEnabled(): boolean {
    return (this.gractl & 0x02) !== 0;
  }

  /** Whether ANTIC should fetch missile graphics for this scanline. */
  missileDmaEnabled(): boolean {
    return (this.gractl & 0x01) !== 0;
  }

  read(reg: number): number {
    if (reg < M0PF + 4) return this.missileToPlayfield[reg - M0PF]!;
    if (reg < P0PF + 4) return this.playerToPlayfield[reg - P0PF]!;
    if (reg < M0PL + 4) return this.missileToPlayer[reg - M0PL]!;
    if (reg < P0PL + 4) return this.playerToPlayer[reg - P0PL]!;
    if (reg < TRIG0 + 4) {
      // Active low: a button reads 0 while held, and an empty port reads 1.
      return this.triggers[reg - TRIG0] ? 0 : 1;
    }
    if (reg === PAL) return PAL_MACHINE;
    if (reg === CONSOL) {
      let byte = 0x07;
      if (this.console.start) byte &= ~0x01;
      if (this.console.select) byte &= ~0x02;
      if (this.console.option) byte &= ~0x04;
      return byte;
    }
    // The rest of the file is write-only; the data lines float.
    return 0x0f;
  }

  write(reg: number, value: number): void {
    const byte = value & 0xff;
    if (reg < HPOSM0) {
      this.hposP[reg - HPOSP0] = byte;
      return;
    }
    if (reg < SIZEP0) {
      this.hposM[reg - HPOSM0] = byte;
      return;
    }
    if (reg < SIZEM) {
      this.sizeP[reg - SIZEP0] = byte & 3;
      return;
    }
    if (reg === SIZEM) {
      this.sizeM = byte;
      return;
    }
    if (reg < GRAFM) {
      this.grafP[reg - GRAFP0] = byte;
      return;
    }
    if (reg === GRAFM) {
      this.grafM = byte;
      return;
    }
    if (reg < PRIOR) {
      this.colours[reg - COLPM0] = byte;
      return;
    }
    switch (reg) {
      case PRIOR:
        this.prior = byte;
        return;
      case GRACTL:
        this.gractl = byte;
        return;
      case HITCLR:
        this.clearCollisions();
        return;
      case VDELAY:
      // VDELAY moves a player down one scanline in two-line resolution, which
      // this scanline-at-a-time renderer draws no differently.
      // falls through
      default:
        // CONSOL's write side drives the console speaker, which this machine
        // does not sound.
        return;
    }
  }

  /**
   * Paint one scanline into `rgba`.
   *
   * `selectors` is what ANTIC emitted for the line, one entry per screen pixel
   * holding PF0-3 or BAK; `direct` carries the colour byte itself where ANTIC
   * has already resolved one (the GTIA modes, and the hi-res blend), or
   * {@link NO_DIRECT} where the selector is the answer. Players and missiles
   * are laid over or under the result per PRIOR, and every overlap is recorded
   * on the way past - the collision registers are a by-product of drawing, on
   * the chip and here alike.
   */
  renderScanline(
    selectors: Uint8Array,
    direct: Uint16Array,
    rgba: Uint8ClampedArray,
    row: number,
  ): void {
    const cover = this.cover;
    cover.fill(0);
    this.layPlayers(cover);
    this.layMissiles(cover);

    const fifth = (this.prior & 0x10) !== 0;
    const multicolour = (this.prior & 0x20) !== 0;
    const order = this.prior & 0x0f;
    let at = row * WINDOW_PIXELS * 4;

    for (let x = 0; x < WINDOW_PIXELS; x++) {
      const selector = selectors[x]!;
      const given = direct[x]!;
      const playfield =
        given === NO_DIRECT ? this.playfieldColour(selector) : given;
      const bits = cover[x]!;
      let colour = playfield;

      if (bits !== 0) {
        this.recordCollisions(bits, selector);
        colour = this.resolve(
          bits,
          selector,
          playfield,
          order,
          fifth,
          multicolour,
        );
      }

      const p = colour * 3;
      rgba[at++] = ATARI_PALETTE_RGB[p]!;
      rgba[at++] = ATARI_PALETTE_RGB[p + 1]!;
      rgba[at++] = ATARI_PALETTE_RGB[p + 2]!;
      rgba[at++] = 255;
    }
  }

  /** Fill a whole scanline with the background colour: a blank line. */
  fillBackground(rgba: Uint8ClampedArray, row: number): void {
    const p = this.background() * 3;
    const r = ATARI_PALETTE_RGB[p]!;
    const g = ATARI_PALETTE_RGB[p + 1]!;
    const b = ATARI_PALETTE_RGB[p + 2]!;
    let at = row * WINDOW_PIXELS * 4;
    for (let x = 0; x < WINDOW_PIXELS; x++) {
      rgba[at++] = r;
      rgba[at++] = g;
      rgba[at++] = b;
      rgba[at++] = 255;
    }
  }

  /** Stamp each player's eight bits into the coverage map at its position. */
  private layPlayers(cover: Uint8Array): void {
    for (let p = 0; p < 4; p++) {
      const graphics = this.grafP[p]!;
      if (graphics === 0) continue;
      const width = SIZES[this.sizeP[p]!]! * PIXELS_PER_CLOCK;
      const start = (this.hposP[p]! - WINDOW_HPOS) * PIXELS_PER_CLOCK;
      for (let bit = 0; bit < 8; bit++) {
        if ((graphics & (0x80 >> bit)) === 0) continue;
        this.stamp(cover, start + bit * width, width, 1 << p);
      }
    }
  }

  /** The same for the four missiles, whose two bits each share one byte. */
  private layMissiles(cover: Uint8Array): void {
    if (this.grafM === 0) return;
    for (let m = 0; m < 4; m++) {
      const graphics = (this.grafM >> (m * 2)) & 3;
      if (graphics === 0) continue;
      const width = SIZES[(this.sizeM >> (m * 2)) & 3]! * PIXELS_PER_CLOCK;
      const start = (this.hposM[m]! - WINDOW_HPOS) * PIXELS_PER_CLOCK;
      for (let bit = 0; bit < 2; bit++) {
        if ((graphics & (0x02 >> bit)) === 0) continue;
        this.stamp(cover, start + bit * width, width, 0x10 << m);
      }
    }
  }

  private stamp(
    cover: Uint8Array,
    from: number,
    width: number,
    bit: number,
  ): void {
    const start = from < 0 ? 0 : from;
    const end = Math.min(from + width, WINDOW_PIXELS);
    for (let x = start; x < end; x++) cover[x] = cover[x]! | bit;
  }

  /** Latch every overlap at this pixel into the collision registers. */
  private recordCollisions(bits: number, selector: number): void {
    const playfield = selector === BAK ? 0 : 1 << selector;
    const players = bits & ALL_FOUR;
    const missiles = (bits >> 4) & ALL_FOUR;
    for (let n = 0; n < 4; n++) {
      const mask = 1 << n;
      if (players & mask) {
        this.playerToPlayfield[n] = this.playerToPlayfield[n]! | playfield;
        // A player never collides with itself, however it overlaps.
        this.playerToPlayer[n] = this.playerToPlayer[n]! | (players & ~mask);
      }
      if (missiles & mask) {
        this.missileToPlayfield[n] = this.missileToPlayfield[n]! | playfield;
        this.missileToPlayer[n] = this.missileToPlayer[n]! | players;
      }
    }
  }

  /**
   * The colour at one pixel where something is drawn over the playfield.
   *
   * PRIOR's low four bits are one-hot, each naming one of the four orders the
   * chip can resolve. With none of them set nothing wins and the chip drives
   * every active source's colour onto the lines at once, which is the OR the
   * last branch reproduces.
   */
  private resolve(
    bits: number,
    selector: number,
    playfield: number,
    order: number,
    fifth: boolean,
    multicolour: boolean,
  ): number {
    // With the fifth-player bit set the four missiles stop taking their
    // players' colours and become one more object drawn in COLPF3.
    const missiles = (bits >> 4) & ALL_FOUR;
    const players = fifth ? bits & ALL_FOUR : (bits & ALL_FOUR) | missiles;
    const overPlayfield = selector !== BAK;

    if (players === 0) {
      // Only missiles here, and only the fifth player draws on its own.
      return fifth && missiles !== 0
        ? this.colours[FIRST_PLAYFIELD + 3]!
        : playfield;
    }

    let ink = 0;
    for (let n = 0; n < 4; n++) {
      if ((players & (1 << n)) === 0) continue;
      const c = this.colours[n]!;
      if (ink === 0) ink = c;
      // Overlapping players share a colour in multicolour mode: the chip drives
      // both registers onto the lines rather than picking one.
      else if (multicolour) ink |= c;
      else break;
    }

    switch (order) {
      case 0x01: // every player in front of the whole playfield
        return ink;
      case 0x02: // players 0-1 in front, players 2-3 behind the playfield
        if (players & 0x03) return ink;
        return overPlayfield ? playfield : ink;
      case 0x04: // the playfield in front of every player
        return overPlayfield ? playfield : ink;
      case 0x08: // players between PF0-1 and PF2-3
        if (overPlayfield && (selector === PF0 || selector === PF1)) {
          return playfield;
        }
        return ink;
      default:
        return overPlayfield ? playfield | ink : ink;
    }
  }
}
