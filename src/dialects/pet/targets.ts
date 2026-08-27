import type { BuildTarget, Block } from '../types';
import {
  buildImageOrThrow,
  cassetteWavTarget,
  fileTarget,
} from '../targetHelpers';
import { tokenizeProgram } from './tokenizer';
import { buildD64, type D64ExportEntry } from '../commodore64/d64';
import { loaderProgramBytes } from './loader';
import { CASSETTE_SAMPLE_RATE, buildCassetteSamples } from './audio/cassette';
import { PROGRAM_BASE } from './addresses';

/** Programs load at $0401 on the PET. */
const LOAD_ADDRESS = PROGRAM_BASE;

/**
 * Build the loadable .prg image: the 2-byte load address ($0401, the PET base)
 * followed by the tokenized program. This is the same image the emulator injects
 * and the import/export file format — identical in shape to the C64's, only the
 * address differs.
 */
export function buildPrg(source: string): Uint8Array {
  const { program, errors } = tokenizeProgram(source);
  // A bare 0x0000 end link means the program is empty.
  const bytes = buildImageOrThrow({ bytes: program, errors }, 2);
  return Uint8Array.from([0x01, 0x04, ...bytes]);
}

/**
 * The whole document as an ordered list of `.d64` directory entries.
 *
 * Without memory blocks it is the single BASIC program at $0401. With blocks
 * each becomes a directory entry at its own load address (address order); with
 * `loader` on, a generated auto-run loader program (disk device 8) leads so an
 * exported disk runs by itself, and the main program - being the largest $0401
 * entry - is still what the importer re-opens for editing. Mirrors the C64's
 * `exportD64Entries`, only the load address differs.
 */
export function exportD64Entries(
  source: string,
  programName: string,
  memoryBlocks: readonly Block[] = [],
  loader = false,
): D64ExportEntry[] {
  const program = buildPrg(source).subarray(2); // drop the $0401 load word
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

export const petBuildTargets: BuildTarget[] = [
  fileTarget('pet-prg', 'Export .prg', 'prg', buildPrg),
  fileTarget(
    'pet-d64',
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
    id: 'pet-wav',
    sampleRate: CASSETTE_SAMPLE_RATE,
    supportsBlocks: true,
    buildSamples: (source, { programName, blocks, loader }) =>
      buildCassetteSamples(source, programName, false, blocks, loader),
  }),
];
