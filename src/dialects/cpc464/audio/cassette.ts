/**
 * CPC firmware cassette scheme: leader + sync, 2K blocks of 256-byte CRC'd
 * segments, written at 2000 baud (decode accepts 1000/2000). Stage 4 fills
 * this in, reusing `src/transfer/wav.ts` for WAV framing. See
 * docs/contributing/dialect-plans/cpc464.md.
 */

export const CASSETTE_SAMPLE_RATE = 44100;

/** Encode a tokenized program as CPC cassette samples. */
export function buildCassetteSamples(
  _program: Uint8Array,
  _programName: string,
  _robust: boolean,
): Float32Array {
  throw new Error('cpc464: not implemented');
}

/** Decode recorded CPC cassette samples back to the tokenized program. */
export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): { name: string; program: Uint8Array } {
  throw new Error('cpc464: not implemented');
}
