import type { MemoryBlocksSupport } from '../types';

/** Where a machine-code block may live in the SAM's Z80 window. */
export const samcoupeMemoryBlocks: MemoryBlocksSupport = {
  cpu: 'z80',
  validRanges: [],
  reservedRanges: [],
  programArea() {
    throw new Error('samcoupe: not implemented');
  },
  defaultAddress: 0,
};
