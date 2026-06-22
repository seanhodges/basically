/**
 * Stub — filled in by Stage 4 of docs/dialect-plans/trs80.md.
 *
 * Model I 500-baud cassette bit scheme: a clock pulse at the start of every bit
 * cell and a data pulse mid-cell for a 1, no mid-cell pulse for a 0.
 */
export function encodeCassette(
  _image: Uint8Array,
  _opts: { sampleRate: number },
): Float32Array {
  throw new Error('trs80: cassette encoder not implemented');
}
