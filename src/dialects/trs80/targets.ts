import type { BuildTarget, Block } from '../types';
import {
  assertNoFatalErrors,
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { buildCasImage } from './casfile';
import { buildCmdModule, buildTrsDisk, type Trs80DiskFile } from './trs80Disk';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';

/** Disk-BASIC token marker that prefixes a tokenized program file (`/BAS`). */
const DISK_BASIC_MARKER = 0xff;

/**
 * Tokenize `source` into the program image (bytes from 0x42E9), or an empty
 * array for a document with no BASIC lines (a machine-code-only disc). Throws on
 * tokenizer errors so a broken program is reported rather than silently exported.
 */
function programImage(source: string): Uint8Array {
  if (source.trim() === '') return new Uint8Array(0);
  const { program, errors } = tokenizeProgram(source);
  assertNoFatalErrors(errors);
  return program.length > 2 ? program : new Uint8Array(0);
}

/**
 * Build a JV1 TRSDOS `.dsk` image for a document: the BASIC program as a
 * `NAME/BAS` file (a `0xFF` marker + the tokenized program) plus each memory
 * block as a `NAME/CMD` load module carrying its load and entry addresses. The
 * `loader` flag is accepted for parity with the block-aware {@link BuildTarget}
 * contract (and the Transfer dialog's auto-loader checkbox) but is not yet
 * honoured - a TRSDOS auto-boot is a scoped follow-up; a `.dsk` carries every
 * file regardless, so nothing is dropped meanwhile.
 */
export function buildTrs80DiskImage(
  source: string,
  programName: string,
  blocks: readonly Block[] = [],
  _loader = false,
): Uint8Array {
  const program = programImage(source);
  const files: Trs80DiskFile[] = [];
  if (program.length > 0) {
    files.push({
      name: programName,
      ext: 'BAS',
      bytes: Uint8Array.from([DISK_BASIC_MARKER, ...program]),
    });
  }
  const sorted = [...blocks].sort((a, b) => a.address - b.address);
  for (const block of sorted) {
    files.push({
      name: block.name,
      ext: 'CMD',
      bytes: buildCmdModule(
        block.address,
        block.bytes,
        block.entry ?? block.address,
      ),
    });
  }
  return buildTrsDisk(files, { diskName: programName });
}

/**
 * Build the native `.cas` cassette image: the byte-level CSAVE block (leader,
 * 0xA5 sync, 0xD3 marker, filename, tokenized program). This is both the export
 * file and what an emulator's virtual cassette deck reads back.
 */
export function buildCas(source: string, programName: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  return buildCasImage(
    buildImageOrThrow({ bytes: program, errors }, 2),
    programName,
  );
}

export const trs80BuildTargets: BuildTarget[] = [
  fileTarget('trs80-cas', 'Export .cas', 'cas', (source, { programName }) =>
    buildCas(source, programName),
  ),
  fileTarget(
    'trs80-dsk',
    'Export .dsk disk',
    'dsk',
    (source, { programName, blocks, loader }) =>
      buildTrs80DiskImage(source, programName, blocks, loader),
    // A JV1 TRSDOS disc carries the BASIC program plus each memory block as its
    // own file; the .cas/.wav targets hold the BASIC program only, so the
    // Transfer dialog warns before dropping blocks to them.
    { supportsBlocks: true },
  ),
  cassetteWavTarget({
    id: 'trs80-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName),
  }),
];
