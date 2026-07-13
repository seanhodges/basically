/**
 * Commodore PET cassette audio.
 *
 * The PET, VIC-20 and C64 share one datasette format across the whole lineage
 * (the S/M/L pulse scheme with a 192-byte header block and a data block, each
 * written twice with a countdown + XOR checksum), so the actual encoder and
 * decoder are the address-parameterized commodore64 siblings — this module only
 * supplies the PET's $0401 load address and routes the decoded bytes through the
 * PET detokenizer (so the BASIC 4.0 disk tokens $CC–$DA list correctly).
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

/** The PET base address — programs load at $0401 (vs the C64's $0801). */
const PET_LOAD_ADDRESS = 0x0401;

/** Encode PET source to cassette samples (the dialect's `buildSamples`). */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
): Float32Array {
  const program = buildPrg(source).subarray(2); // drop the $0401 load address
  const header = buildHeaderBlock(
    programName,
    PET_LOAD_ADDRESS,
    PET_LOAD_ADDRESS + program.length,
  );
  return encodeC64Tape(header, program, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderPulses: robust ? 2400 : 1200,
  });
}

/**
 * Decode recorded cassette samples back into an editable PET program (the
 * inverse of {@link buildCassetteSamples}). The decoder accepts any file-type
 * $01 header regardless of its start address, so a $0401 PET header round-trips;
 * the recovered program bytes are detokenized through the PET's BASIC 4.0 table.
 */
export function decodeSamples(
  samples: Float32Array,
  sampleRate: number,
): { programName: string; source: string } {
  const { name, data } = decodeCassette(samples, sampleRate);
  return { programName: name, source: detokenizeProgram(data) };
}
