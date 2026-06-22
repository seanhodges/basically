/**
 * Stub — filled in by Stage 2 of docs/dialect-plans/trs80.md.
 *
 * The TRS-80 has no video chip: video RAM at 0x3C00 is a direct 64×16 character
 * map. Stage 2 snapshots it to the canvas each frame using a bundled font glyph
 * table (ASCII + the 0x80–0xBF 2×3 block-graphics cells). An 8×12 character cell
 * gives the 512×192 canvas below (block-graphics sub-cells are then 4×4).
 */
export const DISPLAY_WIDTH = 512;
export const DISPLAY_HEIGHT = 192;

export function renderDisplay(): void {
  throw new Error('trs80: display not implemented');
}
