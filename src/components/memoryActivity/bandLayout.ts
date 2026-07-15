import type { Band } from '../memoryBands';

/**
 * One band's placement in the stacked memory-map column, in CSS pixels. `top` is
 * the band's offset from the top of the column (cumulative height of the bands
 * above it, plus the inter-band gaps); `height` is its drawn height.
 */
export interface BandGeometry {
  start: number;
  end: number;
  top: number;
  height: number;
}

/**
 * Lay the bands out as a stacked column, returning each band's pixel top and
 * height. `heightOf` is the panel's own `bandHeight`; `gap` is the flex `gap`
 * between bands in `.map` (mirror the CSS so the overlay lines up exactly). Pure
 * and testable - the same cumulative math the panel uses to place POKE markers,
 * factored out so the activity overlay can reuse it off the main thread.
 */
export function bandLayout(
  bands: Band[],
  heightOf: (b: Band) => number,
  gap: number,
): BandGeometry[] {
  const out: BandGeometry[] = [];
  let top = 0;
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i]!;
    const height = heightOf(b);
    out.push({ start: b.start, end: b.end, top, height });
    top += height + gap;
  }
  return out;
}

/** Total column height in CSS pixels (bands plus the gaps between them). */
export function layoutHeight(geometry: BandGeometry[]): number {
  const last = geometry[geometry.length - 1];
  return last ? last.top + last.height : 0;
}

/**
 * The CSS-pixel y of an address within its band, or null when the address lies
 * in no band. `y = top + ((addr - start) / span) * height`, the exact formula
 * the panel uses for POKE markers, so overlay lines register with the bands.
 */
export function addrToY(geometry: BandGeometry[], addr: number): number | null {
  for (let i = 0; i < geometry.length; i++) {
    const g = geometry[i]!;
    if (addr >= g.start && addr <= g.end) {
      const span = g.end - g.start + 1;
      return g.top + ((addr - g.start) / span) * g.height;
    }
  }
  return null;
}
