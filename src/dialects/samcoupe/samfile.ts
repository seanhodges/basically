/**
 * The SAM tape container: a header block and the data blocks that follow it.
 *
 * Blocks are Spectrum-shaped with a different leading byte - 0x01 opens a SAM
 * header, 0xFF a data block, and 0x00 a Spectrum header the SAM ROM also reads.
 */

/** Tokenized program bytes -> the loadable image. */
export function buildSamFile(_bytes: Uint8Array, _name: string): Uint8Array {
  throw new Error('samcoupe: not implemented');
}

/** The inverse of {@link buildSamFile}: recover the program bytes. */
export function parseSamFile(_image: Uint8Array): { program: Uint8Array } {
  throw new Error('samcoupe: not implemented');
}
