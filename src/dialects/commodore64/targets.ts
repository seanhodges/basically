import type { BuildTarget, MemoryBlock } from '../types';
import { fatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { samplesToWav } from '../../transfer/wav';
import { buildT64, type T64ExportEntry } from './t64';
import { loaderProgramBytes } from './loader';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';

/** Programs load at $0801 on the C64. */
const LOAD_ADDRESS = 0x0801;

/**
 * Build the loadable .prg image: the 2-byte load address ($0801) followed by
 * the tokenized program. This is the same image the emulator injects and the
 * import/export file format.
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
  return Uint8Array.from([0x01, 0x08, ...program]);
}

/**
 * The whole document as an ordered list of `.t64` directory entries - the
 * single layout shared by the `.t64` file and (via {@link buildCassetteSamples})
 * the cassette audio.
 *
 * Without memory blocks it is the single BASIC program at $0801. With blocks
 * each becomes a directory entry at its own load address (address order); with
 * `loader` on, a generated auto-run loader program (see `./loader`) leads so an
 * exported tape runs by itself, and the main program - being the largest $0801
 * entry - is still what the importer re-opens for editing, mirroring the ZX
 * Spectrum `.TAP` export.
 */
export function exportT64Entries(
  source: string,
  programName: string,
  memoryBlocks: readonly MemoryBlock[] = [],
  loader = false,
): T64ExportEntry[] {
  const program = buildPrg(source).subarray(2); // drop the $0801 load word
  const mainEntry: T64ExportEntry = {
    name: programName,
    start: LOAD_ADDRESS,
    bytes: program,
  };
  if (memoryBlocks.length === 0) return [mainEntry];

  const sorted = [...memoryBlocks].sort((a, b) => a.address - b.address);
  const blockEntries: T64ExportEntry[] = sorted.map((b) => ({
    name: b.name,
    start: b.address,
    bytes: b.bytes,
  }));

  if (loader) {
    const loaderEntry: T64ExportEntry = {
      name: `${programName}.L`,
      start: LOAD_ADDRESS,
      bytes: loaderProgramBytes(programName, sorted),
    };
    return [loaderEntry, ...blockEntries, mainEntry];
  }
  return [mainEntry, ...blockEntries];
}

export const c64BuildTargets: BuildTarget[] = [
  {
    id: 'c64-prg',
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
    id: 'c64-t64',
    label: 'Export .t64',
    fileExtension: 't64',
    supportsBlocks: true,
    build: (source, { programName, blocks, loader }) =>
      Promise.resolve([
        {
          fileName: `${programName.toLowerCase()}.t64`,
          blob: new Blob(
            [
              buildT64(
                exportT64Entries(source, programName, blocks, loader),
                programName,
              ) as BlobPart,
            ],
            { type: 'application/octet-stream' },
          ),
        },
      ]),
  },
  {
    id: 'c64-wav',
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
