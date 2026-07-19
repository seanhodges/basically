import type { BuildTarget, MemoryBlock } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { samplesToWav } from '../../transfer/wav';
import { buildD64, type D64ExportEntry } from '../commodore64/d64';
import { loaderProgramBytes } from './loader';
import { CASSETTE_SAMPLE_RATE, buildCassetteSamples } from './audio/cassette';

/** Programs load at $1001 on the unexpanded VIC-20. */
const LOAD_ADDRESS = 0x1001;

/**
 * Build the loadable .prg image: the 2-byte load address ($1001, the
 * unexpanded VIC-20 base) followed by the tokenized program. This is the same
 * image the emulator injects and the import/export file format — identical in
 * shape to the C64's, only the address differs.
 */
export function buildPrg(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
  // A bare 0x0000 end link means the program is empty.
  if (program.length <= 2) {
    throw new Error('Program is empty');
  }
  return Uint8Array.from([0x01, 0x10, ...program]);
}

/**
 * The whole document as an ordered list of `.d64` directory entries.
 *
 * Without memory blocks it is the single BASIC program at $1001. With blocks
 * each becomes a directory entry at its own load address (address order); with
 * `loader` on, a generated auto-run loader program (disk device 8) leads so an
 * exported disk runs by itself, and the main program - being the largest $1001
 * entry - is still what the importer re-opens for editing. Mirrors the C64's
 * `exportD64Entries`, only the load address differs.
 */
export function exportD64Entries(
  source: string,
  programName: string,
  memoryBlocks: readonly MemoryBlock[] = [],
  loader = false,
): D64ExportEntry[] {
  const program = buildPrg(source).subarray(2); // drop the $1001 load word
  const mainEntry: D64ExportEntry = {
    name: programName,
    start: LOAD_ADDRESS,
    bytes: program,
  };
  if (memoryBlocks.length === 0) return [mainEntry];

  const sorted = [...memoryBlocks].sort((a, b) => a.address - b.address);
  const blockEntries: D64ExportEntry[] = sorted.map((b) => ({
    name: b.name,
    start: b.address,
    bytes: b.bytes,
  }));

  if (loader) {
    const loaderEntry: D64ExportEntry = {
      name: `${programName}.L`,
      start: LOAD_ADDRESS,
      bytes: loaderProgramBytes(programName, sorted, 8),
    };
    return [loaderEntry, ...blockEntries, mainEntry];
  }
  return [mainEntry, ...blockEntries];
}

export const vic20BuildTargets: BuildTarget[] = [
  {
    id: 'vic20-prg',
    label: 'Export .prg',
    fileExtension: 'prg',
    build: (source, { programName }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.prg`,
          blob: new Blob([buildPrg(source) as BlobPart], {
            type: 'application/octet-stream',
          }),
        },
      ]),
  },
  {
    id: 'vic20-d64',
    label: 'Export .d64',
    fileExtension: 'd64',
    supportsBlocks: true,
    build: (source, { programName, blocks, loader }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.d64`,
          blob: new Blob(
            [
              buildD64(
                exportD64Entries(source, programName, blocks, loader),
                programName,
              ) as BlobPart,
            ],
            { type: 'application/octet-stream' },
          ),
        },
      ]),
  },
  {
    id: 'vic20-wav',
    label: 'Export cassette .wav',
    fileExtension: 'wav',
    supportsBlocks: true,
    build: (source, { programName, blocks, loader }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.wav`,
          blob: samplesToWav(
            buildCassetteSamples(source, programName, false, blocks, loader),
            CASSETTE_SAMPLE_RATE,
          ),
        },
      ]),
  },
];
