// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import {
  ATARI_DISPLAY_HEIGHT,
  BAK,
  Gtia,
  NO_DIRECT,
  PF0,
  PF1,
  PF2,
  PF3,
  PIXELS_PER_CLOCK,
  WINDOW_PIXELS,
} from './gtia';

/**
 * The ANTIC: the display processor that reads a program out of memory and
 * fetches the screen for GTIA to colour.
 *
 * ANTIC is not a video chip with a mode register. It runs a **display list** -
 * a little program in RAM whose instructions each say "show one line of mode N,
 * from here" - and it fetches everything it needs over its own bus. So a frame
 * here is a walk down that program, one scanline at a time, and the mode table
 * below is the whole of what an instruction means.
 *
 * ### The mode table
 *
 * Every mode fills the same 160 colour clocks at normal width; what differs is
 * how many bytes that takes, how many scanlines a line of it occupies, and how
 * many bits go into a pixel. Those three facts, in {@link MODES}, are enough to
 * draw all fourteen: the character modes look their pixels up through the
 * character generator first, the map modes take them straight from the byte.
 *
 * ### What is simplified
 *
 * A line is drawn from the register state at the moment it starts, so a program
 * that changes a colour part-way along a line by counting cycles gets the whole
 * line in one colour. Everything timed to the scanline - VCOUNT, WSYNC, the
 * vertical blank and display list interrupts - is exact, so a DLI that recolours
 * the next line behaves as it does on the machine, which is what a BASIC
 * program can reach.
 */

/** Scanlines in a PAL frame. */
export const SCANLINES_PER_FRAME = 312;

/** CPU cycles in one scanline, the budget ANTIC's fetches come out of. */
const CYCLES_PER_LINE = 114;

/** DRAM refresh cycles ANTIC takes on every scanline, displayed or not. */
const REFRESH_CYCLES = 9;

/** Cycles a display list instruction costs: the opcode and its two address bytes. */
const LIST_CYCLES = 3;

/** The scanline the display list starts on. */
const DISPLAY_START = 8;

/** The scanline the vertical blank interrupt fires on. */
const VBLANK_SCANLINE = 248;

/** NMISTATUS as ANTIC leaves it: the low five bits are not driven. */
const NMIST_IDLE = 0x1f;
const NMIST_DLI = 0x9f;
const NMIST_VBI = 0x5f;

/** Register offsets within ANTIC's page. */
const DMACTL = 0x00;
const CHACTL = 0x01;
const DLISTL = 0x02;
const DLISTH = 0x03;
const HSCROL = 0x04;
const VSCROL = 0x05;
const PMBASE = 0x07;
const CHBASE = 0x09;
const WSYNC = 0x0a;
const VCOUNT = 0x0b;
const NMIEN = 0x0e;
const NMIRES = 0x0f;

/** One playfield mode's shape. */
interface AnticMode {
  /** Bytes fetched per mode line at normal width. */
  bytes: number;
  /** Scanlines the mode line occupies. */
  scanlines: number;
  /** Bits per pixel: 1 or 2. */
  depth: 1 | 2;
  /** Whether the fetched byte is a character code rather than pixels. */
  text: boolean;
}

/**
 * Modes 2-15, indexed by the instruction's low nibble. Modes 0 and 1 are the
 * blank and jump instructions and have no shape of their own. The comment on
 * each is the `GRAPHICS` number Atari BASIC asks for it by.
 */
const MODES: readonly (AnticMode | null)[] = [
  null,
  null,
  { bytes: 40, scanlines: 8, depth: 1, text: true }, // 0
  { bytes: 40, scanlines: 10, depth: 1, text: true }, // descender text
  { bytes: 40, scanlines: 8, depth: 2, text: true }, // 12
  { bytes: 40, scanlines: 16, depth: 2, text: true }, // 13
  { bytes: 20, scanlines: 8, depth: 1, text: true }, // 1
  { bytes: 20, scanlines: 16, depth: 1, text: true }, // 2
  { bytes: 10, scanlines: 8, depth: 2, text: false }, // 3
  { bytes: 10, scanlines: 4, depth: 1, text: false }, // 4
  { bytes: 20, scanlines: 4, depth: 2, text: false }, // 5
  { bytes: 20, scanlines: 2, depth: 1, text: false }, // 6
  { bytes: 20, scanlines: 1, depth: 1, text: false }, // 14
  { bytes: 40, scanlines: 2, depth: 2, text: false }, // 7
  { bytes: 40, scanlines: 1, depth: 2, text: false }, // 15
  { bytes: 40, scanlines: 1, depth: 1, text: false }, // 8
];

