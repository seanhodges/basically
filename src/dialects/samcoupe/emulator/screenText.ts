import type { MachineScreenText } from '../../types';

/**
 * Read the screen back as characters by matching the drawn cells against the
 * ROM font, so headless tests can assert on what the machine displays.
 */
export function readSamcoupeScreenText(_ram: Uint8Array): MachineScreenText {
  throw new Error('samcoupe: not implemented');
}
