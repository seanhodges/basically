/**
 * A character-matrix glyph blitter for the discrete-video Commodore machines
 * (the PET has no video chip: the picture is screen RAM read through a character
 * generator ROM). Given the screen-code matrix and the character ROM it fills an
 * RGBA buffer — a rectangle of `cols × rows` 8×8 glyphs surrounded by a border.
 *
 * Mono only: one foreground and one background colour (the PET's green phosphor).
 * The VIC-20 reuses this class and layers per-cell colour on top via
 * {@link CharRenderer.renderColored}; the PET path stays a two-colour blit.
 */

export interface CharRendererConfig {
  /** Character columns (40 on the 40-column PET). */
  cols: number;
  /** Character rows (25). */
  rows: number;
  /** Glyph cell size in pixels (8×8 on the Commodore machines). */
  glyphWidth: number;
  glyphHeight: number;
  /** Border thickness in pixels on each axis. */
  borderX: number;
  borderY: number;
  /** Lit-pixel colour (RGB 0–255). */
  foreground: readonly [number, number, number];
  /** Unlit-pixel colour inside the character area. */
  background: readonly [number, number, number];
  /** Border colour; defaults to {@link CharRendererConfig.background}. */
  border?: readonly [number, number, number];
}

/** Per-cell colour lookup for {@link CharRenderer.renderColored} (VIC-20). */
export type ColorFn = (cell: number) => readonly [number, number, number];

export class CharRenderer {
  readonly width: number;
  readonly height: number;
  /** Visible-frame RGBA buffer (alpha fixed at 255). */
  readonly rgba: Uint8ClampedArray;

  private readonly cfg: CharRendererConfig;

  constructor(config: CharRendererConfig) {
    this.cfg = config;
    this.width = config.cols * config.glyphWidth + config.borderX * 2;
    this.height = config.rows * config.glyphHeight + config.borderY * 2;
    this.rgba = new Uint8ClampedArray(this.width * this.height * 4);
    for (let i = 3; i < this.rgba.length; i += 4) this.rgba[i] = 255;
  }

  /**
   * Render `screenRam` (row-major `cols × rows` screen codes) through `charRom`.
   * `charBase` is the byte offset of the active 1 KB character set within the
   * ROM (the PET selects upper/graphics vs lower/text via VIA CA2). A screen
   * code's high bit (0x80) selects reverse video; the low 7 bits index the glyph.
   */
  render(screenRam: Uint8Array, charRom: Uint8Array, charBase = 0): void {
    this.paintBorder();
    const { cols, rows } = this.cfg;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const code = screenRam[cy * cols + cx] ?? 0;
        this.drawGlyph(cx, cy, code, charRom, charBase, this.cfg.foreground);
      }
    }
  }

  /**
   * Colour variant used by the VIC-20: `colorFor(cx + cy*cols)` supplies each
   * cell's foreground colour; background stays uniform. Unused by the PET.
   */
  renderColored(
    screenRam: Uint8Array,
    charRom: Uint8Array,
    colorFor: ColorFn,
    charBase = 0,
  ): void {
    this.paintBorder();
    const { cols, rows } = this.cfg;
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const cell = cy * cols + cx;
        const code = screenRam[cell] ?? 0;
        this.drawGlyph(cx, cy, code, charRom, charBase, colorFor(cell));
      }
    }
  }

  private drawGlyph(
    cx: number,
    cy: number,
    code: number,
    charRom: Uint8Array,
    charBase: number,
    fg: readonly [number, number, number],
  ): void {
    const { glyphWidth, glyphHeight, borderX, borderY } = this.cfg;
    const reverse = (code & 0x80) !== 0;
    const glyphBase = charBase + (code & 0x7f) * glyphHeight;
    const bg = this.cfg.background;
    const x0 = borderX + cx * glyphWidth;
    const y0 = borderY + cy * glyphHeight;
    for (let y = 0; y < glyphHeight; y++) {
      let bits = charRom[glyphBase + y] ?? 0;
      if (reverse) bits = ~bits & 0xff;
      let rowOffset = ((y0 + y) * this.width + x0) * 4;
      for (let x = 0; x < glyphWidth; x++) {
        const lit = (bits & (0x80 >> x)) !== 0;
        const [r, g, b] = lit ? fg : bg;
        this.rgba[rowOffset] = r;
        this.rgba[rowOffset + 1] = g;
        this.rgba[rowOffset + 2] = b;
        rowOffset += 4;
      }
    }
  }

  private paintBorder(): void {
    const [r, g, b] = this.cfg.border ?? this.cfg.background;
    for (let i = 0; i < this.rgba.length; i += 4) {
      this.rgba[i] = r;
      this.rgba[i + 1] = g;
      this.rgba[i + 2] = b;
    }
  }
}
