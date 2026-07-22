import type { MemoryMap } from '../types';

/**
 * The CPC 6128 memory map: the cpc464 64K main layout with BASIC 1.1
 * workspace labels; the banked second 64K (Gate Array/PAL &7Fxx RAM
 * configurations) is described in region notes, the Spectrum 128 precedent
 * (addressSpace stays 0x10000). Stage D fills this in.
 */
export function cpc6128MemoryMap(): MemoryMap {
  throw new Error('cpc6128: not implemented');
}
