// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MsxModel } from './model';

/**
 * The TMS9918A-family video display processor: 16KB of VRAM in an address
 * space of its own, reached by the CPU only through ports 0x98 (data, with an
 * auto-incrementing address latch) and 0x99 (register write / status read).
 *
 * The separate address space is the fact that shapes everything above it - MSX
 * BASIC's VPOKE and VPEEK exist because a CPU POKE cannot reach the screen.
 *
 * **Which part this models.** The four documented screen modes (text,
 * graphic 1, graphic 2 and multicolour), the sprite generator in its four
 * combinations of size and magnification, and the status register's frame,
 * collision and fifth-sprite flags. It does NOT implement the undocumented
 * mixed modes an original TMS9918A produces when two mode bits are set at once:
 * the Toshiba T6950 fitted to this machine does not have them either, and a
 * {@link MsxModel} naming the original gets the same blank screen rather than a
 * guess at silicon nobody here has measured.
 *
 * The mode bits are the other trap. M1 and M2 live in register 1 but M3 lives
 * in register 0, so a mode change is two writes and the chip spends the gap in
 * whatever combination the first write left - which is why the decode below
 * treats every non-standard combination as a mode rather than as an error.
 */
export const VRAM_SIZE = 0x4000;
/** Registers 0-7; the TMS9918A has no more, and writes above them are dropped. */
export const REGISTER_COUNT = 8;

/** Status bit 7: an active display has ended since the last status read. */
export const STATUS_FRAME = 0x80;
/** Status bit 6: more than four sprites were found on one line. */
export const STATUS_FIFTH_SPRITE = 0x40;
/** Status bit 5: two sprites overlapped on an opaque pixel. */
export const STATUS_COLLISION = 0x20;

export type VdpMode =
  | 'text' //         SCREEN 0: 40x24 characters, two colours
  | 'graphic1' //     SCREEN 1: 32x24 characters, colour per group of eight
  | 'graphic2' //     SCREEN 2: 256x192, colour per eight-pixel row of a pattern
  | 'multicolour' //  SCREEN 3: 64x48 blocks of solid colour
  | 'undocumented'; // a mixed mode this part does not implement

export class Tms9918 {
  readonly vram = new Uint8Array(VRAM_SIZE);
  readonly registers = new Uint8Array(REGISTER_COUNT);

  private statusByte = 0;
  /** The 14-bit VRAM pointer ports 0x98/0x99 share. */
  private address = 0;
  /** First byte of a port 0x99 pair, held until the second says what it was. */
  private firstByte = 0;
  private awaitingSecond = false;
  /**
   * The chip reads VRAM ahead of the CPU: a data read returns the byte fetched
   * by the previous access, and setting a read address prefetches one. A reader
   * that skips this returns each byte one access early, which shows up as a
   * screen scrolled by one character rather than as an obvious fault.
   */
  private readAhead = 0;

  constructor(private readonly model: MsxModel) {}

  reset(): void {
    this.vram.fill(0);
    this.registers.fill(0);
    this.statusByte = 0;
    this.address = 0;
    this.firstByte = 0;
    this.awaitingSecond = false;
    this.readAhead = 0;
  }

  /** Port 0x98: read VRAM at the latched address, then advance it. */
  readData(): number {
    const value = this.readAhead;
    this.readAhead = this.vram[this.address]!;
    this.advance();
    this.awaitingSecond = false;
    return value;
  }

  /** Port 0x98: write VRAM at the latched address, then advance it. */
  writeData(value: number): void {
    this.vram[this.address] = value & 0xff;
    // A write also fills the read-ahead latch, so an interleaved read after a
    // write returns the byte just written rather than a stale fetch.
    this.readAhead = value & 0xff;
    this.advance();
    this.awaitingSecond = false;
  }

  /**
   * Port 0x99 read: the status byte. Reading it clears the three flags and
   * abandons any half-written address pair. The fifth sprite's *number* in the
   * low five bits is not cleared - the sprite scanner rewrites it as each frame
   * is drawn, and it means nothing until the flag above it is set again.
   */
  readStatus(): number {
    const value = this.statusByte;
    this.statusByte &= ~(STATUS_FRAME | STATUS_FIFTH_SPRITE | STATUS_COLLISION);
    this.awaitingSecond = false;
    return value;
  }

  /**
   * Port 0x99 write: the second byte of each pair says what the first was.
   * 0b1RRR_RRRR writes register RRR, 0b01xx_xxxx sets a write address and
   * 0b00xx_xxxx a read address - the read form prefetching immediately, which
   * is what makes {@link readData} return the right byte first time.
   */
  writeControl(value: number): void {
    const v = value & 0xff;
    if (!this.awaitingSecond) {
      this.firstByte = v;
      this.awaitingSecond = true;
      // The low byte of an address is live the moment it arrives: a program
      // that writes only the low half to step within a page relies on it.
      this.address = (this.address & 0x3f00) | v;
      return;
    }
    this.awaitingSecond = false;
    if (v & 0x80) {
      const reg = v & 0x07;
      if (reg < REGISTER_COUNT) this.registers[reg] = this.firstByte;
      return;
    }
    this.address = ((v & 0x3f) << 8) | this.firstByte;
    if ((v & 0x40) === 0) {
      this.readAhead = this.vram[this.address]!;
      this.advance();
    }
  }

