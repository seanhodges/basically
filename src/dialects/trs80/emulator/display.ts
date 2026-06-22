/**
 * TRS-80 Model I display. There is no video chip to emulate: video RAM at 0x3C00
 * is a direct 64×16 character map, so rendering is a per-frame snapshot of those
 * 1024 bytes. We draw an 8×12 character cell — 64×16 cells fill the 512×192
 * canvas — using the host font for ASCII (0x20–0x7F) and drawing the 2×3
 * block-graphics cells (0x80–0xFF) procedurally as 4×4-pixel sub-cells. That
 * avoids bundling the Model I character-generator ROM (a second copyrighted
 * asset); the glyph shapes differ slightly from the real font but the layout is
 * faithful.
 */
export const COLS = 64;
export const ROWS = 16;
export const CELL_W = 8;
export const CELL_H = 12;
export const DISPLAY_WIDTH = COLS * CELL_W; // 512
export const DISPLAY_HEIGHT = ROWS * CELL_H; // 192

const BACKGROUND = '#000000';
const FOREGROUND = '#e8e8e8'; // the Model I's white/silver phosphor

/**
 * Snapshot the 1K video RAM onto the canvas. `video` is the raw 0x3C00 page
 * (64×16 bytes, row-major).
 */
export function renderDisplay(
  ctx: CanvasRenderingContext2D,
  video: Uint8Array,
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT);

  ctx.fillStyle = FOREGROUND;
  ctx.textBaseline = 'top';
  ctx.font = `${CELL_H}px monospace`;

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const code = video[row * COLS + col] ?? 0x20;
      const x = col * CELL_W;
      const y = row * CELL_H;
      if (code >= 0x80) {
        drawGraphics(ctx, x, y, code & 0x3f);
      } else if (code >= 0x21 && code <= 0x7f) {
        // Model I has no lower case: fold a–z onto A–Z for display.
        const ch =
          code >= 0x61 && code <= 0x7a
            ? String.fromCharCode(code - 0x20)
            : String.fromCharCode(code);
        ctx.fillText(ch, x, y);
      }
      // codes 0x00-0x20 render as blank
    }
  }
}

/**
 * Draw one 2×3 block-graphics cell. The pattern's six bits map to sub-cells:
 * bit0 top-left, bit1 top-right, bit2 mid-left, bit3 mid-right, bit4 bottom-left,
 * bit5 bottom-right — each a quarter-width by third-height rectangle.
 */
function drawGraphics(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  pattern: number,
): void {
  const subW = CELL_W / 2;
  const subH = CELL_H / 3;
  for (let bit = 0; bit < 6; bit++) {
    if ((pattern & (1 << bit)) === 0) continue;
    const sx = bit & 1 ? subW : 0;
    const sy = (bit >> 1) * subH;
    ctx.fillRect(x + sx, y + sy, subW, subH);
  }
}
