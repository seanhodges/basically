/**
 * Stub — filled in by Stage 4 of docs/dialect-plans/trs80.md.
 *
 * The Model I 500-baud BASIC cassette block: a leader of 0x00 sync bytes, the
 * 0xA5 sync byte, the 0xD3 0xD3 0xD3 BASIC marker, a one-character filename, then
 * the tokenized program terminated per the CSAVE format.
 */
export function buildCasImage(
  _program: Uint8Array,
  _programName: string,
): Uint8Array {
  throw new Error('trs80: cassette image not implemented');
}

export function parseCasImage(_image: Uint8Array): {
  programName: string;
  program: Uint8Array;
} {
  throw new Error('trs80: cassette image not implemented');
}
