import type { MemoryMap } from '../types';

/**
 * The Z80's 64K window, which is what the viewer's contract covers: the 256K
 * behind it is reached through the page slots, and belongs in region notes
 * rather than in a wider address space.
 */
export const samcoupeMemoryMap: MemoryMap = {
  addressSpace: 0x10000,
  regions: [],
};
