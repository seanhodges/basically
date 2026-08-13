// Corrected VIC-II colour palette for the C64.
//
// The vendored viciious core ships a hand-approximated 16-colour table
// (`systemPalette` in ./viciious/tools/palettes.js) whose orange reads as brown
// and whose green is too bright/yellow. Per CLAUDE.md the vendored folder is
// "don't touch", so rather than edit that table we remap each of its colours to
// our own palette at the video-host seam in c64Machine.ts. `systemPalette` is
// imported read-only purely to key the remap, keeping the two tables aligned.

// @ts-expect-error vendored JS, no types
import { systemPalette } from './viciious/tools/palettes.js';

/**
 * A "glowing 1980s television" palette: the Colodore reference palette
 * (https://www.colodore.com, PAL defaults — the physically-derived gold standard
 * for C64 accuracy) pushed brighter and more saturated to mimic how the colours
 * actually appeared on a CRT, where phosphor bloom lifts brightness and the
 * limited-gamut display reads as more vivid than the nominal sRGB values.
 *
 * Values are derived from Colodore by an HSV boost (saturation ×1.38, value
 * ×1.30 with a brightness floor for the darkest hues), then baked to explicit
 * constants here. Two entries deviate from that formula:
 *
 * - Orange (code 8) is hand-tuned to the warm, saturated red-orange a period
 *   C64 renders it as, rather than Colodore's earthy brown.
 * - Light blue (code 14) takes the value boost only. Its blue channel already
 *   sits at 255, so the value boost cannot brighten it further and the
 *   saturation boost only strips out red and green - the two channels carrying
 *   ~93% of perceived brightness. Applying both collapses the default
 *   light-blue-on-blue screen to 1.87:1, below the 2.60:1 of unboosted
 *   Colodore; the value boost alone holds it at 3.14:1. The same trap waits for
 *   any other blue-dominated entry whose dominant channel is already clipped.
 *
 * Indexed by the 4-bit C64 colour code, aligned 1:1 with the vendored
 * {@link systemPalette}.
 */
export const CRT_PALETTE: readonly number[] = [
  0x000000, // 0  black
  0xffffff, // 1  white
  0xa81c25, // 2  red
  0x67fff5, // 3  cyan
  0xb421c4, // 4  purple
  0x45e035, // 5  green
  0x0602ca, // 6  blue
  0xf9ff44, // 7  yellow
  0xcd4e28, // 8  orange
  0x6f4900, // 9  brown
  0xff616a, // 10 light red
  0x606060, // 11 dark grey
  0xa0a0a0, // 12 grey
  0x88ff7b, // 13 light green
  0x7a76ff, // 14 light blue
  0xe7e7e7, // 15 light grey
];

// Vendored packed-RGB -> CRT packed-RGB, built once at module load. The vendored
// entries are all distinct, so there are no key collisions.
const COLOR_REMAP = new Map<number, number>();
for (let i = 0; i < systemPalette.length; i++) {
  COLOR_REMAP.set(systemPalette[i] as number, CRT_PALETTE[i]);
}

/**
 * Remap a vendored-palette RGB triple to its CRT-palette equivalent. Unknown
 * colours (e.g. the debug "scope" palettes, which are off by default) fall
 * through unchanged.
 */
export function remapRgb(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const corrected = COLOR_REMAP.get((r << 16) | (g << 8) | b);
  if (corrected === undefined) return [r, g, b];
  return [(corrected >> 16) & 0xff, (corrected >> 8) & 0xff, corrected & 0xff];
}