  /** The address wraps within the 16KB the MSX standard fits, never past it. */
  private advance(): void {
    this.address = (this.address + 1) & (VRAM_SIZE - 1);
  }

  get status(): number {
    return this.statusByte;
  }

  /** The screen mode registers 0 and 1 currently select. */
  get mode(): VdpMode {
    const m3 = (this.registers[0]! >> 1) & 1;
    const m2 = (this.registers[1]! >> 3) & 1;
    const m1 = (this.registers[1]! >> 4) & 1;
    if (m1 === 0 && m2 === 0 && m3 === 0) return 'graphic1';
    if (m1 === 0 && m2 === 0 && m3 === 1) return 'graphic2';
    if (m1 === 0 && m2 === 1 && m3 === 0) return 'multicolour';
    if (m1 === 1 && m2 === 0 && m3 === 0) return 'text';
    return 'undocumented';
  }

  /** Register 1 bit 6: the active display is drawn at all. */
  get displayEnabled(): boolean {
    return (this.registers[1]! & 0x40) !== 0;
  }

  /** Register 1 bit 5: the end of the active display raises the interrupt. */
  get interruptEnabled(): boolean {
    return (this.registers[1]! & 0x20) !== 0;
  }

  /** The INT line the CPU sees, asserted while the flag stands and is enabled. */
  get irq(): boolean {
    return (this.statusByte & STATUS_FRAME) !== 0 && this.interruptEnabled;
  }

  /** The end of the active display: raise the frame flag the BIOS ticks on. */
  endActiveDisplay(): void {
    this.statusByte |= STATUS_FRAME;
  }

  /**
   * Report what drawing the frame found: the flags are a property of the
   * sprites on screen, so the renderer is what knows them. Neither is cleared
   * here - both stand until the CPU reads the status register, exactly as on
   * the chip.
   */
  reportSprites(collision: boolean, fifthSprite: number | null): void {
    if (collision) this.statusByte |= STATUS_COLLISION;
    if (fifthSprite !== null) {
      this.statusByte |= STATUS_FIFTH_SPRITE;
      this.statusByte = (this.statusByte & 0xe0) | (fifthSprite & 0x1f);
    }
  }

  // --- Table addresses, as each mode decodes the base registers ---

  /** Register 2: the name table, on a 1KB boundary. */
  get nameTable(): number {
    return (this.registers[2]! & 0x0f) << 10;
  }

  /**
   * Register 4: the pattern generator. Graphic 2 splits the register - only
   * bit 2 chooses the 8KB half, and the low bits become a mask on the pattern
   * number instead (see {@link patternMask}).
   */
  get patternTable(): number {
    return this.mode === 'graphic2'
      ? (this.registers[4]! & 0x04) << 11
      : (this.registers[4]! & 0x07) << 11;
  }

  /**
   * Register 3: the colour table. On a 64-byte boundary in the character modes;
   * in graphic 2 only bit 7 chooses the half, the rest being a mask.
   */
  get colourTable(): number {
    return this.mode === 'graphic2'
      ? (this.registers[3]! & 0x80) << 6
      : this.registers[3]! << 6;
  }

  /**
   * Graphic 2 addresses a full 768 patterns as three banks of 256, and masks
   * the bank bits through registers 3 and 4 - the mechanism a program uses to
   * point all three thirds of the screen at one bank. MSX BASIC's SCREEN 2
   * opens all three (register 3 = 0xFF, register 4 = 0x03), so a mask taken as
   * "always open" looks right until a program narrows it.
   */
  get patternMask(): number {
    return ((this.registers[4]! & 0x03) << 8) | 0xff;
  }

  get colourMask(): number {
    return ((this.registers[3]! & 0x7f) << 3) | 0x07;
  }

  /** Register 5: the 32 four-byte sprite attributes, on a 128-byte boundary. */
  get spriteAttributeTable(): number {
    return (this.registers[5]! & 0x7f) << 7;
  }

  /** Register 6: the sprite patterns, on a 2KB boundary. */
  get spritePatternTable(): number {
    return (this.registers[6]! & 0x07) << 11;
  }

  /** Register 7 low nibble: the backdrop, which is also the border colour. */
  get backdropColour(): number {
    return this.registers[7]! & 0x0f;
  }

  /** Register 7 high nibble: the foreground, used by text mode only. */
  get textColour(): number {
    return (this.registers[7]! >> 4) & 0x0f;
  }

  /** Register 1 bit 1: 16x16 sprites rather than 8x8. */
  get spritesLarge(): boolean {
    return (this.registers[1]! & 0x02) !== 0;
  }

  /** Register 1 bit 0: sprite pixels drawn at double size. */
  get spritesMagnified(): boolean {
    return (this.registers[1]! & 0x01) !== 0;
  }

  /** Whether this part draws sprites at all in the current mode. */
  get spritesVisible(): boolean {
    const mode = this.mode;
    return mode !== 'text' && mode !== 'undocumented';
  }

  /** Which family member this is, for the modes it does and does not have. */
  get part(): MsxModel['vdp'] {
    return this.model.vdp;
  }
}
