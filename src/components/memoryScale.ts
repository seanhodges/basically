/**
 * Address-scale ticks for the memory-map viewer: given a region's address span
 * and the pixel height its band is drawn at, decide the round decimal addresses
 * to label inside it. A pure, testable transform in the mould of
 * {@link ./memoryBands}, so the component stays thin.
 *
 * The scale only appears once a band is physically tall enough to fit a couple
 * of ticks - {@link addressTicks} returns an empty list otherwise - which is what
 * lets the viewer reveal it "as you zoom in enough" without any zoom constant.
 */

/** Roughly one tick per this many pixels of band height. */
const PX_PER_TICK = 44;

/**
 * Round a raw step up to the nearest 1, 2 or 5 times a power of ten, so ticks
 * land on human-readable addresses (…, 1000, 2000, 5000, 10000, …).
 */
export function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(rough)));
  const n = rough / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/**
 * The decimal addresses to label along a region `[start, end]` (inclusive) drawn
 * at `bandPx` pixels tall. Ticks are round multiples of a nice step; the tick at
 * `start` is dropped (it sits under the band's own label). Returns `[]` when
 * fewer than two ticks would fit, so a scale only shows on tall-enough bands.
 */
export function addressTicks(
  start: number,
  end: number,
  bandPx: number,
): number[] {
  const span = end - start + 1;
  if (span <= 1) return [];
  const targetTicks = Math.max(1, Math.floor(bandPx / PX_PER_TICK));
  const step = Math.max(1, niceStep(span / targetTicks));

  const ticks: number[] = [];
  for (let a = Math.ceil(start / step) * step; a <= end; a += step) {
    if (a !== start) ticks.push(a);
  }
  return ticks.length >= 2 ? ticks : [];
}