/** The three playfield widths DMACTL bits 0-1 select, in colour clocks. */
const WIDTH_CLOCKS = [0, 128, 160, 192] as const;

/** Screen pixels a normal-width playfield spans. */
const NORMAL_PIXELS = WIDTH_CLOCKS[2] * PIXELS_PER_CLOCK;

/** The two-bit playfield selectors, in the order a pixel's bits name them. */
const DEPTH2_SELECTORS = [BAK, PF0, PF1, PF2] as const;

/** The colours modes 6 and 7 pick with a character's top two bits. */
const TEXT_COLOURS = [PF0, PF1, PF2, PF3] as const;

/**
 * GTIA's nine-colour mode maps a nibble onto the colour file: the four players,
 * the four playfield registers, then the background, with the top four nibbles
 * folding back onto the playfield registers again.
 */
const GTIA_NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 4, 5, 6, 7] as const;

/** Modes 6 and 7 have only 64 characters, so their font aligns to 512 bytes. */
const HALF_FONT_MODES = new Set([6, 7]);

export class Antic {
  private dmactl = 0;
  private chactl = 0;
  private dlist = 0;
  private hscrol = 0;
  private vscrol = 0;
  private pmbase = 0;
  private chbase = 0;
  private nmien = 0;
  private nmist = NMIST_IDLE;

  /** The scanline being drawn, 0 to {@link SCANLINES_PER_FRAME} - 1. */
  private scanline = 0;

  /** Where the display list has got to, and where the screen data has. */
  private dlPc = 0;
  private memScan = 0;

  /** The mode line in progress, or null on a blank line or a finished list. */
  private mode: AnticMode | null = null;
  private modeNumber = 0;
  private modeRow = 0;
  private modeRows = 0;
  private modeStartRow = 0;
  private modeAddress = 0;
  private modeDli = false;
  private modeHscroll = false;
  private vscrollOn = false;
  /** Blank scanlines still owed by a blank instruction, this one included. */
  private blankLeft = 0;
  /** Set once the list has run a jump-and-wait; nothing more is fetched. */
  private waiting = false;

  /** True while the CPU is stopped waiting for the end of this scanline. */
  private halted = false;

  /**
   * One scanline of playfield, as selectors and as resolved colours. Fields
   * rather than locals so a frame allocates nothing.
   */
  private readonly selectors = new Uint8Array(WINDOW_PIXELS);
  private readonly direct = new Uint16Array(WINDOW_PIXELS);

  /** The visible frame, as GTIA paints it. */
  readonly rgba = new Uint8ClampedArray(
    WINDOW_PIXELS * ATARI_DISPLAY_HEIGHT * 4,
  );

  constructor(
    private readonly mem: Uint8Array,
    private readonly gtia: Gtia,
    /** Pulse the CPU's NMI line. */
    private readonly raiseNmi: () => void,
  ) {}

  reset(): void {
    this.dmactl = 0;
    this.chactl = 0;
    this.dlist = 0;
    this.hscrol = 0;
    this.vscrol = 0;
    this.pmbase = 0;
    this.chbase = 0;
    this.nmien = 0;
    this.nmist = NMIST_IDLE;
    this.scanline = 0;
    this.mode = null;
    this.blankLeft = 0;
    this.waiting = false;
    this.halted = false;
    this.rgba.fill(0);
  }

  read(reg: number): number {
    if (reg === VCOUNT) return this.scanline >> 1;
    if (reg === NMIRES) return this.nmist;
    // The rest of ANTIC is write-only and the data lines float.
    return 0xff;
  }

  write(reg: number, value: number): void {
    const byte = value & 0xff;
    switch (reg) {
      case DMACTL:
        this.dmactl = byte;
        return;
      case CHACTL:
        this.chactl = byte;
        return;
      case DLISTL:
        this.dlist = (this.dlist & 0xff00) | byte;
        return;
      case DLISTH:
        this.dlist = (this.dlist & 0x00ff) | (byte << 8);
        return;
      case HSCROL:
        this.hscrol = byte & 0x0f;
        return;
      case VSCROL:
        this.vscrol = byte & 0x0f;
        return;
      case PMBASE:
        this.pmbase = byte;
        return;
      case CHBASE:
        this.chbase = byte;
        return;
      case WSYNC:
        this.halted = true;
        return;
      case NMIEN:
        this.nmien = byte;
        return;
      case NMIRES:
        this.nmist = NMIST_IDLE;
        return;
      default:
        return;
    }
  }

