import { zx81Charset } from '../charset';
import { decodeSinclairPulses } from '../../sinclairTape';

/**
 * ZX81 cassette decoding — the inverse of {@link encodeCassette}.
 *
 * The byte-stream recovery (gating the signal into tone bursts and counting
 * carrier half-cycles) is shared with the ZX80 in {@link decodeSinclairPulses};
 * the only ZX81-specific step is splitting the program-name header (ZX81
 * charset, last char +0x80) from the .P data that follows it.
 */
export interface DecodeCassetteResult {
  /** Program name from the tape header. */
  name: string;
  /** The .P image bytes that followed the name (starts at 0x4009). */
  data: Uint8Array;
}

export function decodeCassette(
  samples: Float32Array,
  sampleRate: number,
): DecodeCassetteResult {
  const bytes = decodeSinclairPulses(samples, sampleRate);

  // Split the name (ends at the first byte with bit 7 set) from the .P image.
  const split = splitName(bytes);
  if (!split) throw new Error('Could not read program name from the signal');
  const name = zx81Charset.toUnicode(split.nameCodes).trim();
  return { name, data: split.data };
}

/** First byte with bit 7 set ends the name (name codes are all < 0x80 otherwise). */
function splitName(
  bytes: Uint8Array,
): { nameCodes: Uint8Array; data: Uint8Array } | null {
  const max = Math.min(bytes.length, 10);
  for (let i = 0; i < max; i++) {
    if (bytes[i]! & 0x80) {
      const nameCodes = bytes.slice(0, i + 1);
      nameCodes[i] = nameCodes[i]! & 0x7f; // strip end-of-name marker
      return { nameCodes, data: bytes.slice(i + 1) };
    }
  }
  return null;
}
