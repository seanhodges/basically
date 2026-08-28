/**
 * The registry ids whose on-screen keyboard offers a graphics palette, in
 * registry order.
 *
 * Kept here rather than derived in the browser so the specs can loop over the
 * machines without importing the dialect registry (and every emulator core with
 * it) into the Playwright process. `src/dialects/graphicsPalette.test.ts` fails
 * if a dialect gains or loses a palette without this list following.
 */
export const PALETTE_MACHINES = [
  'zx81',
  'zx80',
  'zxspectrum',
  'zxspectrum128',
  'bbcmicro',
  'bbcmaster',
  'commodore64',
  'pet',
  'vic20',
  'atom',
  'trs80',
  'cpc464',
  'cpc6128',
  'atari800',
  'atari400',
];
