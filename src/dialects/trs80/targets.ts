import type { BuildTarget, MemoryBlock } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { buildCasImage } from './casfile';
import { buildCmdModule, buildTrsDisk, type Trs80DiskFile } from './trs80Disk';
import { samplesToWav } from '../../transfer/wav';
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
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
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
  blocks: readonly MemoryBlock[] = [],
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
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  if (program.length <= 2) throw new Error('Program is empty');
  return buildCasImage(program, programName);
}

export const trs80BuildTargets: BuildTarget[] = [
  {
    id: 'trs80-cas',
    label: 'Export .cas',
    fileExtension: 'cas',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.cas`,
          blob: new Blob([buildCas(source, programName) as BlobPart], {
            type: 'application/octet-stream',
          }),
        },
      ]),
  },
  {
    id: 'trs80-dsk',
    label: 'Export .dsk disk',
    fileExtension: 'dsk',
    // A JV1 TRSDOS disc carries the BASIC program plus each memory block as its
    // own file; the .cas/.wav targets hold the BASIC program only, so the
    // Transfer dialog warns before dropping blocks to them.
    supportsBlocks: true,
    build: (source, { programName, blocks, loader }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.dsk`,
          blob: new Blob(
            [
              buildTrs80DiskImage(
                source,
                programName,
                blocks,
                loader,
              ) as BlobPart,
            ],
            { type: 'application/octet-stream' },
          ),
        },
      ]),
  },
  {
    id: 'trs80-wav',
    label: 'Export cassette .wav',
    fileExtension: 'wav',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.wav`,
          blob: samplesToWav(
            buildCassetteSamples(source, programName),
            CASSETTE_SAMPLE_RATE,
          ),
        },
      ]),
  },
];