  /** Whether the CPU is stopped for the rest of this scanline. */
  isHalted(): boolean {
    return this.halted;
  }

  /** The scanline currently being drawn, for the machine's own timing. */
  currentScanline(): number {
    return this.scanline;
  }

  /** Where the display list register points, for the screen reader. */
  displayList(): number {
    return this.dlist;
  }

  /** The character generator's base address, for the screen reader. */
  characterBase(): number {
    return (this.chbase & 0xfc) << 8;
  }

  /**
   * Begin a scanline: run whatever of the display list this line calls for,
   * paint it, and raise any interrupt the line owes.
   *
   * Called once per scanline before the CPU is stepped through it, so a display
   * list interrupt's handler runs during the line it was raised on - which is
   * what a program that recolours from a DLI depends on.
   */
  startScanline(): void {
    this.halted = false;
    if (this.scanline === DISPLAY_START) this.beginFrame();
    if (this.scanline >= DISPLAY_START && !this.waiting) this.advanceList();

    const row = this.scanline - DISPLAY_START;
    if (row >= 0 && row < ATARI_DISPLAY_HEIGHT) this.paint(row);

    if (this.scanline === VBLANK_SCANLINE) {
      this.nmist = NMIST_VBI;
      if (this.nmien & 0x40) this.raiseNmi();
    } else if (this.modeDli && this.lastRowOfLine()) {
      this.nmist = NMIST_DLI;
      if (this.nmien & 0x80) this.raiseNmi();
    }
  }

  /** Finish the scanline and move to the next; true when the frame wrapped. */
  endScanline(): boolean {
    this.scanline++;
    if (this.scanline < SCANLINES_PER_FRAME) return false;
    this.scanline = 0;
    return true;
  }

  private beginFrame(): void {
    this.dlPc = this.dlist;
    this.mode = null;
    this.modeDli = false;
    this.blankLeft = 0;
    this.waiting = false;
    this.vscrollOn = false;
  }

  /** Whether the display list is being fetched at all. */
  private listDma(): boolean {
    return (this.dmactl & 0x20) !== 0;
  }

  /** Playfield width in colour clocks, or 0 when playfield DMA is off. */
  private widthClocks(): number {
    return WIDTH_CLOCKS[this.dmactl & 3]!;
  }

  /** Fetch the next display list byte, wrapping inside its 1K page. */
  private fetchList(): number {
    const byte = this.mem[this.dlPc]!;
    this.dlPc = (this.dlPc & 0xfc00) | ((this.dlPc + 1) & 0x03ff);
    return byte;
  }

  private fetchListWord(): number {
    return this.fetchList() | (this.fetchList() << 8);
  }

  /** Whether this scanline is the last of the line in progress. */
  private lastRowOfLine(): boolean {
    if (this.blankLeft > 0) return this.blankLeft === 1;
    return this.mode !== null && this.modeRow === this.modeRows - 1;
  }

  /**
   * Move the display list on by one scanline, leaving the state describing the
   * line about to be drawn: either the next row of what is already running, or
   * whatever the next instructions produce.
   */
  private advanceList(): void {
    if (this.blankLeft > 1) {
      this.blankLeft--;
      return;
    }
    if (this.blankLeft === 1) {
      this.blankLeft = 0;
    } else if (this.mode !== null) {
      if (this.modeRow + 1 < this.modeRows) {
        this.modeRow++;
        return;
      }
      this.mode = null;
    }
    this.modeDli = false;
    if (!this.listDma()) return;

    // A jump produces no picture, so the list may run several instructions
    // before this scanline has something to show. The cap is the whole 1K a
    // display list can occupy, which a list that jumps to itself burns through
    // rather than spinning here forever.
    for (let guard = 0; guard < 0x400; guard++) {
      const instruction = this.fetchList();
      const opcode = instruction & 0x0f;
      this.modeDli = (instruction & 0x80) !== 0;

      if (opcode === 0) {
        // Blank lines: bits 4-6 hold one less than the count.
        this.blankLeft = ((instruction >> 4) & 7) + 1;
        return;
      }

      if (opcode === 1) {
        this.dlPc = this.fetchListWord();
        // Bit 6 is jump-and-wait: the list is finished until the next frame.
        if (instruction & 0x40) {
          this.waiting = true;
          this.modeDli = false;
          return;
        }
        continue;
      }

      const mode = MODES[opcode]!;
      if (instruction & 0x40) this.memScan = this.fetchListWord();
      const vscroll = (instruction & 0x20) !== 0;

      this.mode = mode;
      this.modeNumber = opcode;
      this.modeAddress = this.memScan;
      this.modeHscroll = (instruction & 0x10) !== 0;
      this.modeRow = 0;

      // Vertical scrolling shortens a mode line at whichever end the scroll bit
      // turns on or off: the first scrolled line begins part-way down its
      // glyph, and the first unscrolled line after one ends part-way down.
      this.modeStartRow = vscroll && !this.vscrollOn ? this.vscrol : 0;
      const shortened = !vscroll && this.vscrollOn ? this.vscrol : 0;
      this.modeRows =
        shortened > 0 ? shortened : mode.scanlines - this.modeStartRow;
      this.vscrollOn = vscroll;

      this.memScan =
        (this.memScan & 0xf000) |
        ((this.memScan + this.bytesPerLine(mode)) & 0x0fff);
      return;
    }
    this.waiting = true;
  }

