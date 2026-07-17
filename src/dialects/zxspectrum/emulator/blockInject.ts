import type { MemoryBlock } from '../../types';

/** The direct-write surface {@link injectBlocks} needs - both `SpectrumMemory`
 * and `Spectrum128Memory` satisfy it. */
export interface WritableMemory {
  write(address: number, value: number): void;
}

/**
 * The lowest address occupied by any non-empty block, or `null` when `blocks`
 * is empty or every block is zero-length. `loadProgram` uses this *before*
 * writing anything to decide whether a protective CLEAR is needed (see its
 * comment for why CLEAR must run before the bytes are written, not after).
 */
export function minBlockAddress(blocks: readonly MemoryBlock[]): number | null {
  let minAddr: number | null = null;
  for (const block of blocks) {
    if (block.bytes.length === 0) continue;
    minAddr =
      minAddr === null ? block.address : Math.min(minAddr, block.address);
  }
  return minAddr;
}

/**
 * Write each {@link MemoryBlock}'s bytes directly into RAM - the same
 * direct-write pattern the machines already use for boot-time setup (see
 * `clearScreen` in spectrumMachine.ts/spectrum128Machine.ts). Used by
 * `loadProgram` to place machine code / data at fixed addresses once the
 * BASIC program itself has loaded (and, when needed, CLEAR has already
 * protected them - see {@link minBlockAddress}), before RUN starts it.
 */
export function injectBlocks(
  memory: WritableMemory,
  blocks: readonly MemoryBlock[],
): void {
  for (const block of blocks) {
    for (let i = 0; i < block.bytes.length; i++) {
      memory.write((block.address + i) & 0xffff, block.bytes[i]!);
    }
  }
}
