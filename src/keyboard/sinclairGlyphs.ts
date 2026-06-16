/**
 * Shared SVG geometry helpers for Sinclair block-graphics glyphs.
 *
 * Both the ZX80 and ZX81 print 2×2-quadrant block graphics on their keys; the
 * shapes are identical even though the two machines store different byte codes
 * for them. These low-level builders produce the constrained path data the
 * VirtualKeyboard renders into <svg><path/></svg>. Each dialect keeps its own
 * named glyph registry (the two machines have overlapping but not identical
 * glyph sets) built from these helpers.
 */

/** The four 8×8 quadrants of the 16×16 viewBox. */
export const QUAD = {
  tl: 'M0 0H8V8H0Z',
  tr: 'M8 0H16V8H8Z',
  bl: 'M0 8H8V16H0Z',
  br: 'M8 8H16V16H8Z',
};

/** 2px chequerboard covering the given area; phase flips which cells fill. */
export function chequer(
  x0: number,
  y0: number,
  w: number,
  h: number,
  phase = 0,
): string {
  const cells: string[] = [];
  for (let y = 0; y < h / 2; y++) {
    for (let x = 0; x < w / 2; x++) {
      if ((x + y + phase) % 2 === 0)
        cells.push(`M${x0 + x * 2} ${y0 + y * 2}h2v2h-2Z`);
    }
  }
  return cells.join('');
}

/** A 16×16 glyph from one or more path strings (fill: currentColor). */
export function glyph(...ds: string[]): {
  viewBox: string;
  paths: { d: string }[];
} {
  return { viewBox: '0 0 16 16', paths: ds.map((d) => ({ d })) };
}
