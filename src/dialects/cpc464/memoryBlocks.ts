import type { MemoryBlocksSupport } from '../types';

/**
 * Where CPC memory blocks may live: `cpu: 'z80'`, user RAM valid ranges,
 * screen/firmware reserved ranges, program area from &0170, default block
 * address 0x8000 (below default HIMEM). Stage 5 fills this in.
 */
export function cpc464MemoryBlocks(): MemoryBlocksSupport {
  throw new Error('cpc464: not implemented');
}