  /**
   * CPU cycles ANTIC takes off this scanline for its own memory accesses.
   *
   * The chip and the 6502 share one bus, so every byte ANTIC fetches is a cycle
   * the CPU does not get. What it fetches is the display list instruction, the
   * playfield, and the players and missiles, plus nine cycles of DRAM refresh
   * that happen whatever else is going on. The playfield is the large term and
   * it is not the same on every line: a character mode fetches the character
   * codes once at the top of a mode line and a row of the font on every line
   * of it, while a map mode fetches its bytes once and holds them - which is
   * why the text modes are the expensive ones.
   *
   * Taken off the front of the line rather than spread through it, which is
   * where the chip really takes them; nothing a program can observe on this
   * machine depends on which cycles within a line the CPU got.
   */
  dmaCycles(): number {
    let cycles = REFRESH_CYCLES;
    if (this.listDma()) cycles += LIST_CYCLES;
    if ((this.dmactl & 0x04) !== 0 && this.gtia.missileDmaEnabled())
      cycles += 1;
    if ((this.dmactl & 0x08) !== 0 && this.gtia.playerDmaEnabled()) cycles += 4;
    const mode = this.mode;
    if (mode === null || this.widthClocks() === 0) return cycles;
    const bytes = this.bytesPerLine(mode);
    if (mode.text) cycles += this.modeRow === 0 ? bytes * 2 : bytes;
    else if (this.modeRow === 0) cycles += bytes;
    return Math.min(cycles, CYCLES_PER_LINE);
  }

  /**
   * Colour clocks this mode line fetches.
   *
   * A line being fine-scrolled fetches the next width up, because the pixels
   * HSCROL shifts in from the side have to come from somewhere: what the
   * viewer sees is still the programmed width, and the extra clocks are the
   * ones scrolled past. It is also why turning fine scrolling on costs the CPU
   * more, which {@link dmaCycles} charges from the same figure.
   */
  private fetchClocks(): number {
    const clocks = this.widthClocks();
    if (clocks === 0 || !this.modeHscroll) return clocks;
    return clocks === WIDTH_CLOCKS[1] ? WIDTH_CLOCKS[2] : WIDTH_CLOCKS[3];
  }

  /** Bytes this mode line fetches, scaled to the width it is fetching at. */
  private bytesPerLine(mode: AnticMode): number {
    const clocks = this.fetchClocks();
    if (clocks === 0) return 0;
    return Math.round((mode.bytes * clocks) / WIDTH_CLOCKS[2]);
  }

  /** Draw one visible scanline into {@link rgba}. */
  private paint(row: number): void {
    this.runPlayerDma();
    const mode = this.mode;
    if (mode === null || this.widthClocks() === 0) {
      this.gtia.fillBackground(this.rgba, row);
      return;
    }
    this.selectors.fill(BAK);
    this.direct.fill(NO_DIRECT);
    const bytes = this.bytesPerLine(mode);
    const pixels = mode.bytes * (mode.depth === 1 ? 8 : 4);
    const width = NORMAL_PIXELS / pixels;
    // Where the fetched width starts inside the widest one, less the fine
    // scroll: HSCROL moves the line left by up to fifteen colour clocks, and
    // the extra clocks fetched above are what fills the gap it leaves.
    const left =
      (WINDOW_PIXELS - this.fetchClocks() * PIXELS_PER_CLOCK) / 2 -
      (this.modeHscroll ? this.hscrol * PIXELS_PER_CLOCK : 0);

    if (mode.text) this.drawText(mode, bytes, width, left);
    else this.drawMap(mode, bytes, width, left);
    this.gtia.renderScanline(this.selectors, this.direct, this.rgba, row);
  }

