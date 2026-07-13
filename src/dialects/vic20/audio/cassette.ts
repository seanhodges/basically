/**
 * VIC-20 cassette encoding.
 *
 * The Commodore datasette format is machine-agnostic — the same short/medium/
 * long pulse scheme, byte framing, redundant-block layout and XOR checksum on
 * the PET, VIC-20 and C64 — so the pulse encoder ({@link encodeC64Tape}) and
 * decoder ({@link decodeCassette}) are reused verbatim from the commodore64
 * sibling. The only VIC-20 difference lives in the tape header: an unexpanded
 * VIC-20 BASIC program loads at $1001, not the C64's $0801.
 */
import { buildPrg } from '../targets';
import {
  CASSETTE_SAMPLE_RATE,
  buildHeaderBlock,
  encodeC64Tape,
} from '../../commodore64/audio/cassetteEncoder';
import { decodeCassette } from '../../commodore64/audio/cassetteDecoder';

export { CASSETTE_SAMPLE_RATE, decodeCassette };

/** Unexpanded VIC-20 BASIC start (vs the C64's $0801). */
const LOAD_ADDRESS = 0x1001;

/** Encode source to cassette samples (the dialect's `buildSamples`). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  const program = buildPrg(source).subarray(2); // drop the $1001 load address
  const header = buildHeaderBlock(
    programName,
    LOAD_ADDRESS,
    LOAD_ADDRESS + program.length,
  );
  return encodeC64Tape(header, program, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderPulses: robust ? 2400 : 1200,
  });
}
