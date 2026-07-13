/**
 * Commodore VIC-20 cassette audio.
 *
 * The PET, VIC-20 and C64 share one datasette format across the whole lineage
 * (the S/M/L pulse scheme with a 192-byte header block and a data block, each
 * written twice with a countdown + XOR checksum), so the actual encoder and
 * decoder are the address-parameterized commodore64 siblings — this module only
 * supplies the unexpanded VIC-20's $1001 load address and routes the decoded
 * bytes through the VIC-20 detokenizer (so a foreign load address is reported
 * with the VIC-20's RAM-expansion machine hint).
 */
import { buildPrg } from '../targets';
import { detokenizeProgram } from '../detokenizer';
import {
  CASSETTE_SAMPLE_RATE,
  buildHeaderBlock,
  encodeC64Tape,
} from '../../commodore64/audio/cassetteEncoder';
import { decodeCassette } from '../../commodore64/audio/cassetteDecoder';

export { CASSETTE_SAMPLE_RATE };

/** The unexpanded VIC-20 base — programs load at $1001 (vs the C64's $0801). */
const VIC20_LOAD_ADDRESS = 0x1001;

/** Encode VIC-20 source to cassette samples (the dialect's `buildSamples`). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  const program = buildPrg(source).subarray(2); // drop the $1001 load address
  const header = buildHeaderBlock(
    programName,
    VIC20_LOAD_ADDRESS,
    VIC20_LOAD_ADDRESS + program.length,
  );
  return encodeC64Tape(header, program, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderPulses: robust ? 2400 : 1200,
  });
}

/**
 * Decode recorded cassette samples back into an editable VIC-20 program (the
 * inverse of {@link buildCassetteSamples}). The decoder accepts any file-type
 * $01 header regardless of its start address, so a $1001 VIC-20 header
 * round-trips; the recovered program bytes are detokenized through the BASIC V2
 * table.
 */
export function decodeSamples(
  samples: Float32Array,
  sampleRate: number,
): { programName: string; source: string } {
  const { name, data } = decodeCassette(samples, sampleRate);
  return { programName: name, source: detokenizeProgram(data) };
}
