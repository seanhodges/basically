/**
 * Stub — filled in by Stage 4 of docs/dialect-plans/trs80.md. The inverse of
 * cassetteEncoder: recover the cassette block from recorded samples.
 */
export function decodeCassette(
  _samples: Float32Array,
  _sampleRate: number,
): { programName: string; data: Uint8Array } {
  throw new Error('trs80: cassette decoder not implemented');
}
