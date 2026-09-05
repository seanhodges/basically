/**
 * Commodore PET cassette audio.
 *
 * The PET, VIC-20 and C64 share one datasette format across the whole lineage
 * (the S/M/L pulse scheme with a 192-byte header block and a data block, each
 * written twice with a countdown + XOR checksum), so the actual encoder and
 * decoder are the address-parameterized commodore64 siblings — this module only
 * supplies the PET's $0401 load address and routes the decoded bytes through the
 * PET detokenizer (so the BASIC 4.0 disk tokens $CC–$DA list correctly).
 *
 * A document with memory blocks exports as a multi-file tape the same way the
 * C64 does (header $01 program + a header $03 code file per block, optionally
 * behind an auto-loader), and the import side recovers them - the block-aware
 * body layout and the multi-part decode convention are both shared.
 */
import type { AudioDecodeResult, Block } from '../../types';
import { buildPrg } from '../targets';
import { detokenizeProgram, detokenizeCbmTapeWithReport } from '../detokenizer';
import { loaderProgramBytes } from '../loader';
import {
  CASSETTE_SAMPLE_RATE,
  buildCbmTapeBodies,
  encodeC64Bodies,
} from '../../commodore64/audio/cassetteEncoder';
import {
  decodeCassette,
  decodeCassetteFiles,
} from '../../commodore64/audio/cassetteDecoder';
import { PROGRAM_BASE } from '../addresses';

export { CASSETTE_SAMPLE_RATE };

/** The PET base address — programs load at $0401 (vs the C64's $0801). */
const PET_LOAD_ADDRESS = PROGRAM_BASE;

/**
 * Encode PET source to cassette samples (the dialect's `buildSamples`). Without
 * memory blocks it is the classic single program; with blocks each becomes a
 * further tape file, and with `loader` on a generated auto-run loader leads the
 * tape - the same ordered layout {@link exportD64Entries} writes to disk.
 */
export function buildCassetteSamples(
  source: string,
  programName: string,
  robust = false,
  blocks: readonly Block[] = [],
  loader = false,
): Float32Array {
  const program = buildPrg(source).subarray(2); // drop the $0401 load address
  const sorted = [...blocks].sort((a, b) => a.address - b.address);
  const bodies = buildCbmTapeBodies({
    program,
    programName,
    loadAddress: PET_LOAD_ADDRESS,
    blocks,
    loaderBytes:
      loader && blocks.length > 0
        ? loaderProgramBytes(programName, sorted)
        : null,
  });
  return encodeC64Bodies(bodies, {
    sampleRate: CASSETTE_SAMPLE_RATE,
    leaderPulses: robust ? 2400 : 1200,
  });
}

/**
 * Decode recorded cassette samples back into an editable PET program (the
 * inverse of {@link buildCassetteSamples}). A multi-file tape (program + CODE
 * blocks, optionally behind an auto-loader) is reassembled with the same
 * convention the `.d64` import uses, so the memory blocks come back; a plain
 * single-program tape falls through to the lenient single-file decode. The
 * recovered program bytes are detokenized through the PET's BASIC 4.0 table.
 */
export function decodeSamples(
  samples: Float32Array,
  sampleRate: number,
): AudioDecodeResult {
  const files = decodeCassetteFiles(samples, sampleRate);
  if (files.length > 1) {
    return detokenizeCbmTapeWithReport(
      files.map((f) => ({ name: f.name, start: f.start, bytes: f.data })),
    );
  }
  const { name, data } = decodeCassette(samples, sampleRate);
  return { programName: name, source: detokenizeProgram(data) };
}
