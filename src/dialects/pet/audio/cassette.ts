/**
 * TODO (pet Stage 4): Commodore cassette audio at the $0401 load address -
 * buildSamples = buildHeaderBlock(name, 0x0401, end) + the sibling
 * encodeC64Tape (already address-parameterized), decodeSamples = sibling
 * decodeCassette + the PET detokenizer.
 * See docs/contributing/dialect-plans/pet.md.
 */
export const CASSETTE_SAMPLE_RATE = 44100;

export function buildCassetteSamples(
  _source: string,
  _programName: string,
  _robust = false,
): Float32Array {
  throw new Error('pet: not implemented (Stage 4)');
}

export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): { name: string; data: Uint8Array } {
  throw new Error('pet: not implemented (Stage 4)');
}