  /** Emit `width` pixels of one selector, clipped to the window. */
  private emit(
    at: number,
    width: number,
    selector: number,
    colour: number,
  ): void {
    const start = at < 0 ? 0 : at;
    const end = Math.min(at + width, WINDOW_PIXELS);
    for (let x = start; x < end; x++) {
      this.selectors[x] = selector;
      this.direct[x] = colour;
    }
  }

  private drawText(
    mode: AnticMode,
    bytes: number,
    width: number,
    left: number,
  ): void {
    const font = HALF_FONT_MODES.has(this.modeNumber)
      ? (this.chbase & 0xfe) << 8
      : (this.chbase & 0xfc) << 8;
    const blankInverse = (this.chactl & 0x01) !== 0;
    const invertInverse = (this.chactl & 0x02) !== 0;
    // Modes 2 and 3 are one and a half colours: a lit pixel takes COLPF1's
    // luminance but keeps COLPF2's hue, which is why text on this machine can
    // be a different brightness from its background but never a different
    // colour.
    const hires = this.modeNumber === 2 || this.modeNumber === 3;
    const paper = this.gtia.playfieldColour(PF2);
    const ink = (paper & 0xf0) | (this.gtia.playfieldColour(PF1) & 0x0f);
    const perByte = mode.depth === 1 ? 8 : 4;

    for (let i = 0; i < bytes; i++) {
      const code = this.mem[this.scanAddress(i)]!;
      const glyph =
        mode.text && mode.depth === 1 && !hires ? code & 0x3f : code & 0x7f;
      let data = this.glyphByte(font, glyph, code);
      const inverse = (code & 0x80) !== 0;
      if (inverse && hires) {
        if (blankInverse) data = 0;
        else if (invertInverse) data ^= 0xff;
      }
      const at = left + i * width * perByte;

      if (mode.depth === 2) {
        // Modes 4 and 5: two bits a pixel, and the character's top bit swaps
        // COLPF2 for COLPF3 wherever both bits are set.
        const third = inverse ? PF3 : PF2;
        for (let p = 0; p < 4; p++) {
          const bits = (data >> (6 - p * 2)) & 3;
          const selector = bits === 3 ? third : DEPTH2_SELECTORS[bits]!;
          this.emit(at + p * width, width, selector, NO_DIRECT);
        }
        continue;
      }

      if (hires) {
        for (let p = 0; p < 8; p++) {
          const on = (data & (0x80 >> p)) !== 0;
          this.emit(at + p * width, width, PF2, on ? ink : paper);
        }
        continue;
      }

      // Modes 6 and 7: one bit a pixel, and the character's top two bits pick
      // which of the four playfield colours the lit pixels take.
      const selector = TEXT_COLOURS[(code >> 6) & 3]!;
      for (let p = 0; p < 8; p++) {
        if ((data & (0x80 >> p)) === 0) continue;
        this.emit(at + p * width, width, selector, NO_DIRECT);
      }
    }
  }

  /**
   * The character generator byte for the glyph row this scanline shows.
   *
   * The taller modes stretch the same eight-row glyph over sixteen scanlines.
   * Mode 3 is the odd one: its lines are ten scanlines so that lower case can
   * have descenders, and it gets them by dropping the last quarter of the
   * character set two rows down its cell - which is why a mode 3 screen shows
   * `p` with a tail and `P` without.
   */
  private glyphByte(font: number, glyph: number, code: number): number {
    const mode = this.mode!;
    const line = this.modeRow + this.modeStartRow;
    let row = mode.scanlines === 16 ? line >> 1 : line;
    if (this.modeNumber === 3 && (code & 0x60) === 0x60) row -= 2;
    if (row < 0 || row > 7) return 0;
    if (this.chactl & 0x04) row = 7 - row;
    return this.mem[(font + glyph * 8 + row) & 0xffff]!;
  }

