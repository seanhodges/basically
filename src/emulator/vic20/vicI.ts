/**
 * A frame-approximate 6561 VIC-I renderer for the VIC-20. The VIC-I is the
 * colour cousin of the PET's discrete video, so it layers per-cell colour on the
 * shared {@link CharRenderer} rather than getting its own blitter: once per frame
 * it decodes the sixteen $9000–$900F registers, derives the screen/character/
 * colour base addresses, walks the 22×23 character matrix and blits 8×8 glyphs
 * with a border.
 *
 * "Frame-approximate" means the whole picture is produced from the register and
 * memory state at the moment {@link VicI.render} runs — raster-split colour and
 * mid-frame register tricks are explicitly out of scope (see the Stage 2 plan).
 * Multicolour character mode is likewise not rendered: a cell's colour nibble is
 * treated as a plain hi-res foreground (bits 0–2), which covers the BASIC use
 * the IDE targets.
 *
 * The register decode (video-matrix / character-generator base derivation and
 * the A13-inverted VIC→CPU address mapping) is adapted from the vendored
 * viciious `target/vic.js` (public domain) — the VIC-II is the VIC-I's later,
 * more complex relative — and the palette from the Pepto VIC-20 analysis.
 */

import { CharRenderer } from '../commodore/charRenderer';
import { COLOR_BASE, SCREEN_BASE } from './memory';

const COLS = 22;
const ROWS = 23;
const GLYPH = 8;
const BORDER_X = 28;
const BORDER_Y = 32;

/** Native canvas the dialect advertises: 176×184 active + border. */
export const VIC20_DISPLAY_WIDTH = COLS * GLYPH + BORDER_X * 2; // 232
export const VIC20_DISPLAY_HEIGHT = ROWS * GLYPH + BORDER_Y * 2; // 248

const CELLS = COLS * ROWS;

/** VIC register offsets used by the renderer. */
const REG_SCREEN_HI = 0x02; // bit 7 → video-matrix address bit 9
const REG_CHAR_MATRIX = 0x05; // bits 0-3 char base, bits 4-7 screen base
// $900E (bits 4-7 auxiliary colour) is only meaningful in multicolour mode,
// which this frame-approximate renderer does not reproduce.
const REG_BORDER_BG = 0x0f; // bits 0-2 border, bit 3 reverse, bits 4-7 background

/**
 * The 16-entry VIC-20 palette (Pepto's colorvic analysis, RGB). Colours 0–7 are
 * the character/border set; 8–15 the lighter auxiliary/background set.
 */
const PALETTE: readonly (readonly [number, number, number])[] = [
  [0x00, 0x00, 0x00], // 0  black
  [0xff, 0xff, 0xff], // 1  white
  [0x78, 0x29, 0x22], // 2  red
  [0x87, 0xd6, 0xdd], // 3  cyan
  [0xaa, 0x5f, 0xb6], // 4  purple
  [0x55, 0xa0, 0x49], // 5  green
  [0x40, 0x31, 0x8d], // 6  blue
  [0xbf, 0xce, 0x72], // 7  yellow
  [0xaa, 0x74, 0x49], // 8  orange
  [0xea, 0xb4, 0x89], // 9  light orange
  [0xb8, 0x69, 0x62], // 10 light red
  [0xc7, 0xff, 0xff], // 11 light cyan
  [0xea, 0x9f, 0xf6], // 12 light purple
  [0x94, 0xe0, 0x89], // 13 light green
  [0x80, 0x71, 0xcc], // 14 light blue
  [0xff, 0xff, 0xb2], // 15 light yellow
];

/**
 * Map a 14-bit VIC-bus address to the CPU address space. The VIC's A13 line is
 * inverted before reaching the system bus, so VIC $0000–$1FFF appears at CPU
 * $8000–$9FFF (the character ROM) and VIC $2000–$3FFF at CPU $0000–$1FFF (RAM).
 */
function vicToCpu(vicAddr: number): number {
  return vicAddr & 0x2000 ? vicAddr & 0x1fff : (vicAddr & 0x1fff) | 0x8000;
}

/**
 * The 6561 VIC-I: the sixteen memory-mapped registers plus a once-per-frame
 * renderer. The machine decodes $9000–$900F reads/writes to
 * {@link VicI.readRegister} / {@link VicI.writeRegister} and calls
 * {@link VicI.render} each frame with the live 64 KB memory image.
 */
export class VicI {
  readonly width = VIC20_DISPLAY_WIDTH;
  readonly height = VIC20_DISPLAY_HEIGHT;

  private readonly regs = new Uint8Array(16);
  private readonly renderer = new CharRenderer({
    cols: COLS,
    rows: ROWS,
    glyphWidth: GLYPH,
    glyphHeight: GLYPH,
    borderX: BORDER_X,
    borderY: BORDER_Y,
    // Overridden per frame from the border/background register; the constructor
    // values are only the pre-first-render fallback.
    foreground: PALETTE[1]!,
    background: PALETTE[0]!,
    border: PALETTE[3]!,
  });

  /** The rendered visible-frame RGBA buffer (alpha fixed at 255). */
  get rgba(): Uint8ClampedArray {
    return this.renderer.rgba;
  }

  reset(): void {
    this.regs.fill(0);
  }

  readRegister(reg: number): number {
    return this.regs[reg & 0x0f]!;
  }

  writeRegister(reg: number, value: number): void {
    this.regs[reg & 0x0f] = value & 0xff;
  }

  /** Screen-matrix base address in CPU space (default $1E00). */
  private screenBase(): number {
    const vic =
      ((this.regs[REG_SCREEN_HI]! & 0x80) << 2) |
      ((this.regs[REG_CHAR_MATRIX]! & 0xf0) << 6);
    return vicToCpu(vic);
  }

  /** Character-generator base address in CPU space (default $8000 ROM). */
  private charBase(): number {
    return vicToCpu((this.regs[REG_CHAR_MATRIX]! & 0x0f) << 10);
  }

  /** Colour-nibble RAM base: $9400 or $9600 tracking the screen's A9. */
  private colorBase(): number {
    return this.regs[REG_SCREEN_HI]! & 0x80 ? COLOR_BASE : 0x9400;
  }

  /**
   * Blit the current frame from `mem` (the full 64 KB CPU image) into
   * {@link VicI.rgba}. Reads screen codes at the derived matrix base, glyph rows
   * from the character base and per-cell colour from the colour-RAM nibbles;
   * the border and background come from $900F.
   */
  render(mem: Uint8Array): void {
    const bgIndex = (this.regs[REG_BORDER_BG]! >> 4) & 0x0f;
    const borderIndex = this.regs[REG_BORDER_BG]! & 0x07;
    const background = PALETTE[bgIndex] ?? PALETTE[0]!;
    const border = PALETTE[borderIndex] ?? PALETTE[0]!;

    const screen = this.screenBase();
    const color = this.colorBase();
    const screenRam = mem.subarray(screen, screen + CELLS);
    const colorFor = (cell: number): readonly [number, number, number] =>
      PALETTE[mem[color + cell]! & 0x07]!;

    this.renderer.renderColored(screenRam, mem, colorFor, this.charBase(), {
      background,
      border,
    });
  }
}

/** Exposed for tests: the 16-entry VIC-20 palette. */
export { PALETTE as VIC20_PALETTE };
/** Exposed for tests: the default unexpanded screen base. */
export { SCREEN_BASE as VIC20_SCREEN_BASE };
