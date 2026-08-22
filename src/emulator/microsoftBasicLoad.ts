import type { MemoryBlock } from '../dialects/types';

/** The little-endian byte and word writes a load needs of a machine's memory. */
export interface WritableMemory {
  write(address: number, value: number): void;
  writeWord(address: number, value: number): void;
}

/** One interpreter workspace word an injected image requires. */
export interface BasicPointer {
  /** Address of the little-endian word in the interpreter's workspace. */
  address: number;
  /** The value it must hold once the image is in place. */
  value: number;
}

export interface MicrosoftBasicLoad {
  /** Where the tokenized program is written - the interpreter's TXTTAB. */
  programBase: number;
  /**
   * The workspace words that must agree with the image, derived from it by the
   * dialect (its `basicImagePointers()`).
   */
  pointers: readonly BasicPointer[];
  /** The document's memory blocks, poked in after the program. */
  blocks?: readonly MemoryBlock[];
  /**
   * Start the program the way a person at the machine would - typing `RUN` at
   * the console, not jumping into it. Microsoft BASIC's `RUN` sets up its own
   * stack and variable space, and nothing outside the interpreter knows how to
   * do that for it.
   */
  typeRun(): void;
}

/**
 * Inject a tokenized Microsoft BASIC program into a booted machine and start it.
 *
 * The recipe is the same on every 8K-derived interpreter here - the Altair's
 * 8K BASIC, the PMD 85's BASIC-G, the TRS-80's Level II - because they are the
 * same interpreter's descendants:
 *
 *  1. **Write the image at the program base.** Bytes alone are only half a load.
 *  2. **Fix the workspace pointers.** BASIC finds the end of the program - and
 *     therefore where its variables start - through a handful of words in its
 *     own RAM, so a program whose bytes are right but whose pointers still
 *     describe the previous one runs into its own leftovers.
 *  3. **Poke the memory blocks.** After the program and its pointers, before
 *     `RUN` starts it, mirroring how a real loader poked code in once the tape
 *     had finished.
 *  4. **Type `RUN`.**
 *
 * The caller owns everything either side: resetting, booting to the prompt, and
 * whatever its own machine owes a run (a tape on the deck, a run latch armed).
 */
export function loadMicrosoftBasicProgram(
  memory: WritableMemory,
  image: Uint8Array,
  opts: MicrosoftBasicLoad,
): void {
  for (let i = 0; i < image.length; i++) {
    memory.write(opts.programBase + i, image[i]!);
  }
  for (const pointer of opts.pointers) {
    memory.writeWord(pointer.address, pointer.value);
  }
  for (const block of opts.blocks ?? []) {
    for (let i = 0; i < block.bytes.length; i++) {
      memory.write((block.address + i) & 0xffff, block.bytes[i]!);
    }
  }
  opts.typeRun();
}
