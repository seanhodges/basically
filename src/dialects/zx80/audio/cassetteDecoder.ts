import { decodeSinclairPulses } from '../../sinclairTape';

/**
 * ZX80 cassette decoding — the inverse of {@link encodeCassette}.
 *
 * The ZX80 uses the same pulse scheme the ZX81 later inherited, so the
 * byte-stream recovery is shared in {@link decodeSinclairPulses}. The crucial
 * difference is that the ZX80 has NO named files — the tape is just the raw
 * `.O` memory image (the RAM dump from 0x4000), with no program-name header —
 * so the decoded bytes ARE the `.O` image, with nothing to strip off the front.
 */
export interface DecodeCassetteResult {
  /** The `.O` image bytes recovered from the tape. */
  data: Uint8Array;
}

export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  return { data: decodeSinclairPulses(samples, sampleRate) };
}
