/**
 * TODO (vic20 Stage 4): Commodore cassette audio at the $1001 load address -
 * buildSamples = buildHeaderBlock(name, 0x1001, end) + the sibling
 * encodeC64Tape (already address-parameterized), decodeSamples = sibling
 * decodeCassette + the VIC-20 detokenizer.
 * See docs/contributing/dialect-plans/vic20.md.
 */
export const CASSETTE_SAMPLE_RATE = 44100;

export function buildCassetteSamples(
  _source: string,
  _programName: string,
  _robust = false,
): Float32Array {
  throw new Error('vic20: not implemented (Stage 4)');
}

export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): { name: string; data: Uint8Array } {
  throw new Error('vic20: not implemented (Stage 4)');
}
