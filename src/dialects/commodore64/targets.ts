import type { BuildTarget, MemoryBlock } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { buildD64, type D64ExportEntry } from './d64';
import { loaderProgramBytes } from './loader';
import {
  CASSETTE_SAMPLE_RATE,
  buildCassetteSamples,
} from './audio/cassetteEncoder';
import { PROGRAM_BASE } from './addresses';

/** Programs load at $0801 on the C64. */
const LOAD_ADDRESS = PROGRAM_BASE;

/**
 * Build the loadable .prg image: the 2-byte load address ($0801) followed by
 * the tokenized program. This is the same image the emulator injects and the
 * import/export file format.
 */
export function buildPrg(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  // A bare 0x0000 end link means the program is empty.
  const bytes = buildImageOrThrow({ bytes: program, errors }, 2);
  return Uint8Array.from([0x01, 0x08, ...bytes]);
}

/**
 * The whole document as an ordered list of `.d64` directory entries.
 *
 * Without memory blocks it is the single BASIC program at $0801. With blocks
 * each becomes a directory entry at its own load address (address order); with
 * `loader` on, a generated auto-run loader program (see `./loader`, disk device
 * 8) leads so an exported disk runs by itself, and the main program - being the
 * largest $0801 entry - is still what the importer re-opens for editing,
 * mirroring the ZX Spectrum `.TAP` export.
 */
export function exportD64Entries(
  source: string,
  programName: string,
  memoryBlocks: readonly MemoryBlock[] = [],
  loader = false,
): D64ExportEntry[] {
  const program = buildPrg(source).subarray(2); // drop the $0801 load word
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

export const c64BuildTargets: BuildTarget[] = [
  fileTarget('c64-prg', 'Export .prg', 'prg', buildPrg),
  fileTarget(
    'c64-d64',
    'Export .d64',
    'd64',
    (source, { programName, blocks, loader }) =>
      buildD64(
        exportD64Entries(source, programName, blocks, loader),
        programName,
      ),
    { supportsBlocks: true },
  ),
  cassetteWavTarget({
    id: 'c64-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    supportsBlocks: true,
    buildSamples: (source, { programName, blocks, loader }) =>
      buildCassetteSamples(source, programName, false, blocks, loader),
  }),
];
