import type { MemoryMap } from '../types';

/**
 * The CPC 464 memory map for the viewer: firmware/RST low area, BASIC
 * program area from &0170, variables/heap, strings below HIMEM (&AB7F
 * default), BASIC + firmware workspace and jumpblocks up to &BFFF, screen
 * &C000–&FFFF; ROM overlays noted on the RAM view. Stage 5 fills this in.
 */
export function cpc464MemoryMap(): MemoryMap {
  throw new Error('cpc464: not implemented');
}