  private drawMap(
    mode: AnticMode,
    bytes: number,
    width: number,
    left: number,
  ): void {
    const gtiaMode = this.modeNumber === 15 ? this.gtia.gtiaMode() : 0;
    if (gtiaMode !== 0) {
      this.drawGtiaMode(bytes, left, gtiaMode);
      return;
    }
    const perByte = mode.depth === 1 ? 8 : 4;
    // Mode 15 is hi-res like mode 2: COLPF1's luminance over COLPF2.
    const paper = this.gtia.playfieldColour(PF2);
    const ink = (paper & 0xf0) | (this.gtia.playfieldColour(PF1) & 0x0f);

    for (let i = 0; i < bytes; i++) {
      const data = this.mem[this.scanAddress(i)]!;
      const at = left + i * width * perByte;
      if (mode.depth === 2) {
        for (let p = 0; p < 4; p++) {
          const bits = (data >> (6 - p * 2)) & 3;
          this.emit(at + p * width, width, DEPTH2_SELECTORS[bits]!, NO_DIRECT);
        }
        continue;
      }
      if (this.modeNumber === 15) {
        for (let p = 0; p < 8; p++) {
          const on = (data & (0x80 >> p)) !== 0;
          this.emit(at + p * width, width, PF2, on ? ink : paper);
        }
        continue;
      }
      for (let p = 0; p < 8; p++) {
        if ((data & (0x80 >> p)) === 0) continue;
        this.emit(at + p * width, width, PF0, NO_DIRECT);
      }
    }
  }

  /**
   * Mode 15 as GTIA reinterprets it when PRIOR's top bits are set: the eight
   * bits of a byte become two nibbles, and a nibble is a colour rather than a
   * pattern. Sixteen shades of one hue, nine colours from the whole register
   * file, or sixteen hues at one shade, by which of the three modes is on -
   * `GRAPHICS 9`, `10` and `11` as Atari BASIC numbers them.
   */
  private drawGtiaMode(bytes: number, left: number, gtiaMode: number): void {
    const background = this.gtia.background();
    // Two nibbles a byte across the same eight pixels, so each is four wide.
    const width = 4;
    for (let i = 0; i < bytes; i++) {
      const data = this.mem[this.scanAddress(i)]!;
      for (let half = 0; half < 2; half++) {
        const nibble = half === 0 ? data >> 4 : data & 0x0f;
        let colour: number;
        let selector = PF2;
        switch (gtiaMode) {
          case 1: // sixteen luminances of the background's hue
            colour = (background & 0xf0) | nibble;
            if (nibble === 0) selector = BAK;
            break;
          case 2: // nine colours, straight out of the register file
            colour = this.gtia.colour(GTIA_NINE[nibble]!);
            break;
          default: // sixteen hues at the background's luminance
            colour = (nibble << 4) | (background & 0x0f);
            if (nibble === 0) selector = BAK;
            break;
        }
        this.emit(left + (i * 2 + half) * width, width, selector, colour);
      }
    }
  }

  /** The `i`th byte of this mode line, wrapped inside its 4K page. */
  private scanAddress(i: number): number {
    return (this.modeAddress & 0xf000) | ((this.modeAddress + i) & 0x0fff);
  }

  /**
   * Fetch this scanline's player and missile graphics.
   *
   * PMBASE names a 2K block in one-line resolution and a 1K block in two-line;
   * the four missiles share the third area of it and each player has one of the
   * four after that. Nothing is fetched unless both ANTIC's DMA and GTIA's own
   * enable are on, which is why a program has to write DMACTL *and* GRACTL to
   * get players on screen.
   */
  private runPlayerDma(): void {
    const oneLine = (this.dmactl & 0x10) !== 0;
    const line = oneLine ? this.scanline : this.scanline >> 1;
    const base = oneLine
      ? (this.pmbase & 0xf8) << 8
      : (this.pmbase & 0xfc) << 8;
    const span = oneLine ? 0x100 : 0x80;

    if ((this.dmactl & 0x04) !== 0 && this.gtia.missileDmaEnabled()) {
      this.gtia.setMissileGraphics(this.mem[base + span * 3 + (line % span)]!);
    }
    if ((this.dmactl & 0x08) === 0 || !this.gtia.playerDmaEnabled()) return;
    for (let p = 0; p < 4; p++) {
      this.gtia.setPlayerGraphics(
        p,
        this.mem[base + span * (4 + p) + (line % span)]!,
      );
    }
  }
}
